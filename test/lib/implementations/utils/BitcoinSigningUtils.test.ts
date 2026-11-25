import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BITCOIN_MAINNET_CHAIN_ID,
  BITCOIN_TESTNET_CHAIN_ID,
  BitcoinSegwitAccountAddressSchema,
  BitcoinTaprootAccountAddressSchema,
  BitcoinTransactionHash,
  ConversionUtils,
  SECP256K1CompressedPublicKey,
  OwsInvalidParamsError,
  UnprefixedHexString,
} from "@1shotapi/ows-types";
import { secp256k1 } from "@noble/curves/secp256k1";
import * as btc from "@scure/btc-signer";

import { BitcoinSigningUtils } from "@/lib/implementations/utils/BitcoinSigningUtils.ts";

function unprefixedHexToBytes(hex: string): Uint8Array {
  return ConversionUtils.unprefixedHexToBytes(UnprefixedHexString(hex));
}

describe("BitcoinSigningUtils", () => {
  const privateKey = secp256k1.utils.randomPrivateKey();
  const compressed = secp256k1.getPublicKey(privateKey, true);
  const mainnet = btc.p2wpkh(compressed, btc.NETWORK);
  const testnet = btc.p2wpkh(compressed, btc.TEST_NETWORK);
  const compressedKey = SECP256K1CompressedPublicKey(ConversionUtils.bytesToHex(compressed));
  const mainnetAddress = BitcoinSegwitAccountAddressSchema.parse(mainnet.address);
  const testnetAddress = BitcoinSegwitAccountAddressSchema.parse(testnet.address);

  it("accepts an address only on its own network", () => {
    assert.equal(typeof mainnet.address, "string");
    assert.equal(typeof testnet.address, "string");
    assert.doesNotThrow(() =>
      BitcoinSigningUtils.assertAddress(mainnetAddress, BITCOIN_MAINNET_CHAIN_ID),
    );
    assert.throws(
      () => BitcoinSigningUtils.assertAddress(testnetAddress, BITCOIN_MAINNET_CHAIN_ID),
      (error: unknown) =>
        error instanceof OwsInvalidParamsError && error.code === -32602,
    );
    const taproot = btc.p2tr(compressed.subarray(1), undefined, btc.NETWORK);
    assert.doesNotThrow(() =>
      BitcoinSigningUtils.assertAddress(BitcoinTaprootAccountAddressSchema.parse(taproot.address), BITCOIN_MAINNET_CHAIN_ID),
    );
  });

  it("parses an OP_RETURN memo of at most 80 bytes", () => {
    assert.equal(BitcoinSigningUtils.parseMemo(undefined), undefined);
    assert.equal(BitcoinSigningUtils.parseMemo(""), undefined);
    assert.deepEqual(BitcoinSigningUtils.parseMemo("ab"), Uint8Array.of(0xab));
    assert.throws(
      () => BitcoinSigningUtils.parseMemo("0xab"),
      (error: unknown) => error instanceof OwsInvalidParamsError,
    );
    assert.throws(
      () => BitcoinSigningUtils.parseMemo("aa".repeat(81)),
      (error: unknown) => error instanceof OwsInvalidParamsError,
    );
  });

  it("accepts only SIGHASH_ALL", () => {
    assert.equal(BitcoinSigningUtils.standardSighash(undefined), 1);
    assert.equal(BitcoinSigningUtils.standardSighash([1]), 1);
    assert.throws(
      () => BitcoinSigningUtils.standardSighash([0x83]),
      (error: unknown) => error instanceof OwsInvalidParamsError,
    );
    assert.throws(
      () => BitcoinSigningUtils.standardSighash([1, 2]),
      (error: unknown) => error instanceof OwsInvalidParamsError,
    );
  });

  it("shows an OP_RETURN PSBT output instead of rejecting it", () => {
    const tx = new btc.Transaction({ allowUnknownOutputs: true });
    tx.addInput({
      txid: unprefixedHexToBytes("11".repeat(32)),
      index: 0,
      witnessUtxo: { script: testnet.script!, amount: 10_000n },
    });
    tx.addOutputAddress(testnet.address!, 5_000n, btc.TEST_NETWORK);
    tx.addOutput({
      script: btc.Script.encode(["RETURN", new TextEncoder().encode("hi")]),
      amount: 0n,
    });
    const spend = BitcoinSigningUtils.describePsbtSpend({
      psbtBase64: ConversionUtils.bytesToBase64(tx.toPSBT(0)),
      signInputs: [{ address: testnetAddress, index: 0, sighashTypes: [1] }],
      walletAddress: testnetAddress,
      compressedPublicKey: compressedKey,
      chainId: BITCOIN_TESTNET_CHAIN_ID,
    });
    assert.equal(spend.sighashTypes[0], 1);
    assert.equal(spend.outputs[1]?.address, "OP_RETURN 6869");
    assert.equal(spend.feeSats, 5_000n);
  });

  it("keeps the ecdsa message signature as header-first hex", () => {
    const recoverable = new Uint8Array(65);
    recoverable[64] = 27;
    const hex = BitcoinSigningUtils.messageSignatureHex(recoverable);
    assert.equal(hex.length, 130);
    assert.equal(hex.startsWith("1f"), true);
    assert.equal(hex.startsWith("0x"), false);
  });

  it("builds a BIP-322 simple proof whose text starts with smp", () => {
    const sighash = BitcoinSigningUtils.bip322SimpleSighash({
      message: "Hello, World!",
      compressedPublicKey: compressedKey,
      chainId: BITCOIN_MAINNET_CHAIN_ID,
    });
    const compact = secp256k1.sign(sighash, privateKey).toCompactRawBytes();
    const proof = BitcoinSigningUtils.bip322SimpleProof({
      message: "Hello, World!",
      compressedPublicKey: compressedKey,
      chainId: BITCOIN_MAINNET_CHAIN_ID,
      compactSignature: compact,
    });
    const text = new TextDecoder().decode(unprefixedHexToBytes(proof.signatureHex));
    assert.equal(text.startsWith("smp"), true);
    assert.equal(proof.messageHashHex, ConversionUtils.bytesToUnprefixedHex(sighash));
  });

  it("puts an OP_RETURN memo in a signed payment", () => {
    const prepared = BitcoinSigningUtils.prepareWalletPayment({
      chainId: BITCOIN_TESTNET_CHAIN_ID,
      compressedPublicKey: compressedKey,
      inputs: [{ txid: BitcoinTransactionHash("22".repeat(32)), vout: 0, valueSats: 10_000n }],
      outputs: [{ address: testnetAddress, valueSats: 5_000n }],
      memo: new TextEncoder().encode("hi"),
    });
    const compact = secp256k1
      .sign(prepared.sighashes[0]!, privateKey)
      .toCompactRawBytes();
    const finished = prepared.finish([compact]);
    const raw = btc.Transaction.fromRaw(unprefixedHexToBytes(finished.rawTransaction), {
      allowUnknownOutputs: true,
    });
    assert.equal(raw.outputsLength, 2);
    const data = raw.getOutput(1).script!;
    assert.equal(data[0], 0x6a);
  });
});
