import {
  SolanaAddressUtils,
  type SolanaAccountAddress,
  type SolanaATAAddress,
  type SolanaMintAddress,
  type SolanaTransactionHash,
} from "@1shotapi/ows-types";

import type { ISolanaParsedTransaction } from "../../../interfaces/data/ISolanaRpc";
import { EAssetActivityKind } from "../../../types/enum/EAssetActivityKind";

export interface ISolanaAtaTransferDelta {
  hash: SolanaTransactionHash;
  amount: bigint;
  decimals: number;
  kind: EAssetActivityKind;
  counterparty: SolanaAccountAddress;
  timestampMs: number;
}

/**
 * SPL token-balance helpers for jsonParsed Solana transactions (ATA activity).
 */
export class SolanaTokenUtils {
  /**
   * Derive a single SPL transfer row for `ata` from pre/post token balances.
   * Returns null when the ATA balance is unchanged or the tx failed.
   */
  static parseAtaTransferDelta(
    tx: ISolanaParsedTransaction,
    ata: SolanaATAAddress,
    mint: SolanaMintAddress,
    owner: SolanaAccountAddress,
  ): ISolanaAtaTransferDelta | null {
    if (tx.err != null) {
      return null;
    }
    const ataKey = String(ata);
    const mintKey = String(mint);
    const ownerKey = String(owner);

    const pre = SolanaTokenUtils.findAtaBalance(
      tx.preTokenBalances,
      ataKey,
      mintKey,
      ownerKey,
    );
    const post = SolanaTokenUtils.findAtaBalance(
      tx.postTokenBalances,
      ataKey,
      mintKey,
      ownerKey,
    );
    const preAmount = pre?.amount ?? 0n;
    const postAmount = post?.amount ?? 0n;
    const delta = postAmount - preAmount;
    if (delta === 0n) {
      return null;
    }

    const decimals = post?.decimals ?? pre?.decimals ?? 0;
    const kind =
      delta > 0n ? EAssetActivityKind.Received : EAssetActivityKind.Sent;
    const absAmount = delta > 0n ? delta : -delta;

    const counterparty = SolanaTokenUtils.resolveCounterparty(
      tx,
      ataKey,
      mintKey,
      ownerKey,
      kind,
    );

    const timestampMs =
      tx.blockTime != null && tx.blockTime > 0 ? tx.blockTime * 1000 : 0;

    return {
      hash: tx.signature,
      amount: absAmount,
      decimals,
      kind,
      counterparty,
      timestampMs,
    };
  }

  private static findAtaBalance(
    rows: ISolanaParsedTransaction["preTokenBalances"],
    ataKey: string,
    mintKey: string,
    ownerKey: string,
  ) {
    return (
      rows.find(
        (row) =>
          row.mint === mintKey &&
          (row.accountAddress === ataKey || row.owner === ownerKey),
      ) ?? null
    );
  }

  private static resolveCounterparty(
    tx: ISolanaParsedTransaction,
    ataKey: string,
    mintKey: string,
    ownerKey: string,
    kind: EAssetActivityKind,
  ): SolanaAccountAddress {
    const pool =
      kind === EAssetActivityKind.Received
        ? tx.preTokenBalances
        : tx.postTokenBalances;
    for (const row of pool) {
      if (row.mint !== mintKey) continue;
      if (row.accountAddress === ataKey) continue;
      if (row.owner && row.owner !== ownerKey) {
        try {
          return SolanaAddressUtils.asAccountAddress(row.owner);
        } catch {
          // keep scanning
        }
      }
    }
    for (const row of [
      ...tx.preTokenBalances,
      ...tx.postTokenBalances,
    ]) {
      if (row.mint !== mintKey) continue;
      if (row.accountAddress === ataKey) continue;
      if (row.owner && row.owner !== ownerKey) {
        try {
          return SolanaAddressUtils.asAccountAddress(row.owner);
        } catch {
          // keep scanning
        }
      }
    }
    // Fallback: self (UI still shows a row; peer truncated as own address rare).
    return SolanaAddressUtils.asAccountAddress(ownerKey);
  }
}
