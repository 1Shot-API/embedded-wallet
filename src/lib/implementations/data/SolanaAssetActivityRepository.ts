import {
  ChainUtils,
  parseTransactionHash,
  SolanaAddressUtils,
  SolanaTransactionHash,
  type SolanaAccountAddress,
  type SolanaATAAddress,
  type SolanaChainId,
  type SolanaMintAddress,
} from "@1shotapi/ows-types";

import type {
  IAssetActivityRepository,
  IListAssetActivityParams,
  IRecordSentActivityParams,
} from "../../interfaces/data/IAssetActivityRepository";
import type { ISolanaRpc } from "../../interfaces/data/ISolanaRpc";
import type { IConfigProvider } from "../../interfaces/utils/IConfigProvider";
import type { IEventBus } from "../../interfaces/utils/IEventBus";
import { AssetActivity } from "../../types/domain/AssetActivity";
import { EAssetActivityKind } from "../../types/enum/EAssetActivityKind";
import { EAssetActivityStatus } from "../../types/enum/EAssetActivityStatus";
import { EAssetType } from "../../types/enum/EAssetType";
import { TransactionHistoryUpdatedEvent } from "../../types/events/TransactionHistoryUpdatedEvent";
import {
  makeTrackedAssetId,
  type TrackedAssetId,
} from "../../types/primitives";
import {
  createIdbKvBackend,
  createMemoryAsyncKvStore,
  migrateLocalStorageKeyToIdb,
  type AsyncKvStore,
} from "../../utils/idbStringStore";

import { SolanaTokenUtils } from "./utils/SolanaTokenUtils";

type StoredOptimistic = {
  hash: string;
  chainId: string;
  tokenAddress: string;
  owner: string;
  counterparty: string;
  amount: string;
  decimals: number;
  timestampMs: number;
};

type StoredBlob = {
  optimistic: StoredOptimistic[];
};

export type SolanaAssetActivityRepositoryOptions = {
  storage?: AsyncKvStore;
};

/**
 * SPL token activity via Alchemy (ATA signatures + jsonParsed balance deltas),
 * merged with local optimistic sends. Native SOL returns optimistic-only.
 */
export class SolanaAssetActivityRepository implements IAssetActivityRepository {
  private readonly storage: AsyncKvStore;
  private readonly migratedKeys = new Set<string>();

  constructor(
    private readonly solanaRpc: ISolanaRpc,
    private readonly eventBus: IEventBus,
    private readonly configProvider: IConfigProvider,
    options: SolanaAssetActivityRepositoryOptions = {},
  ) {
    this.storage =
      options.storage ??
      (typeof indexedDB !== "undefined"
        ? createIdbKvBackend()
        : createMemoryAsyncKvStore());
  }

  async list(params: IListAssetActivityParams): Promise<AssetActivity[]> {
    if (!ChainUtils.isSolanaChainId(params.asset.chainId)) {
      return [];
    }
    const config = await this.configProvider.getConfig();
    const limit = params.limit ?? config.assetActivityDefaultLimit;
    const { owner, asset } = params;
    const trackedAssetId = asset.id;
    const chainId = ChainUtils.asSolanaChainId(asset.chainId);
    const solOwner = SolanaAddressUtils.asAccountAddress(String(owner));

    const optimistic: AssetActivity[] = [];
    for (const row of await this.readOptimistic(config.assetActivityStorageKey)) {
      if (
        row.chainId === String(asset.chainId) &&
        row.tokenAddress === String(asset.address) &&
        row.owner === String(owner)
      ) {
        const activity = this.optimisticToActivity(row, trackedAssetId);
        if (activity) {
          optimistic.push(activity);
        }
      }
    }

    let indexed: AssetActivity[] = [];
    if (asset.type === EAssetType.Spl && asset.ataAddress) {
      try {
        indexed = await this.fetchAtaActivity({
          chainId,
          owner: solOwner,
          ata: asset.ataAddress,
          mint: asset.address as SolanaMintAddress,
          decimals: asset.decimals,
          trackedAssetId,
          limit,
        });
      } catch (error: unknown) {
        console.warn(
          "[asset-activity] Solana ATA activity unavailable; using local history",
          error,
        );
      }
    }

    const indexedHashes = new Set(indexed.map((row) => String(row.hash)));
    const pendingOptimistic = optimistic.filter(
      (row) => !indexedHashes.has(String(row.hash)),
    );

    const merged = [...pendingOptimistic, ...indexed].sort(
      (a, b) => b.timestampMs - a.timestampMs,
    );
    return merged.slice(0, limit);
  }

  async recordSent(
    params: IRecordSentActivityParams,
  ): Promise<AssetActivity> {
    if (!ChainUtils.isSolanaChainId(params.chainId)) {
      throw new Error("Solana activity repository only records Solana sends");
    }
    const config = await this.configProvider.getConfig();
    const trackedAssetId = makeTrackedAssetId(
      params.chainId,
      params.tokenAddress,
    );
    const stored: StoredOptimistic = {
      hash: String(params.hash),
      chainId: String(params.chainId),
      tokenAddress: String(params.tokenAddress),
      owner: String(params.owner),
      counterparty: String(params.to),
      amount: params.amount.toString(),
      decimals: params.decimals,
      timestampMs: Date.now(),
    };

    const next = [
      stored,
      ...(await this.readOptimistic(config.assetActivityStorageKey)).filter(
        (row) => row.hash !== stored.hash,
      ),
    ].slice(0, config.assetActivityMaxOptimistic);
    await this.writeOptimistic(config.assetActivityStorageKey, next);

    const activity = this.optimisticToActivity(stored, trackedAssetId);
    if (!activity) {
      throw new Error("Failed to brand optimistic Solana activity");
    }
    this.eventBus.emit(new TransactionHistoryUpdatedEvent(trackedAssetId));
    return activity;
  }

  private async fetchAtaActivity(args: {
    chainId: SolanaChainId;
    owner: SolanaAccountAddress;
    ata: SolanaATAAddress;
    mint: SolanaMintAddress;
    decimals: number;
    trackedAssetId: TrackedAssetId;
    limit: number;
  }): Promise<AssetActivity[]> {
    // Over-fetch signatures; many are rent/ATA noise with zero mint delta.
    const signatureLimit = Math.min(Math.max(args.limit * 5, args.limit), 40);
    const signatures = await this.solanaRpc.getSignaturesForAddress(
      args.chainId,
      args.ata,
      signatureLimit,
    );

    const byHash = new Map<string, AssetActivity>();
    for (const info of signatures) {
      if (byHash.size >= args.limit) break;
      if (info.err != null) continue;
      const fetched = await this.solanaRpc.getParsedTransaction(
        args.chainId,
        info.signature,
      );
      if (!fetched) continue;
      const tx =
        fetched.blockTime == null && info.blockTime != null
          ? { ...fetched, blockTime: info.blockTime }
          : fetched;
      const delta = SolanaTokenUtils.parseAtaTransferDelta(
        tx,
        args.ata,
        args.mint,
        args.owner,
      );
      if (!delta) continue;
      const activity = new AssetActivity(
        delta.hash,
        args.chainId,
        args.mint,
        args.trackedAssetId,
        args.owner,
        delta.counterparty,
        delta.amount,
        delta.decimals || args.decimals,
        delta.kind,
        EAssetActivityStatus.Confirmed,
        delta.timestampMs,
      );
      byHash.set(String(activity.hash), activity);
    }

    return [...byHash.values()].sort(
      (a, b) => b.timestampMs - a.timestampMs,
    );
  }

  private optimisticToActivity(
    row: StoredOptimistic,
    trackedAssetId: TrackedAssetId,
  ): AssetActivity | null {
    const hash =
      parseTransactionHash(row.hash) ??
      SolanaTransactionHash(row.hash);
    try {
      return new AssetActivity(
        hash,
        ChainUtils.asSolanaChainId(row.chainId),
        SolanaAddressUtils.asMintAddress(row.tokenAddress),
        trackedAssetId,
        SolanaAddressUtils.asAccountAddress(row.owner),
        SolanaAddressUtils.asAccountAddress(row.counterparty),
        BigInt(row.amount),
        row.decimals,
        EAssetActivityKind.Sent,
        EAssetActivityStatus.Pending,
        row.timestampMs,
      );
    } catch {
      return null;
    }
  }

  private async ensureMigrated(storageKey: string): Promise<void> {
    if (this.migratedKeys.has(storageKey)) return;
    await migrateLocalStorageKeyToIdb(this.storage, storageKey);
    this.migratedKeys.add(storageKey);
  }

  private async readOptimistic(storageKey: string): Promise<StoredOptimistic[]> {
    await this.ensureMigrated(storageKey);
    try {
      const raw = await this.storage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as StoredBlob;
      return Array.isArray(parsed.optimistic) ? parsed.optimistic : [];
    } catch {
      return [];
    }
  }

  private async writeOptimistic(
    storageKey: string,
    rows: StoredOptimistic[],
  ): Promise<void> {
    await this.ensureMigrated(storageKey);
    const blob: StoredBlob = { optimistic: rows };
    await this.storage.setItem(storageKey, JSON.stringify(blob));
  }
}
