import { bitcoinNetworkForChainId } from "@1shotapi/ows-signer-utils";
import {
  BITCOIN_MAINNET_CHAIN_ID,
  BitcoinTransactionHash,
  ConversionUtils,
  HexString,
  OwsInvalidParamsError,
  UnprefixedHexString,
  type Base64String,
  type BitcoinAddress,
  type BitcoinChainId,
  type BitcoinSegwitAccountAddress,
  type SECP256K1CompressedPublicKey,
} from "@1shotapi/ows-types";
import { secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";
import * as btc from "@scure/btc-signer";

import {
  makeBitcoinTransactionData,
  type BitcoinTransactionData,
} from "../../types/primitives/BitcoinTransactionData";

export interface IBitcoinPsbtOutput {
  /** Output address, or `OP_RETURN <hex>` display text for a data output. */
  address: string;
  amountSats: bigint;
}

export interface IBitcoinPsbtSignInput {
  address: BitcoinAddress;
  index: number;
  sighashTypes?: number[];
}

export interface IBitcoinPsbtSpend {
  outputs: IBitcoinPsbtOutput[];
  /** Null unless this wallet signs every input (otherwise the input sum is unknown). */
  feeSats: bigint | null;
  sighashTypes: number[];
}

export interface IWalletPaymentInput {
  txid: BitcoinTransactionHash;
  vout: number;
  valueSats: bigint;
}

export interface IWalletPaymentOutput {
  address: BitcoinAddress;
  valueSats: bigint;
}

export interface IFinishedWalletPayment {
  rawTransaction: BitcoinTransactionData;
  txid: BitcoinTransactionHash;
}

export interface IPreparedWalletPayment {
  sighashes: Uint8Array[];
  finish(compactSignatures: Uint8Array[]): IFinishedWalletPayment;
}

export interface IBip322Message {
  message: string;
  compressedPublicKey: SECP256K1CompressedPublicKey;
  chainId: BitcoinChainId;
}

export interface IBip322Proof {
  /** Hex of the ASCII `smp` + base64 witness. */
  signatureHex: UnprefixedHexString;
  messageHashHex: UnprefixedHexString;
}

/** Native SegWit (P2WPKH) PSBT, payment, and message signing for the Branding Layer. */
export class BitcoinSigningUtils {
  private static readonly MAX_MEMO_BYTES = 80;

  /** SIGHASH_ALL. A missing list means the same. Any other type leaves outputs changeable. */
  static standardSighash(types: number[] | undefined): number {
    const sighash = types ?? [btc.SigHash.ALL];
    const value = sighash[0];
    if (sighash.length !== 1 || value !== btc.SigHash.ALL) {
      throw new OwsInvalidParamsError("Only SIGHASH_ALL is supported");
    }
    return value;
  }

  static assertAddress(address: BitcoinAddress, chainId: BitcoinChainId): void {
    if (BitcoinSigningUtils.isAddressOnChain(address, chainId)) return;
    throw new OwsInvalidParamsError(
      chainId === BITCOIN_MAINNET_CHAIN_ID
        ? "Bitcoin address is not valid on mainnet"
        : "Bitcoin address is not valid on testnet",
    );
  }

  /** Bech32 addresses compare case-insensitively; base58 addresses do not. */
  static sameAddress(left: BitcoinAddress, right: BitcoinAddress): boolean {
    if (left === right) return true;
    const a = left.toLowerCase();
    const b = right.toLowerCase();
    return (a.startsWith("bc1") || a.startsWith("tb1")) && a === b;
  }

  /** OP_RETURN payload, hex without a 0x prefix, at most 80 bytes. Empty is omitted. */
  static parseMemo(memo: string | undefined): Uint8Array | undefined {
    if (memo === undefined || memo === "") return undefined;
    if (!/^(?:[0-9a-fA-F]{2})+$/.test(memo)) {
      throw new OwsInvalidParamsError("Bitcoin memo must be hex without a 0x prefix");
    }
    if (memo.length / 2 > BitcoinSigningUtils.MAX_MEMO_BYTES) {
      throw new OwsInvalidParamsError("Bitcoin memo must be at most 80 bytes");
    }
    return ConversionUtils.unprefixedHexToBytes(UnprefixedHexString(memo));
  }

  /** Legacy `Bitcoin Signed Message` double-SHA256 digest. */
  static messageHash(message: string): Uint8Array {
    const prefix = new TextEncoder().encode("Bitcoin Signed Message:\n");
    const body = new TextEncoder().encode(message);
    const payload = ConversionUtils.concatBytes(
      BitcoinSigningUtils.encodeCompactSize(prefix.length),
      prefix,
      BitcoinSigningUtils.encodeCompactSize(body.length),
      body,
    );
    return sha256(sha256(payload));
  }

  /**
   * Recoverable secp256k1 signature is `r || s || v` with `v` in {27, 28}.
   * Bitcoin message verification wants the compressed header first: 31 or 32.
   */
  static messageSignatureHex(recoverableSignature: Uint8Array): UnprefixedHexString {
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
    return ConversionUtils.bytesToUnprefixedHex(encoded);
  }

  /** Refuse a PSBT input this wallet cannot sign. */
  static describePsbtSpend(args: {
    psbtBase64: Base64String;
    signInputs: IBitcoinPsbtSignInput[];
    walletAddress: BitcoinSegwitAccountAddress;
    compressedPublicKey: SECP256K1CompressedPublicKey;
    chainId: BitcoinChainId;
  }): IBitcoinPsbtSpend {
    const tx = BitcoinSigningUtils.psbtTransaction(args.psbtBase64);
    const network = bitcoinNetworkForChainId(args.chainId);
    const { script: ownScript } = BitcoinSigningUtils.p2wpkhScriptCode(
      args.compressedPublicKey,
      args.chainId,
    );
    let inputSum = 0n;
    const signed = new Set<number>();
    const sighashTypes: number[] = [];
    for (const input of args.signInputs) {
      if (!BitcoinSigningUtils.sameAddress(input.address, args.walletAddress)) {
        throw new OwsInvalidParamsError("PSBT input is not this wallet");
      }
      sighashTypes.push(BitcoinSigningUtils.standardSighash(input.sighashTypes));
      const txInput = tx.getInput(input.index);
      const script = txInput.witnessUtxo?.script;
      const amount = txInput.witnessUtxo?.amount;
      if (
        !script ||
        amount === undefined ||
        !ConversionUtils.bytesEqual(script, ownScript)
      ) {
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
      address = address ?? BitcoinSigningUtils.opReturnText(output.script);
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

  static psbtInputSighashes(args: {
    psbtBase64: Base64String;
    inputIndexes: number[];
    compressedPublicKey: SECP256K1CompressedPublicKey;
    chainId?: BitcoinChainId;
    sighashTypes?: number[];
  }): Uint8Array[] {
    const tx = BitcoinSigningUtils.psbtTransaction(args.psbtBase64);
    const { scriptCode } = BitcoinSigningUtils.p2wpkhScriptCode(
      args.compressedPublicKey,
      args.chainId ?? BITCOIN_MAINNET_CHAIN_ID,
    );
    return args.inputIndexes.map((index, position) => {
      const input = tx.getInput(index);
      const amount = input.witnessUtxo?.amount;
      if (amount === undefined) {
        throw new OwsInvalidParamsError(`PSBT input ${index} is missing witnessUtxo`);
      }
      return tx.preimageWitnessV0(
        index,
        scriptCode,
        BitcoinSigningUtils.sighashAt(args.sighashTypes, position),
        amount,
      );
    });
  }

  static psbtWithSignatures(args: {
    psbtBase64: Base64String;
    inputIndexes: number[];
    compactSignatures: Uint8Array[];
    compressedPublicKey: SECP256K1CompressedPublicKey;
    sighashTypes?: number[];
  }): Base64String {
    if (args.inputIndexes.length !== args.compactSignatures.length) {
      throw new Error("PSBT signature count does not match the inputs");
    }
    const tx = BitcoinSigningUtils.psbtTransaction(args.psbtBase64);
    const publicKey = BitcoinSigningUtils.keyBytes(args.compressedPublicKey);
    args.inputIndexes.forEach((index, position) => {
      const compact = args.compactSignatures[position]!;
      tx.updateInput(index, {
        partialSig: [
          [
            publicKey,
            BitcoinSigningUtils.derWithSighash(
              compact,
              BitcoinSigningUtils.sighashAt(args.sighashTypes, position),
            ),
          ],
        ],
      });
    });
    return ConversionUtils.bytesToBase64(tx.toPSBT(0));
  }

  /** Finalize a fully signed PSBT into broadcastable raw transaction hex. */
  static finalizePsbt(psbtBase64: Base64String): BitcoinTransactionData {
    const tx = BitcoinSigningUtils.psbtTransaction(psbtBase64);
    tx.finalize();
    return makeBitcoinTransactionData(tx.hex);
  }

  /**
   * Build a P2WPKH payment, including an optional OP_RETURN memo, and return
   * the sighashes plus a function that applies compact signatures.
   */
  static prepareWalletPayment(args: {
    chainId: BitcoinChainId;
    compressedPublicKey: SECP256K1CompressedPublicKey;
    inputs: IWalletPaymentInput[];
    outputs: IWalletPaymentOutput[];
    memo?: Uint8Array;
  }): IPreparedWalletPayment {
    if (args.inputs.length === 0) {
      throw new OwsInvalidParamsError("No Bitcoin UTXOs available");
    }
    const { script, scriptCode } = BitcoinSigningUtils.p2wpkhScriptCode(
      args.compressedPublicKey,
      args.chainId,
    );
    const network = bitcoinNetworkForChainId(args.chainId);
    const hasMemo = Boolean(args.memo && args.memo.length > 0);
    const tx = new btc.Transaction({ allowUnknownOutputs: hasMemo });
    for (const input of args.inputs) {
      tx.addInput({
        txid: ConversionUtils.unprefixedHexToBytes(UnprefixedHexString(input.txid)),
        index: input.vout,
        witnessUtxo: { script, amount: input.valueSats },
      });
    }
    for (const output of args.outputs) {
      tx.addOutputAddress(output.address, output.valueSats, network);
    }
    if (hasMemo) {
      tx.addOutput({
        script: btc.Script.encode(["RETURN", args.memo!]),
        amount: 0n,
      });
    }
    const sighashes = args.inputs.map((input, index) =>
      tx.preimageWitnessV0(index, scriptCode, btc.SigHash.ALL, input.valueSats),
    );
    const publicKey = BitcoinSigningUtils.keyBytes(args.compressedPublicKey);
    return {
      sighashes,
      finish(compactSignatures) {
        if (compactSignatures.length !== args.inputs.length) {
          throw new Error("Bitcoin signature count does not match the inputs");
        }
        compactSignatures.forEach((compact, index) => {
          tx.updateInput(index, {
            partialSig: [
              [
                publicKey,
                BitcoinSigningUtils.derWithSighash(compact, btc.SigHash.ALL),
              ],
            ],
          });
        });
        tx.finalize();
        return {
          rawTransaction: makeBitcoinTransactionData(tx.hex),
          txid: BitcoinTransactionHash(tx.id),
        };
      },
    };
  }

  /** Digest to sign for a BIP-322 simple P2WPKH proof. */
  static bip322SimpleSighash(args: IBip322Message): Uint8Array {
    const { script, scriptCode } = BitcoinSigningUtils.p2wpkhScriptCode(
      args.compressedPublicKey,
      args.chainId,
    );
    const messageHash = BitcoinSigningUtils.taggedSha256(
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

  /** BIP-322 simple proof for this wallet's P2WPKH key. */
  static bip322SimpleProof(
    args: IBip322Message & { compactSignature: Uint8Array },
  ): IBip322Proof {
    const sighash = BitcoinSigningUtils.bip322SimpleSighash(args);
    const witness = BitcoinSigningUtils.encodeWitnessStack([
      BitcoinSigningUtils.derWithSighash(args.compactSignature, btc.SigHash.ALL),
      BitcoinSigningUtils.keyBytes(args.compressedPublicKey),
    ]);
    const ascii = `smp${ConversionUtils.bytesToBase64(witness)}`;
    return {
      signatureHex: ConversionUtils.bytesToUnprefixedHex(
        new TextEncoder().encode(ascii),
      ),
      messageHashHex: ConversionUtils.bytesToUnprefixedHex(sighash),
    };
  }

  private static isAddressOnChain(
    address: BitcoinAddress,
    chainId: BitcoinChainId,
  ): boolean {
    try {
      btc.Address(bitcoinNetworkForChainId(chainId)).decode(address);
      return true;
    } catch {
      return false;
    }
  }

  private static psbtTransaction(psbtBase64: Base64String): btc.Transaction {
    return btc.Transaction.fromPSBT(ConversionUtils.base64ToBytes(psbtBase64));
  }

  private static sighashAt(types: number[] | undefined, position: number): number {
    return types?.[position] ?? btc.SigHash.ALL;
  }

  private static derWithSighash(compact: Uint8Array, sighashType: number): Uint8Array {
    return ConversionUtils.concatBytes(
      secp256k1.Signature.fromCompact(compact).toDERRawBytes(),
      Uint8Array.of(sighashType),
    );
  }

  private static opReturnText(script: Uint8Array): string | undefined {
    let ops: Array<string | number | Uint8Array>;
    try {
      ops = btc.Script.decode(script);
    } catch {
      return undefined;
    }
    if (ops[0] !== "RETURN") return undefined;
    const data = ops.filter((op): op is Uint8Array => op instanceof Uint8Array);
    return data.length > 0
      ? `OP_RETURN ${ConversionUtils.bytesToUnprefixedHex(ConversionUtils.concatBytes(...data))}`
      : "OP_RETURN";
  }

  private static keyBytes(key: SECP256K1CompressedPublicKey): Uint8Array {
    return ConversionUtils.hexToBytes(HexString(key));
  }

  private static p2wpkhScriptCode(
    compressedPublicKey: SECP256K1CompressedPublicKey,
    chainId: BitcoinChainId,
  ): { script: Uint8Array; scriptCode: Uint8Array } {
    const p2w = btc.p2wpkh(
      BitcoinSigningUtils.keyBytes(compressedPublicKey),
      bitcoinNetworkForChainId(chainId),
    );
    if (!p2w.script || !p2w.hash) {
      throw new Error("Bitcoin public key did not produce a native SegWit script");
    }
    return {
      script: p2w.script,
      scriptCode: btc.OutScript.encode({ type: "pkh", hash: p2w.hash }),
    };
  }

  /** BIP-340 tagged hash: `sha256(sha256(tag) || sha256(tag) || message)`. */
  private static taggedSha256(tag: string, message: Uint8Array): Uint8Array {
    const tagHash = sha256(new TextEncoder().encode(tag));
    return sha256(ConversionUtils.concatBytes(tagHash, tagHash, message));
  }

  /** Bitcoin CompactSize; values above 0xffff are not needed here and are refused. */
  private static encodeCompactSize(value: number): Uint8Array {
    if (value < 0xfd) return Uint8Array.of(value);
    if (value <= 0xffff) {
      return Uint8Array.of(0xfd, value & 0xff, (value >> 8) & 0xff);
    }
    throw new Error("Bitcoin CompactSize value is too large");
  }

  private static encodeWitnessStack(items: Uint8Array[]): Uint8Array {
    return ConversionUtils.concatBytes(
      BitcoinSigningUtils.encodeCompactSize(items.length),
      ...items.flatMap((item) => [
        BitcoinSigningUtils.encodeCompactSize(item.length),
        item,
      ]),
    );
  }
}
