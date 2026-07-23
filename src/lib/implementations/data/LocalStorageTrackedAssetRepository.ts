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
import type { IConfigProvider } from "../../interfaces/utils/IConfigProvider";
import type { IEventBus } from "../../interfaces/utils/IEventBus";
import type { ITrackedAssetRepository } from "../../interfaces/data/ITrackedAssetRepository";
import {
  DEFAULT_TRACKED_USDC,
  isDefaultTrackedUsdc,
} from "./HardcodedKnownAssetRepository";
import { NewTrackedAsset, TrackedAsset } from "../../types/domain/TrackedAsset";
import { EAssetType } from "../../types/enum/EAssetType";
import { BalanceUpdatedEvent } from "../../types/events/BalanceUpdatedEvent";
import {
  makeTrackedAssetId,
  type TrackedAssetId,
} from "../../types/primitives";

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
  storage?: CredentialStorageBackend;
};

const EMPTY_OWNER = EVMAccountAddress("0x0");

export class LocalStorageTrackedAssetRepository
  implements ITrackedAssetRepository
{
  private readonly storage: CredentialStorageBackend;
  private readonly balanceCache = new Map<TrackedAssetId, bigint>();
  private storageKey: string | null = null;

  constructor(
    private readonly blockchain: IBlockchainProvider,
    private readonly eventBus: IEventBus,
    private readonly configProvider: IConfigProvider,
    options: TrackedAssetRepositoryOptions = {},
  ) {
    this.storage =
      options.storage ??
      (typeof localStorage !== "undefined"
        ? localStorage
        : createMemoryStorageBackend());
  }

  private async resolveStorageKey(): Promise<string> {
    if (this.storageKey) {
      return this.storageKey;
    }
    const config = await this.configProvider.getConfig();
    this.storageKey = config.trackedAssetsStorageKey;
    return this.storageKey;
  }

  async list(owner: EVMAccountAddressType): Promise<TrackedAsset[]> {
    const storageKey = await this.resolveStorageKey();
    const assets = this.mergeWithDefaults(this.readStoredAssets(storageKey));
    return this.ensureBalances(assets, owner, false);
  }

  async has(
    chainId: EVMChainIdType,
    address: EVMAccountAddressType,
  ): Promise<boolean> {
    if (isDefaultTrackedUsdc(chainId, address)) {
      return true;
    }
    const storageKey = await this.resolveStorageKey();
    const key = makeTrackedAssetId(chainId, address);
    return this.readStoredAssets(storageKey).some((asset) => asset.id === key);
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

    const storageKey = await this.resolveStorageKey();
    const assets = this.readStoredAssets(storageKey);
    const key = makeTrackedAssetId(asset.chainId, asset.address);
    const found = assets.find((a) => a.id === key);
    if (found) {
      const [withBalance] = await this.ensureBalances([found], owner, false);
      return withBalance!;
    }

    const tracked = TrackedAsset.fromNew(asset);
    assets.push(tracked);
    this.writeAssets(storageKey, assets);
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
    const storageKey = await this.resolveStorageKey();
    const key = makeTrackedAssetId(chainId, address);
    const next = this.readStoredAssets(storageKey).filter(
      (asset) => asset.id !== key,
    );
    this.writeAssets(storageKey, next);
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
    const storageKey = await this.resolveStorageKey();
    const assets = this.mergeWithDefaults(this.readStoredAssets(storageKey));
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

    const result = await Promise.all(
      assets.map(async (asset) => {
        if (this.balanceCache.has(asset.id)) {
          return asset.withBalance(this.balanceCache.get(asset.id)!);
        }

        anyFetched = true;
        const balance = await this.fetchBalance(asset, owner);
        if (balance !== null) {
          this.balanceCache.set(asset.id, balance);
        }
        return asset.withBalance(balance);
      }),
    );

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

  private readStoredAssets(storageKey: string): TrackedAsset[] {
    const raw = this.storage.getItem(storageKey);
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

  private writeAssets(storageKey: string, assets: TrackedAsset[]): void {
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
    this.storage.setItem(storageKey, JSON.stringify(blob));
  }
}
