import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BITCOIN_MAINNET_CHAIN_ID,
  BITCOIN_TESTNET_CHAIN_ID,
  OwsInvalidParamsError,
} from "@1shotapi/ows-types";
import { secp256k1 } from "@noble/curves/secp256k1";
import * as btc from "@scure/btc-signer";

import {
  assertBitcoinAddress,
  bip322SimpleProof,
  bip322SimpleSighash,
  bitcoinMessageSignatureHex,
  describePsbtSpend,
  parseBitcoinMemo,
  prepareWalletPayment,
  standardSighash,
} from "@/lib/implementations/utils/bitcoinHostSigning.ts";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

describe("bitcoin host signing", () => {
  const privateKey = secp256k1.utils.randomPrivateKey();
  const compressed = secp256k1.getPublicKey(privateKey, true);
  const mainnet = btc.p2wpkh(compressed, btc.NETWORK);
  const testnet = btc.p2wpkh(compressed, btc.TEST_NETWORK);

  it("accepts an address only on its own network", () => {
    assert.equal(typeof mainnet.address, "string");
    assert.equal(typeof testnet.address, "string");
    assert.doesNotThrow(() =>
      assertBitcoinAddress(mainnet.address!, BITCOIN_MAINNET_CHAIN_ID),
    );
    assert.throws(
      () => assertBitcoinAddress(testnet.address!, BITCOIN_MAINNET_CHAIN_ID),
      (error: unknown) =>
        error instanceof OwsInvalidParamsError && error.code === -32602,
    );
    const taproot = btc.p2tr(compressed.subarray(1), undefined, btc.NETWORK);
    assert.doesNotThrow(() =>
      assertBitcoinAddress(taproot.address!, BITCOIN_MAINNET_CHAIN_ID),
    );
  });

  it("parses an OP_RETURN memo of at most 80 bytes", () => {
    assert.equal(parseBitcoinMemo(undefined), undefined);
    assert.equal(parseBitcoinMemo(""), undefined);
    assert.deepEqual(parseBitcoinMemo("ab"), Uint8Array.of(0xab));
    assert.throws(
      () => parseBitcoinMemo("0xab"),
      (error: unknown) => error instanceof OwsInvalidParamsError,
    );
    assert.throws(
      () => parseBitcoinMemo("aa".repeat(81)),
      (error: unknown) => error instanceof OwsInvalidParamsError,
    );
  });

  it("accepts only SIGHASH_ALL", () => {
    assert.equal(standardSighash(undefined), 1);
    assert.equal(standardSighash([1]), 1);
    assert.throws(
      () => standardSighash([0x83]),
      (error: unknown) => error instanceof OwsInvalidParamsError,
    );
    assert.throws(
      () => standardSighash([1, 2]),
      (error: unknown) => error instanceof OwsInvalidParamsError,
    );
  });

  it("shows an OP_RETURN PSBT output instead of rejecting it", () => {
    const tx = new btc.Transaction({ allowUnknownOutputs: true });
    tx.addInput({
      txid: hexToBytes("11".repeat(32)),
      index: 0,
      witnessUtxo: { script: testnet.script!, amount: 10_000n },
    });
    tx.addOutputAddress(testnet.address!, 5_000n, btc.TEST_NETWORK);
    tx.addOutput({
      script: btc.Script.encode(["RETURN", new TextEncoder().encode("hi")]),
      amount: 0n,
    });
    const spend = describePsbtSpend({
      psbtBase64: bytesToBase64(tx.toPSBT(0)),
      signInputs: [{ address: testnet.address!, index: 0, sighashTypes: [1] }],
      walletAddress: testnet.address!,
      compressedPublicKey: compressed,
      chainId: BITCOIN_TESTNET_CHAIN_ID,
    });
    assert.equal(spend.sighashTypes[0], 1);
    assert.equal(spend.outputs[1]?.address, "OP_RETURN 6869");
    assert.equal(spend.feeSats, 5_000n);
  });

  it("keeps the ecdsa message signature as header-first hex", () => {
    const recoverable = new Uint8Array(65);
    recoverable[64] = 27;
    const hex = bitcoinMessageSignatureHex(recoverable);
    assert.equal(hex.length, 130);
    assert.equal(hex.startsWith("1f"), true);
    assert.equal(hex.startsWith("0x"), false);
  });

  it("builds a BIP-322 simple proof whose text starts with smp", () => {
    const sighash = bip322SimpleSighash({
      message: "Hello, World!",
      compressedPublicKey: compressed,
      chainId: BITCOIN_MAINNET_CHAIN_ID,
    });
    const compact = secp256k1.sign(sighash, privateKey).toCompactRawBytes();
    const proof = bip322SimpleProof({
      message: "Hello, World!",
      compressedPublicKey: compressed,
      chainId: BITCOIN_MAINNET_CHAIN_ID,
      compactSignature: compact,
    });
    const text = new TextDecoder().decode(hexToBytes(proof.signatureHex));
    assert.equal(text.startsWith("smp"), true);
    assert.equal(proof.messageHashHex, [...sighash].map((byte) => byte.toString(16).padStart(2, "0")).join(""));
  });

  it("puts an OP_RETURN memo in a signed payment", () => {
    const prepared = prepareWalletPayment({
      chainId: BITCOIN_TESTNET_CHAIN_ID,
      compressedPublicKey: compressed,
      inputs: [{ txid: "22".repeat(32), vout: 0, valueSats: 10_000n }],
      outputs: [{ address: testnet.address!, valueSats: 5_000n }],
      memo: new TextEncoder().encode("hi"),
    });
    const compact = secp256k1
      .sign(prepared.sighashes[0]!, privateKey)
      .toCompactRawBytes();
    const finished = prepared.finish([compact]);
    const raw = btc.Transaction.fromRaw(hexToBytes(finished.rawHex), {
      allowUnknownOutputs: true,
    });
    assert.equal(raw.outputsLength, 2);
    const data = raw.getOutput(1).script!;
    assert.equal(data[0], 0x6a);
  });
});
