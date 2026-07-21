import { erc20Abi, type Address } from "viem";
import {
  EVMAccountAddress,
  EVMChainId,
  type EVMAccountAddress as EVMAccountAddressType,
  type EVMChainId as EVMChainIdType,
} from "@1shotapi/ows-types";
import type { IBlockchainProvider } from "@1shotapi/ows-wallet-utils";
import {
  createMemoryStorageBackend,
  type CredentialStorageBackend,
} from "../../../demo/local-storage-store";
import type { IEventBus } from "../../interfaces/utils/IEventBus";
import type { ITrackedAssetRepository } from "../../interfaces/data/ITrackedAssetRepository";
import {
  DEFAULT_TRACKED_USDC,
  isDefaultTrackedUsdc,
} from "./HardcodedKnownAssetRepository";
import { NewTrackedAsset, TrackedAsset } from "../../types/domain";
import { EAssetType } from "../../types/enum";
import { BalanceUpdatedEvent } from "../../types/events";
import {
  makeTrackedAssetId,
  type TrackedAssetId,
} from "../../types/primitives";

/** localStorage key for user-tracked assets (defaults like USDC are merged in). */
export const OWS_TRACKED_ASSETS_STORAGE_KEY = "ows.tracked-assets.v2";

type StoredBlob = {
  assets: Array<{
    chainId: string;
    address: string;
    type: string;
    name: string;
    symbol: string;
    decimals: number;
    id: string;
  }>;
};

export type TrackedAssetRepositoryOptions = {
  storageKey?: string;
  storage?: CredentialStorageBackend;
};

const EMPTY_OWNER = EVMAccountAddress("0x0");

export class LocalStorageTrackedAssetRepository
  implements ITrackedAssetRepository
{
  private readonly storageKey: string;
  private readonly storage: CredentialStorageBackend;
  private readonly balanceCache = new Map<TrackedAssetId, bigint>();

  constructor(
    private readonly blockchain: IBlockchainProvider,
    private readonly eventBus: IEventBus,
    options: TrackedAssetRepositoryOptions = {},
  ) {
    this.storageKey = options.storageKey ?? OWS_TRACKED_ASSETS_STORAGE_KEY;
    this.storage =
      options.storage ??
      (typeof localStorage !== "undefined"
        ? localStorage
        : createMemoryStorageBackend());
  }

  async list(owner: EVMAccountAddressType): Promise<TrackedAsset[]> {
    const assets = this.mergeWithDefaults(this.readStoredAssets());
    return this.ensureBalances(assets, owner, false);
  }

  async has(
    chainId: EVMChainIdType,
    address: EVMAccountAddressType,
  ): Promise<boolean> {
    if (isDefaultTrackedUsdc(chainId, address)) {
      return true;
    }
    const key = makeTrackedAssetId(chainId, address);
    return this.readStoredAssets().some((asset) => asset.id === key);
  }

  async add(
    asset: NewTrackedAsset,
    owner: EVMAccountAddressType,
  ): Promise<TrackedAsset> {
    if (isDefaultTrackedUsdc(asset.chainId, asset.address)) {
      const existing = TrackedAsset.fromNew(asset);
      const [withBalance] = await this.ensureBalances([existing], owner, false);
      return withBalance!;
    }

    const assets = this.readStoredAssets();
    const key = makeTrackedAssetId(asset.chainId, asset.address);
    const found = assets.find((a) => a.id === key);
    if (found) {
      const [withBalance] = await this.ensureBalances([found], owner, false);
      return withBalance!;
    }

    const tracked = TrackedAsset.fromNew(asset);
    assets.push(tracked);
    this.writeAssets(assets);
    const [withBalance] = await this.ensureBalances([tracked], owner, false);
    return withBalance!;
  }

  async remove(
    chainId: EVMChainIdType,
    address: EVMAccountAddressType,
  ): Promise<void> {
    if (isDefaultTrackedUsdc(chainId, address)) {
      return;
    }
    const key = makeTrackedAssetId(chainId, address);
    const next = this.readStoredAssets().filter((asset) => asset.id !== key);
    this.writeAssets(next);
    this.balanceCache.delete(key);
  }

  async getBalances(
    owner: EVMAccountAddressType,
    id?: TrackedAssetId,
  ): Promise<TrackedAsset[]> {
    if (id) {
      this.balanceCache.delete(id);
    } else {
      this.balanceCache.clear();
    }
    const assets = this.mergeWithDefaults(this.readStoredAssets());
    const targets = id ? assets.filter((asset) => asset.id === id) : assets;
    return this.ensureBalances(targets, owner, true);
  }

  private mergeWithDefaults(stored: TrackedAsset[]): TrackedAsset[] {
    const seen = new Set<TrackedAssetId>();
    const merged: TrackedAsset[] = [];
    for (const asset of DEFAULT_TRACKED_USDC) {
      const key = makeTrackedAssetId(asset.chainId, asset.address);
      seen.add(key);
      merged.push(TrackedAsset.fromNew(asset));
    }
    for (const asset of stored) {
      if (seen.has(asset.id)) continue;
      seen.add(asset.id);
      merged.push(asset);
    }
    return merged;
  }

  private async ensureBalances(
    assets: TrackedAsset[],
    owner: EVMAccountAddressType,
    forceEmit: boolean,
  ): Promise<TrackedAsset[]> {
    let anyFetched = forceEmit;
    const result: TrackedAsset[] = [];

    for (const asset of assets) {
      if (this.balanceCache.has(asset.id)) {
        result.push(asset.withBalance(this.balanceCache.get(asset.id)!));
        continue;
      }

      anyFetched = true;
      const balance = await this.fetchBalance(asset, owner);
      if (balance !== null) {
        this.balanceCache.set(asset.id, balance);
      }
      result.push(asset.withBalance(balance));
    }

    if (anyFetched && result.length > 0) {
      this.eventBus.emit(new BalanceUpdatedEvent(result));
    }
    return result;
  }

  private async fetchBalance(
    asset: TrackedAsset,
    owner: EVMAccountAddressType,
  ): Promise<bigint | null> {
    if (asset.type !== EAssetType.Erc20) {
      return null;
    }
    if (owner === EMPTY_OWNER) {
      return null;
    }
    try {
      const client = this.blockchain.getPublicClient(asset.chainId);
      return await client.readContract({
        address: asset.address as Address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [owner as Address],
      });
    } catch (error: unknown) {
      console.warn("[balances] balanceOf failed", error);
      return null;
    }
  }

  private readStoredAssets(): TrackedAsset[] {
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as StoredBlob;
      if (!parsed || !Array.isArray(parsed.assets)) return [];
      return parsed.assets
        .filter(
          (row) =>
            typeof row?.chainId === "string" &&
            typeof row?.address === "string" &&
            typeof row?.name === "string" &&
            typeof row?.symbol === "string" &&
            typeof row?.decimals === "number" &&
            /^0x[0-9a-fA-F]+$/.test(row.chainId) &&
            /^0x[0-9a-fA-F]{40}$/.test(row.address),
        )
        .map((row) => {
          const chainId = EVMChainId(row.chainId as `0x${string}`);
          const address = EVMAccountAddress(row.address as `0x${string}`);
          const type =
            row.type === EAssetType.Erc721
              ? EAssetType.Erc721
              : row.type === EAssetType.Erc1155
                ? EAssetType.Erc1155
                : EAssetType.Erc20;
          return new TrackedAsset(
            chainId,
            address,
            type,
            row.name,
            row.symbol,
            row.decimals,
            makeTrackedAssetId(chainId, address),
            null,
          );
        });
    } catch {
      return [];
    }
  }

  private writeAssets(assets: TrackedAsset[]): void {
    // Persist only user-added (non-default) rows as NewTrackedAsset fields + id.
    const userAssets = assets.filter(
      (asset) => !isDefaultTrackedUsdc(asset.chainId, asset.address),
    );
    const blob: StoredBlob = {
      assets: userAssets.map((asset) => ({
        chainId: asset.chainId,
        address: asset.address,
        type: asset.type,
        name: asset.name,
        symbol: asset.symbol,
        decimals: asset.decimals,
        id: asset.id,
      })),
    };
    this.storage.setItem(this.storageKey, JSON.stringify(blob));
  }
}
