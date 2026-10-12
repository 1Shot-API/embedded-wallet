import {
  ChainUtils,
  EVMAccountAddress,
  EVMContractAddress,
  EVMTransactionHash,
  type EVMChainId,
  type UriString,
} from "@1shotapi/ows-types";
import { getAddress } from "viem";

import type {
  IAssetActivityRepository,
  IListAssetActivityParams,
  IRecordSentActivityParams,
} from "../../interfaces/data/IAssetActivityRepository";
import type { IConfigProvider } from "../../interfaces/utils/IConfigProvider";
import type { IEventBus } from "../../interfaces/utils/IEventBus";
import { AssetActivity } from "../../types/domain/AssetActivity";
import { EAssetActivityKind } from "../../types/enum/EAssetActivityKind";
import { EAssetActivityStatus } from "../../types/enum/EAssetActivityStatus";
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

/** Relayer `GET /wallet/activity` transfer row. */
type RelayerActivityTransfer = {
  hash?: string;
  from?: string;
  to?: string;
  value?: string;
  contractAddress?: string;
  tokenDecimal?: number;
  timestamp?: number;
};

type RelayerActivityPagedResponse = {
  response?: RelayerActivityTransfer[];
  page?: number;
  pageSize?: number;
  totalResults?: number;
};

export type AssetActivityRepositoryOptions = {
  storage?: AsyncKvStore;
};

/**
 * ERC-20 activity via the 1Shot relayer (`GET /wallet/activity`, Blockscout-backed),
 * merged with local optimistic sends. Falls back to optimistic rows when the
 * indexer proxy fails.
 */
export class BlockscoutAssetActivityRepository
  implements IAssetActivityRepository
{
  private readonly storage: AsyncKvStore;
  private readonly migratedKeys = new Set<string>();

  constructor(
    private readonly eventBus: IEventBus,
    private readonly configProvider: IConfigProvider,
    options: AssetActivityRepositoryOptions = {},
  ) {
    this.storage =
      options.storage ??
      (typeof indexedDB !== "undefined"
        ? createIdbKvBackend()
        : createMemoryAsyncKvStore());
  }

  async list(params: IListAssetActivityParams): Promise<AssetActivity[]> {
    const config = await this.configProvider.getConfig();
    const limit = params.limit ?? config.assetActivityDefaultLimit;
    const { owner, asset } = params;
    const trackedAssetId = asset.id;

    const optimistic: AssetActivity[] = [];
    for (const row of await this.readOptimistic(config.assetActivityStorageKey)) {
      if (
        row.chainId === String(asset.chainId) &&
        row.tokenAddress.toLowerCase() === asset.address.toLowerCase() &&
        row.owner.toLowerCase() === owner.toLowerCase()
      ) {
        optimistic.push(this.optimisticToActivity(row, trackedAssetId));
      }
    }

    let indexed: AssetActivity[] = [];
    try {
      indexed = await this.fetchIndexed({
        owner,
        chainId: asset.chainId,
        tokenAddress: asset.address,
        decimals: asset.decimals,
        trackedAssetId,
        limit,
        relayerBaseUrl: config.relayerBaseUrl,
      });
    } catch (error: unknown) {
      console.warn(
        "[asset-activity] Relayer activity unavailable; using local history",
        error,
      );
    }

    const indexedHashes = new Set(
      indexed.map((row) => String(row.hash).toLowerCase()),
    );
    const pendingOptimistic = optimistic.filter(
      (row) => !indexedHashes.has(String(row.hash).toLowerCase()),
    );

    const merged = [...pendingOptimistic, ...indexed].sort(
      (a, b) => b.timestampMs - a.timestampMs,
    );

    return merged.slice(0, limit);
  }

  async recordSent(
    params: IRecordSentActivityParams,
  ): Promise<AssetActivity> {
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
      ...(
        await this.readOptimistic(config.assetActivityStorageKey)
      ).filter(
        (row) => row.hash.toLowerCase() !== stored.hash.toLowerCase(),
      ),
    ].slice(0, config.assetActivityMaxOptimistic);
    await this.writeOptimistic(config.assetActivityStorageKey, next);

    const activity = this.optimisticToActivity(stored, trackedAssetId);
    this.eventBus.emit(new TransactionHistoryUpdatedEvent(trackedAssetId));
    return activity;
  }

  private async fetchIndexed(args: {
    owner: EVMAccountAddress;
    chainId: EVMChainId;
    tokenAddress: EVMContractAddress;
    decimals: number;
    trackedAssetId: TrackedAssetId;
    limit: number;
    relayerBaseUrl: UriString;
  }): Promise<AssetActivity[]> {
    // Over-fetch so client-side token filtering still yields `limit` rows.
    const pageSize = Math.min(Math.max(args.limit * 5, args.limit), 100);
    const url = new URL(`${args.relayerBaseUrl}/wallet/activity`);
    url.searchParams.set("chainid", String(args.chainId));
    url.searchParams.set("accountAddress", String(args.owner));
    url.searchParams.set("page", "1");
    url.searchParams.set("pageSize", String(pageSize));

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Relayer activity HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
      );
    }

    const payload = (await response.json()) as RelayerActivityPagedResponse;
    const rows = Array.isArray(payload.response) ? payload.response : [];
    const byHash = new Map<string, AssetActivity>();

    for (const row of rows) {
      const activity = this.transferToActivity(row, args);
      if (!activity) {
        continue;
      }
      const key = String(activity.hash).toLowerCase();
      if (!byHash.has(key)) {
        byHash.set(key, activity);
      }
    }

    return [...byHash.values()]
      .sort((a, b) => b.timestampMs - a.timestampMs)
      .slice(0, args.limit);
  }

  private transferToActivity(
    transfer: RelayerActivityTransfer,
    args: {
      owner: EVMAccountAddress;
      chainId: EVMChainId;
      tokenAddress: EVMContractAddress;
      decimals: number;
      trackedAssetId: TrackedAssetId;
    },
  ): AssetActivity | null {
    const hash = transfer.hash;
    const from = transfer.from;
    const to = transfer.to;
    if (!hash || !from || !to) {
      return null;
    }

    if (transfer.contractAddress) {
      if (
        transfer.contractAddress.toLowerCase() !==
        String(args.tokenAddress).toLowerCase()
      ) {
        return null;
      }
    }

    if (!transfer.value) {
      return null;
    }
    let amount: bigint;
    try {
      amount = BigInt(transfer.value);
    } catch {
      return null;
    }
    if (amount <= 0n) {
      return null;
    }

    let decimals = args.decimals;
    if (transfer.tokenDecimal != null) {
      const parsed = Number(transfer.tokenDecimal);
      if (Number.isFinite(parsed)) {
        decimals = parsed;
      }
    }

    const ownerLower = String(args.owner).toLowerCase();
    const fromLower = from.toLowerCase();
    const toLower = to.toLowerCase();
    let kind: EAssetActivityKind;
    let counterparty: EVMAccountAddress;
    if (fromLower === ownerLower) {
      kind = EAssetActivityKind.Sent;
      counterparty = EVMAccountAddress(to as `0x${string}`);
    } else if (toLower === ownerLower) {
      kind = EAssetActivityKind.Received;
      counterparty = EVMAccountAddress(from as `0x${string}`);
    } else {
      return null;
    }

    return new AssetActivity(
      EVMTransactionHash(hash as `0x${string}`),
      args.chainId,
      args.tokenAddress,
      args.trackedAssetId,
      args.owner,
      counterparty,
      amount,
      decimals,
      kind,
      EAssetActivityStatus.Confirmed,
      this.resolveTimestampMs(transfer.timestamp),
    );
  }

  /** Relayer timestamps are unix seconds. */
  private resolveTimestampMs(unixSeconds: number | undefined): number {
    if (unixSeconds == null) {
      return 0;
    }
    const seconds = Number(unixSeconds);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return 0;
    }
    return Math.trunc(seconds * 1000);
  }

  private optimisticToActivity(
    row: StoredOptimistic,
    trackedAssetId: TrackedAssetId,
  ): AssetActivity {
    return new AssetActivity(
      EVMTransactionHash(row.hash as `0x${string}`),
      ChainUtils.asEVMChainId(row.chainId),
      EVMContractAddress(getAddress(row.tokenAddress)),
      trackedAssetId,
      EVMAccountAddress(row.owner as `0x${string}`),
      EVMAccountAddress(row.counterparty as `0x${string}`),
      BigInt(row.amount),
      row.decimals,
      EAssetActivityKind.Sent,
      EAssetActivityStatus.Pending,
      row.timestampMs,
    );
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
      if (!raw) {
        return [];
      }
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
