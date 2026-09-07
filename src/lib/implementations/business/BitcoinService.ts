import type { BitcoinSegwitAccountAddress } from "@1shotapi/ows-types";
import type {
  IBitcoinBalance,
  IBitcoinRpc,
} from "../../interfaces/data/IBitcoinRpc";
import type {
  IBitcoinSendParams,
  IBitcoinSendResult,
  IBitcoinService,
} from "../../interfaces/business/IBitcoinService";
import type { IOWSProvider } from "../../interfaces/utils/IOWSProvider";
import type { BitcoinUtxo } from "../../types/domain/BitcoinUtxo";
import {
  makeBitcoinSatoshiAmount,
  type BitcoinSatoshiAmount,
} from "../../types/primitives/BitcoinSatoshiAmount";
import { makeBitcoinTransactionData } from "../../types/primitives/BitcoinTransactionData";

/** P2WPKH dust threshold (sats). Change below this is absorbed into the fee. */
const P2WPKH_DUST_SATS = 294n;

/** Approximate virtual bytes: overhead + per-input + per-output (P2WPKH). */
function estimateVSize(inputCount: number, outputCount: number): number {
  return Math.ceil(10.5 + inputCount * 68 + outputCount * 31);
}

function selectLargestFirst(
  utxos: BitcoinUtxo[],
  amountSats: BitcoinSatoshiAmount,
  feeRateSatsPerVByte: number,
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
      const vsize = estimateVSize(selected.length, outputCount);
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
        const vsizeOne = estimateVSize(selected.length, 1);
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

  throw new Error("Insufficient Bitcoin balance for amount and network fee");
}

/**
 * In-wallet Bitcoin balance + send. Coin-selects largest-first, change back to
 * the same static SegWit address, signs via `signer.bitcoin`, broadcasts via RPC.
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
      throw new Error("Amount must be positive");
    }
    if (params.to === params.from) {
      throw new Error("Cannot send Bitcoin to the same address");
    }

    const signer = await this.owsProvider.getSigner();

    const [utxos, feeRate] = await Promise.all([
      this.bitcoinRpc.listUnspent(params.chainId, params.from),
      this.bitcoinRpc.estimateFeeRateSatsPerVByte(params.chainId),
    ]);
    if (utxos.length === 0) {
      throw new Error("No Bitcoin UTXOs available");
    }

    const { inputs, feeSats, changeSats } = selectLargestFirst(
      utxos,
      params.amountSats,
      feeRate,
    );

    const outputs: Array<{
      address: BitcoinSegwitAccountAddress;
      valueSats: BitcoinSatoshiAmount;
    }> = [{ address: params.to, valueSats: params.amountSats }];
    if (changeSats > 0n) {
      outputs.push({ address: params.from, valueSats: changeSats });
    }

    const [signed] = await signer.bitcoin.signTransaction([
      {
        chainId: params.chainId,
        inputs: inputs.map((input) => ({
          txid: input.transactionId,
          vout: input.outputIndex,
          valueSats: input.valueSats,
        })),
        outputs,
      },
    ]);
    if (!signed) {
      throw new Error("Bitcoin signing returned no transaction");
    }

    const rawTransaction = makeBitcoinTransactionData(signed.rawHex);
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
}
