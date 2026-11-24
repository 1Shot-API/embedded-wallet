import {
  compressSecp256k1PublicKey,
  bitcoinNetworkForChainId,
} from "@1shotapi/ows-signer-utils";
import {
  BITCOIN_MAINNET_CHAIN_ID,
  ConversionUtils,
  OwsInvalidParamsError,
  type BitcoinChainId,
  type SECP256K1PublicKey,
} from "@1shotapi/ows-types";
import { secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";
import * as btc from "@scure/btc-signer";

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function encodeBitcoinVarint(length: number): Uint8Array {
  if (length < 0xfd) return Uint8Array.of(length);
  if (length <= 0xffff) {
    return Uint8Array.of(0xfd, length & 0xff, (length >> 8) & 0xff);
  }
  throw new Error("Bitcoin message is too long");
}

function bytesFromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) {
    throw new OwsInvalidParamsError("Bitcoin value must be hex");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** SIGHASH_ALL. A missing list means the same. Any other type leaves outputs changeable. */
export function standardSighash(types: number[] | undefined): number {
  const sighash = types ?? [1];
  const value = sighash[0];
  if (sighash.length !== 1 || value !== 1) {
    throw new OwsInvalidParamsError("Only SIGHASH_ALL is supported");
  }
  return value;
}

export function bitcoinAddressOnChain(
  address: string,
  chainId: BitcoinChainId,
): boolean {
  try {
    btc.Address(bitcoinNetworkForChainId(chainId)).decode(address);
    return true;
  } catch {
    return false;
  }
}

export function assertBitcoinAddress(
  address: string,
  chainId: BitcoinChainId,
): void {
  if (bitcoinAddressOnChain(address, chainId)) return;
  throw new OwsInvalidParamsError(
    chainId === BITCOIN_MAINNET_CHAIN_ID
      ? "Bitcoin address is not valid on mainnet"
      : "Bitcoin address is not valid on testnet",
  );
}

export function sameBitcoinAddress(left: string, right: string): boolean {
  if (left === right) return true;
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  return (a.startsWith("bc1") || a.startsWith("tb1")) && a === b;
}

/** OP_RETURN payload, hex without a 0x prefix, at most 80 bytes. Empty is omitted. */
export function parseBitcoinMemo(memo: string | undefined): Uint8Array | undefined {
  if (memo === undefined || memo === "") return undefined;
  if (!/^[0-9a-fA-F]+$/.test(memo) || memo.length % 2 !== 0) {
    throw new OwsInvalidParamsError("Bitcoin memo must be hex without a 0x prefix");
  }
  if (memo.length / 2 > 80) {
    throw new OwsInvalidParamsError("Bitcoin memo must be at most 80 bytes");
  }
  return hexToBytes(memo);
}

export function bitcoinMessageHash(message: string): Uint8Array {
  const prefix = new TextEncoder().encode("Bitcoin Signed Message:\n");
  const body = new TextEncoder().encode(message);
  const payload = concatBytes(
    encodeBitcoinVarint(prefix.length),
    prefix,
    encodeBitcoinVarint(body.length),
    body,
  );
  return sha256(sha256(payload));
}

/**
 * Recoverable secp256k1 signature is `r || s || v` with `v` in {27, 28}.
 * Bitcoin message verification wants the compressed header first: 31 or 32.
 */
export function bitcoinMessageSignatureHex(
  recoverableSignature: Uint8Array,
): string {
  if (recoverableSignature.length !== 65) {
    throw new Error("Bitcoin message signature must be 65 bytes");
  }
  const recovery = recoverableSignature[64];
  if (recovery !== 27 && recovery !== 28) {
    throw new Error("Bitcoin message signature has no recovery id");
  }
  const encoded = new Uint8Array(65);
  encoded[0] = 31 + (recovery - 27);
  encoded.set(recoverableSignature.subarray(0, 64), 1);
  return ConversionUtils.bytesToHex(encoded).slice(2);
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

export type IBitcoinPsbtOutput = {
  address: string;
  amountSats: bigint;
};

function opReturnText(script: Uint8Array): string | undefined {
  let ops: Array<string | number | Uint8Array>;
  try {
    ops = btc.Script.decode(script);
  } catch {
    return undefined;
  }
  if (ops[0] !== "RETURN") return undefined;
  const data = ops.filter((op): op is Uint8Array => op instanceof Uint8Array);
  return data.length > 0 ? `OP_RETURN ${bytesToHex(concatBytes(...data))}` : "OP_RETURN";
}

/** Refuse a PSBT input this wallet cannot sign. */
export function describePsbtSpend(args: {
  psbtBase64: string;
  signInputs: Array<{ address: string; index: number; sighashTypes?: number[] }>;
  walletAddress: string;
  compressedPublicKey: Uint8Array;
  chainId: BitcoinChainId;
}): { outputs: IBitcoinPsbtOutput[]; feeSats: bigint | null; sighashTypes: number[] } {
  const tx = psbtTransaction(args.psbtBase64);
  const network = bitcoinNetworkForChainId(args.chainId);
  const ownScript = btc.p2wpkh(args.compressedPublicKey, network).script;
  let inputSum = 0n;
  const signed = new Set<number>();
  const sighashTypes: number[] = [];
  for (const input of args.signInputs) {
    if (!sameBitcoinAddress(input.address, args.walletAddress)) {
      throw new OwsInvalidParamsError("PSBT input is not this wallet");
    }
    sighashTypes.push(standardSighash(input.sighashTypes));
    const txInput = tx.getInput(input.index);
    const script = txInput.witnessUtxo?.script;
    const amount = txInput.witnessUtxo?.amount;
    if (!script || amount === undefined || !bytesEqual(script, ownScript)) {
      throw new OwsInvalidParamsError(
        "PSBT input is not this wallet's native SegWit output",
      );
    }
    signed.add(input.index);
    inputSum += BigInt(amount);
  }
  const outputs: IBitcoinPsbtOutput[] = [];
  let outputSum = 0n;
  for (let index = 0; index < tx.outputsLength; index++) {
    const output = tx.getOutput(index);
    if (output.amount === undefined || !output.script) {
      throw new OwsInvalidParamsError("PSBT output is not a standard address");
    }
    const amountSats = BigInt(output.amount);
    let address: string | undefined;
    try {
      address = tx.getOutputAddress(index, network);
    } catch {
      address = undefined;
    }
    address = address ?? opReturnText(output.script);
    if (!address) {
      throw new OwsInvalidParamsError("PSBT output is not a standard address");
    }
    outputs.push({ address, amountSats });
    outputSum += amountSats;
  }
  const feeSats =
    signed.size === tx.inputsLength ? inputSum - outputSum : null;
  return {
    outputs,
    feeSats: feeSats !== null && feeSats >= 0n ? feeSats : null,
    sighashTypes,
  };
}

function psbtTransaction(psbtBase64: string): btc.Transaction {
  return btc.Transaction.fromPSBT(bytesFromBase64(psbtBase64));
}

function sighashAt(types: number[] | undefined, position: number): number {
  return types?.[position] ?? btc.SigHash.ALL;
}

export function psbtInputSighashes(args: {
  psbtBase64: string;
  inputIndexes: number[];
  compressedPublicKey: Uint8Array;
  chainId?: BitcoinChainId;
  sighashTypes?: number[];
}): Uint8Array[] {
  const tx = psbtTransaction(args.psbtBase64);
  const network = bitcoinNetworkForChainId(
    args.chainId ?? BITCOIN_MAINNET_CHAIN_ID,
  );
  const p2w = btc.p2wpkh(args.compressedPublicKey, network);
  const scriptCode = btc.OutScript.encode({ type: "pkh", hash: p2w.hash });
  return args.inputIndexes.map((index, position) => {
    const input = tx.getInput(index);
    const amount = input.witnessUtxo?.amount;
    if (amount === undefined) {
      throw new OwsInvalidParamsError(`PSBT input ${index} is missing witnessUtxo`);
    }
    return tx.preimageWitnessV0(
      index,
      scriptCode,
      sighashAt(args.sighashTypes, position),
      amount,
    );
  });
}

function derWithSighash(compact: Uint8Array, sighashType: number): Uint8Array {
  const der = secp256k1.Signature.fromCompact(compact).toDERRawBytes();
  const withType = new Uint8Array(der.length + 1);
  withType.set(der);
  withType[der.length] = sighashType;
  return withType;
}

export function psbtWithSignatures(args: {
  psbtBase64: string;
  inputIndexes: number[];
  compactSignatures: Uint8Array[];
  compressedPublicKey: Uint8Array;
  sighashTypes?: number[];
}): string {
  if (args.inputIndexes.length !== args.compactSignatures.length) {
    throw new Error("PSBT signature count does not match the inputs");
  }
  const tx = psbtTransaction(args.psbtBase64);
  args.inputIndexes.forEach((index, position) => {
    const compact = args.compactSignatures[position]!;
    tx.updateInput(index, {
      partialSig: [
        [
          args.compressedPublicKey,
          derWithSighash(compact, sighashAt(args.sighashTypes, position)),
        ],
      ],
    });
  });
  return bytesToBase64(tx.toPSBT(0));
}

export function finalizedPsbtHex(psbtBase64: string): string {
  const tx = psbtTransaction(psbtBase64);
  tx.finalize();
  return tx.hex;
}

export function compressedKeyFromPublicKey(
  publicKey: SECP256K1PublicKey,
): Uint8Array {
  return compressSecp256k1PublicKey(publicKey);
}

export interface IWalletPaymentInput {
  txid: string;
  vout: number;
  valueSats: bigint;
}

export interface IWalletPaymentOutput {
  address: string;
  valueSats: bigint;
}

function taggedSha256(tag: string, message: Uint8Array): Uint8Array {
  const tagHash = sha256(new TextEncoder().encode(tag));
  return sha256(concatBytes(tagHash, tagHash, message));
}

function encodeCompactSize(value: number): Uint8Array {
  if (value < 0xfd) return Uint8Array.of(value);
  if (value <= 0xffff) {
    return Uint8Array.of(0xfd, value & 0xff, (value >> 8) & 0xff);
  }
  throw new Error("Bitcoin witness item is too long");
}

function encodeWitnessStack(items: Uint8Array[]): Uint8Array {
  return concatBytes(
    encodeCompactSize(items.length),
    ...items.flatMap((item) => [encodeCompactSize(item.length), item]),
  );
}

function p2wpkhScriptCode(
  compressedPublicKey: Uint8Array,
  chainId: BitcoinChainId,
): { script: Uint8Array; scriptCode: Uint8Array } {
  const p2w = btc.p2wpkh(compressedPublicKey, bitcoinNetworkForChainId(chainId));
  if (!p2w.script || !p2w.hash) {
    throw new Error("Bitcoin public key did not produce a native SegWit script");
  }
  return {
    script: p2w.script,
    scriptCode: btc.OutScript.encode({ type: "pkh", hash: p2w.hash }),
  };
}

/**
 * Build a P2WPKH payment, including an optional OP_RETURN memo, and return
 * the sighashes plus a function that applies compact signatures.
 */
export function prepareWalletPayment(args: {
  chainId: BitcoinChainId;
  compressedPublicKey: Uint8Array;
  inputs: IWalletPaymentInput[];
  outputs: IWalletPaymentOutput[];
  memo?: Uint8Array;
}): {
  sighashes: Uint8Array[];
  finish(compactSignatures: Uint8Array[]): { rawHex: string; txid: string };
} {
  if (args.inputs.length === 0) {
    throw new OwsInvalidParamsError("No Bitcoin UTXOs available");
  }
  const { script, scriptCode } = p2wpkhScriptCode(
    args.compressedPublicKey,
    args.chainId,
  );
  const network = bitcoinNetworkForChainId(args.chainId);
  const tx = new btc.Transaction({
    allowUnknownOutputs: Boolean(args.memo && args.memo.length > 0),
  });
  for (const input of args.inputs) {
    tx.addInput({
      txid: hexToBytes(input.txid),
      index: input.vout,
      witnessUtxo: { script, amount: input.valueSats },
    });
  }
  for (const output of args.outputs) {
    tx.addOutputAddress(output.address, output.valueSats, network);
  }
  if (args.memo && args.memo.length > 0) {
    tx.addOutput({
      script: btc.Script.encode(["RETURN", args.memo]),
      amount: 0n,
    });
  }
  const sighashes = args.inputs.map((input, index) =>
    tx.preimageWitnessV0(index, scriptCode, btc.SigHash.ALL, input.valueSats),
  );
  return {
    sighashes,
    finish(compactSignatures) {
      if (compactSignatures.length !== args.inputs.length) {
        throw new Error("Bitcoin signature count does not match the inputs");
      }
      compactSignatures.forEach((compact, index) => {
        tx.updateInput(index, {
          partialSig: [
            [args.compressedPublicKey, derWithSighash(compact, btc.SigHash.ALL)],
          ],
        });
      });
      tx.finalize();
      return { rawHex: tx.hex, txid: tx.id };
    },
  };
}

function bip322Sighash(args: {
  message: string;
  compressedPublicKey: Uint8Array;
  chainId: BitcoinChainId;
}): Uint8Array {
  const { script, scriptCode } = p2wpkhScriptCode(
    args.compressedPublicKey,
    args.chainId,
  );
  const messageHash = taggedSha256(
    "BIP0322-signed-message",
    new TextEncoder().encode(args.message),
  );
  const toSpend = new btc.Transaction({ version: 0, lockTime: 0 });
  toSpend.addOutput({ script, amount: 0n });
  toSpend.addInput({
    txid: new Uint8Array(32),
    index: 0xffffffff,
    sequence: 0,
    finalScriptSig: btc.Script.encode(["OP_0", messageHash]),
  });

  const toSign = new btc.Transaction({
    version: 0,
    lockTime: 0,
    allowUnknownOutputs: true,
  });
  toSign.addInput({
    txid: toSpend.id,
    index: 0,
    sequence: 0,
    witnessUtxo: { script, amount: 0n },
  });
  toSign.addOutput({
    script: btc.Script.encode(["RETURN"]),
    amount: 0n,
  });
  return toSign.preimageWitnessV0(0, scriptCode, btc.SigHash.ALL, 0n);
}

/** Digest to sign for a BIP-322 simple P2WPKH proof. */
export function bip322SimpleSighash(args: {
  message: string;
  compressedPublicKey: Uint8Array;
  chainId: BitcoinChainId;
}): Uint8Array {
  return bip322Sighash(args);
}

/**
 * BIP-322 simple proof for this wallet's P2WPKH key.
 * `signatureHex` is the hex encoding of the ASCII `smp` + base64 witness.
 */
export function bip322SimpleProof(args: {
  message: string;
  compressedPublicKey: Uint8Array;
  chainId: BitcoinChainId;
  compactSignature: Uint8Array;
}): { signatureHex: string; messageHashHex: string } {
  const sighash = bip322Sighash(args);
  const witness = encodeWitnessStack([
    derWithSighash(args.compactSignature, btc.SigHash.ALL),
    args.compressedPublicKey,
  ]);
  const ascii = `smp${bytesToBase64(witness)}`;
  return {
    signatureHex: bytesToHex(new TextEncoder().encode(ascii)),
    messageHashHex: bytesToHex(sighash),
  };
}
