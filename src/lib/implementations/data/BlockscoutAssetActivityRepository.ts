import {
  EVMAccountAddress,
  EVMChainId,
  EVMTransactionHash,
  type EVMAccountAddress as EVMAccountAddressType,
  type EVMChainId as EVMChainIdType,
} from "@1shotapi/ows-types";
import {
  createMemoryStorageBackend,
  type CredentialStorageBackend,
} from "../../../demo/local-storage-store";
import { RELAYER_BASE_URL } from "../../../relayer/constants";
import type {
  IAssetActivityRepository,
  IListAssetActivityParams,
  IRecordSentActivityParams,
} from "../../interfaces/data/IAssetActivityRepository";
import type { IEventBus } from "../../interfaces/utils/IEventBus";
import { AssetActivity } from "../../types/domain/AssetActivity";
import {
  EAssetActivityKind,
  EAssetActivityStatus,
} from "../../types/enum";
import { TransactionHistoryUpdatedEvent } from "../../types/events";
import {
  makeTrackedAssetId,
  type TrackedAssetId,
} from "../../types/primitives";

/** localStorage key for optimistic in-wallet sends. */
export const OWS_ASSET_ACTIVITY_STORAGE_KEY = "ows.asset-activity.v1";

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
  storageKey?: string;
  storage?: CredentialStorageBackend;
  /** Relayer origin (default `RELAYER_BASE_URL`). */
  relayerBaseUrl?: string;
};

const DEFAULT_LIMIT = 10;
const MAX_OPTIMISTIC = 100;

/**
 * ERC-20 activity via the 1Shot relayer (`GET /wallet/activity`, Blockscout-backed),
 * merged with local optimistic sends. Falls back to optimistic rows when the
 * indexer proxy fails.
 */
export class BlockscoutAssetActivityRepository
  implements IAssetActivityRepository
{
  private readonly storageKey: string;
  private readonly storage: CredentialStorageBackend;
  private readonly relayerBaseUrl: string;

  constructor(
    private readonly eventBus: IEventBus,
    options: AssetActivityRepositoryOptions = {},
  ) {
    this.storageKey = options.storageKey ?? OWS_ASSET_ACTIVITY_STORAGE_KEY;
    this.storage =
      options.storage ??
      (typeof localStorage !== "undefined"
        ? localStorage
        : createMemoryStorageBackend());
    this.relayerBaseUrl = (
      options.relayerBaseUrl ?? RELAYER_BASE_URL
    ).replace(/\/$/, "");
  }

  async list(params: IListAssetActivityParams): Promise<AssetActivity[]> {
    const limit = params.limit ?? DEFAULT_LIMIT;
    const { owner, asset } = params;
    const trackedAssetId = asset.id;

    const optimistic = this.readOptimistic()
      .filter(
        (row) =>
          row.chainId === String(asset.chainId) &&
          row.tokenAddress.toLowerCase() === asset.address.toLowerCase() &&
          row.owner.toLowerCase() === owner.toLowerCase(),
      )
      .map((row) => this.optimisticToActivity(row, trackedAssetId));

    let indexed: AssetActivity[] = [];
    try {
      indexed = await this.fetchIndexed({
        owner,
        chainId: asset.chainId,
        tokenAddress: asset.address,
        decimals: asset.decimals,
        trackedAssetId,
        limit,
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
      ...this.readOptimistic().filter(
        (row) => row.hash.toLowerCase() !== stored.hash.toLowerCase(),
      ),
    ].slice(0, MAX_OPTIMISTIC);
    this.writeOptimistic(next);

    const activity = this.optimisticToActivity(stored, trackedAssetId);
    this.eventBus.emit(new TransactionHistoryUpdatedEvent(trackedAssetId));
    return activity;
  }

  private async fetchIndexed(args: {
    owner: EVMAccountAddressType;
    chainId: EVMChainIdType;
    tokenAddress: EVMAccountAddressType;
    decimals: number;
    trackedAssetId: TrackedAssetId;
    limit: number;
  }): Promise<AssetActivity[]> {
    // Over-fetch so client-side token filtering still yields `limit` rows.
    const pageSize = Math.min(Math.max(args.limit * 5, args.limit), 100);
    const url = new URL(`${this.relayerBaseUrl}/wallet/activity`);
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
      owner: EVMAccountAddressType;
      chainId: EVMChainIdType;
      tokenAddress: EVMAccountAddressType;
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
    let counterparty: EVMAccountAddressType;
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
      EVMChainId(row.chainId as `0x${string}`),
      EVMAccountAddress(row.tokenAddress as `0x${string}`),
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

  private readOptimistic(): StoredOptimistic[] {
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as StoredBlob;
      return Array.isArray(parsed.optimistic) ? parsed.optimistic : [];
    } catch {
      return [];
    }
  }

  private writeOptimistic(rows: StoredOptimistic[]): void {
    const blob: StoredBlob = { optimistic: rows };
    this.storage.setItem(this.storageKey, JSON.stringify(blob));
  }
}
