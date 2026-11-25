import { compressSecp256k1PublicKey } from "@1shotapi/ows-signer-utils";
import {
  ConversionUtils,
  HexString,
  OwsInvalidParamsError,
  type BitcoinSegwitAccountAddress,
} from "@1shotapi/ows-types";

import { secpKeyForAddress } from "../../../wallet/hydrateBitcoinAddresses";
import type {
  IBitcoinSendParams,
  IBitcoinSendQuote,
  IBitcoinSendResult,
  IBitcoinService,
} from "../../interfaces/business/IBitcoinService";
import type {
  IBitcoinBalance,
  IBitcoinRpc,
} from "../../interfaces/data/IBitcoinRpc";
import type { IOWSProvider } from "../../interfaces/utils/IOWSProvider";
import type { BitcoinUtxo } from "../../types/domain/BitcoinUtxo";
import {
  makeBitcoinSatoshiAmount,
  type BitcoinSatoshiAmount,
} from "../../types/primitives/BitcoinSatoshiAmount";
import type { BitcoinTransactionData } from "../../types/primitives/BitcoinTransactionData";
import { BitcoinSigningUtils } from "../utils/BitcoinSigningUtils";

/** P2WPKH dust threshold (sats). Change below this is absorbed into the fee. */
const P2WPKH_DUST_SATS = 294n;

/** Approximate virtual bytes: overhead + per-input + per-output (P2WPKH) + memo. */
function estimateVSize(
  inputCount: number,
  outputCount: number,
  memoBytes: number,
): number {
  const memoVBytes = memoBytes > 0 ? 10 + memoBytes : 0;
  return Math.ceil(10.5 + inputCount * 68 + outputCount * 31 + memoVBytes);
}

function selectLargestFirst(
  utxos: BitcoinUtxo[],
  amountSats: BitcoinSatoshiAmount,
  feeRateSatsPerVByte: number,
  memoBytes = 0,
): {
  inputs: BitcoinUtxo[];
  feeSats: BitcoinSatoshiAmount;
  changeSats: BitcoinSatoshiAmount;
} {
  const sorted = [...utxos].sort((a, b) =>
    a.valueSats === b.valueSats ? 0 : a.valueSats > b.valueSats ? -1 : 1,
  );

  const selected: BitcoinUtxo[] = [];
  let total = 0n;

  for (const utxo of sorted) {
    selected.push(utxo);
    total += utxo.valueSats;

    for (const outputCount of [2, 1] as const) {
      const vsize = estimateVSize(selected.length, outputCount, memoBytes);
      let feeSats = BigInt(Math.ceil(vsize * feeRateSatsPerVByte));
      if (total < amountSats + feeSats) {
        continue;
      }
      let changeSats = total - amountSats - feeSats;
      if (outputCount === 2 && changeSats > 0n && changeSats < P2WPKH_DUST_SATS) {
        feeSats += changeSats;
        changeSats = 0n;
      }
      if (outputCount === 2 && changeSats === 0n) {
        // Recalculate fee for a single-output tx once change is dust-absorbed.
        const vsizeOne = estimateVSize(selected.length, 1, memoBytes);
        feeSats = BigInt(Math.ceil(vsizeOne * feeRateSatsPerVByte));
        if (total < amountSats + feeSats) {
          continue;
        }
        const leftover = total - amountSats - feeSats;
        return {
          inputs: selected,
          feeSats: makeBitcoinSatoshiAmount(feeSats + leftover),
          changeSats: makeBitcoinSatoshiAmount(0n),
        };
      }
      if (outputCount === 1) {
        const leftover = total - amountSats - feeSats;
        return {
          inputs: selected,
          feeSats: makeBitcoinSatoshiAmount(feeSats + leftover),
          changeSats: makeBitcoinSatoshiAmount(0n),
        };
      }
      return {
        inputs: selected,
        feeSats: makeBitcoinSatoshiAmount(feeSats),
        changeSats: makeBitcoinSatoshiAmount(changeSats),
      };
    }
  }

  throw new OwsInvalidParamsError(
    "Insufficient Bitcoin balance for amount and network fee",
  );
}

/**
 * In-wallet Bitcoin balance + send. Coin-selects largest-first, signs the
 * P2WPKH payment locally, and broadcasts via RPC.
 */
export class BitcoinService implements IBitcoinService {
  constructor(
    protected readonly bitcoinRpc: IBitcoinRpc,
    protected readonly owsProvider: IOWSProvider,
  ) {}

  getBalance(
    chainId: IBitcoinSendParams["chainId"],
    address: BitcoinSegwitAccountAddress,
  ): Promise<IBitcoinBalance> {
    return this.bitcoinRpc.getBalance(chainId, address);
  }

  async send(params: IBitcoinSendParams): Promise<IBitcoinSendResult> {
    if (params.amountSats <= 0n) {
      throw new OwsInvalidParamsError("Amount must be positive");
    }
    BitcoinSigningUtils.assertAddress(params.to, params.chainId);
    if (BitcoinSigningUtils.sameAddress(params.to, params.from)) {
      throw new OwsInvalidParamsError("Cannot send Bitcoin to the same address");
    }
    const changeAddress = params.changeAddress ?? params.from;
    BitcoinSigningUtils.assertAddress(changeAddress, params.chainId);

    const signer = await this.owsProvider.getSigner();
    const key = await secpKeyForAddress(signer, params.chainId, params.from);
    if (!BitcoinSigningUtils.sameAddress(key.address, params.from)) {
      throw new OwsInvalidParamsError("Bitcoin account is not this wallet");
    }
    const publicKey = key.publicKey;

    const [utxos, feeRate] = await Promise.all([
      this.bitcoinRpc.listUnspent(params.chainId, params.from),
      this.bitcoinRpc.estimateFeeRateSatsPerVByte(params.chainId),
    ]);
    if (utxos.length === 0) {
      throw new OwsInvalidParamsError("No Bitcoin UTXOs available");
    }

    const memo = params.memo ?? new Uint8Array();
    const { inputs, feeSats, changeSats } = selectLargestFirst(
      utxos,
      params.amountSats,
      feeRate,
      memo.length,
    );
    const quote: IBitcoinSendQuote = {
      feeSats,
      changeSats,
      ...(changeSats > 0n ? { changeAddress } : {}),
    };
    if (params.confirmSpend) {
      await params.confirmSpend(quote);
    }

    const prepared = BitcoinSigningUtils.prepareWalletPayment({
      chainId: params.chainId,
      compressedPublicKey: compressSecp256k1PublicKey(publicKey),
      inputs: inputs.map((input) => ({
        txid: input.transactionId,
        vout: input.outputIndex,
        valueSats: input.valueSats,
      })),
      outputs: [
        { address: params.to, valueSats: params.amountSats },
        ...(changeSats > 0n
          ? [{ address: changeAddress, valueSats: changeSats }]
          : []),
      ],
      ...(memo.length > 0 ? { memo } : {}),
    });
    const signed = await signer.signDigest(
      prepared.sighashes.map((sighash) => ({
        digestData: ConversionUtils.bytesToHex(sighash),
        scheme: "secp256k1-ecdsa" as const,
      })),
    );
    const finished = prepared.finish(
      signed.map((result) =>
        ConversionUtils.hexToBytes(HexString(result.signature)),
      ),
    );
    const { rawTransaction } = finished;
    const txid = await this.bitcoinRpc.sendRawTransaction(
      params.chainId,
      rawTransaction,
    );

    return {
      txid,
      feeSats,
      rawTransaction,
    };
  }

  broadcast(
    chainId: IBitcoinSendParams["chainId"],
    rawTransaction: BitcoinTransactionData,
  ): Promise<IBitcoinSendResult["txid"]> {
    return this.bitcoinRpc.sendRawTransaction(chainId, rawTransaction);
  }
}
