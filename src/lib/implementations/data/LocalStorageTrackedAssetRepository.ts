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
  DEFAULT_TRACKED_ASSETS,
  isDefaultTrackedAsset,
} from "./HardcodedKnownAssetRepository";
import { NewTrackedAsset, TrackedAsset } from "../../types/domain/TrackedAsset";
import { EAssetType } from "../../types/enum/EAssetType";
import { BalanceUpdatedEvent } from "../../types/events/BalanceUpdatedEvent";
import {
  makeTrackedAssetId,
  type TrackedAssetId,
} from "../../types/primitives";
import {
  registerTrackedAssetIconUrl,
  unregisterTrackedAssetIconUrl,
  syncTrackedAssetIconUrls,
} from "../../utils/tokenIcons";

type StoredBlob = {
  assets: Array<{
    chainId: string;
    address: string;
    type: string;
    name: string;
    symbol: string;
    decimals: number;
    id: string;
    iconUrl?: string;
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

  async list(chainId?: EVMChainIdType): Promise<TrackedAsset[]> {
    const storageKey = await this.resolveStorageKey();
    const assets = this.filterByChain(
      this.mergeWithDefaults(this.readStoredAssets(storageKey)),
      chainId,
    );
    syncTrackedAssetIconUrls(assets);
    // Cache only — no RPC. Call getBalances when balances are needed.
    return assets.map((asset) =>
      this.balanceCache.has(asset.id)
        ? asset.withBalance(this.balanceCache.get(asset.id)!)
        : asset.withBalance(null),
    );
  }

  async has(
    chainId: EVMChainIdType,
    address: EVMAccountAddressType,
  ): Promise<boolean> {
    if (isDefaultTrackedAsset(chainId, address)) {
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
    if (isDefaultTrackedAsset(asset.chainId, asset.address)) {
      const existing = TrackedAsset.fromNew(asset);
      const [withBalance] = await this.ensureBalances([existing], owner, false);
      return withBalance!;
    }

    const storageKey = await this.resolveStorageKey();
    const assets = this.readStoredAssets(storageKey);
    const key = makeTrackedAssetId(asset.chainId, asset.address);
    const foundIndex = assets.findIndex((a) => a.id === key);
    if (foundIndex >= 0) {
      const found = assets[foundIndex]!;
      if (asset.iconUrl !== undefined && asset.iconUrl !== found.iconUrl) {
        const updated = TrackedAsset.fromNew(
          found.withIconUrl(asset.iconUrl),
          found.balance,
        );
        assets[foundIndex] = updated;
        this.writeAssets(storageKey, assets);
        if (asset.iconUrl) {
          registerTrackedAssetIconUrl(key, asset.iconUrl);
        } else {
          unregisterTrackedAssetIconUrl(key);
        }
        const [withBalance] = await this.ensureBalances([updated], owner, false);
        return withBalance!;
      }
      const [withBalance] = await this.ensureBalances([found], owner, false);
      return withBalance!;
    }

    const tracked = TrackedAsset.fromNew(asset);
    assets.push(tracked);
    this.writeAssets(storageKey, assets);
    if (tracked.iconUrl) {
      registerTrackedAssetIconUrl(key, tracked.iconUrl);
    }
    const [withBalance] = await this.ensureBalances([tracked], owner, false);
    return withBalance!;
  }

  async remove(
    chainId: EVMChainIdType,
    address: EVMAccountAddressType,
  ): Promise<void> {
    if (isDefaultTrackedAsset(chainId, address)) {
      return;
    }
    const storageKey = await this.resolveStorageKey();
    const key = makeTrackedAssetId(chainId, address);
    const next = this.readStoredAssets(storageKey).filter(
      (asset) => asset.id !== key,
    );
    this.writeAssets(storageKey, next);
    this.balanceCache.delete(key);
    unregisterTrackedAssetIconUrl(key);
  }

  async getBalances(
    owner: EVMAccountAddressType,
    options: { id: TrackedAssetId } | { chainId: EVMChainIdType },
  ): Promise<TrackedAsset[]> {
    const storageKey = await this.resolveStorageKey();
    const all = this.mergeWithDefaults(this.readStoredAssets(storageKey));
    syncTrackedAssetIconUrls(all);

    let targets: TrackedAsset[];
    if ("id" in options) {
      this.balanceCache.delete(options.id);
      targets = all.filter((asset) => asset.id === options.id);
    } else {
      const chainKey = String(options.chainId).toLowerCase();
      for (const asset of all) {
        if (String(asset.chainId).toLowerCase() === chainKey) {
          this.balanceCache.delete(asset.id);
        }
      }
      targets = this.filterByChain(all, options.chainId);
    }

    return this.ensureBalances(targets, owner, true);
  }

  private filterByChain(
    assets: TrackedAsset[],
    chainId?: EVMChainIdType,
  ): TrackedAsset[] {
    if (chainId == null) return assets;
    const key = String(chainId).toLowerCase();
    return assets.filter(
      (asset) => String(asset.chainId).toLowerCase() === key,
    );
  }

  private mergeWithDefaults(stored: TrackedAsset[]): TrackedAsset[] {
    const seen = new Set<TrackedAssetId>();
    const merged: TrackedAsset[] = [];
    for (const asset of DEFAULT_TRACKED_ASSETS) {
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
    if (owner === EMPTY_OWNER) {
      return null;
    }
    if (asset.type === EAssetType.Native) {
      try {
        const client = this.blockchain.getPublicClient(asset.chainId);
        return await client.getBalance({ address: owner as Address });
      } catch (error: unknown) {
        console.warn("[balances] getBalance failed", error);
        return null;
      }
    }
    if (asset.type !== EAssetType.Erc20) {
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
      const assets: TrackedAsset[] = [];
      for (const row of parsed.assets) {
        if (
          typeof row?.chainId !== "string" ||
          typeof row?.address !== "string" ||
          typeof row?.name !== "string" ||
          typeof row?.symbol !== "string" ||
          typeof row?.decimals !== "number" ||
          !/^0x[0-9a-fA-F]+$/.test(row.chainId) ||
          !/^0x[0-9a-fA-F]{40}$/.test(row.address)
        ) {
          continue;
        }
        const chainId = EVMChainId(row.chainId as `0x${string}`);
        const address = EVMAccountAddress(row.address as `0x${string}`);
        const type =
          row.type === EAssetType.Native
            ? EAssetType.Native
            : row.type === EAssetType.Erc721
              ? EAssetType.Erc721
              : row.type === EAssetType.Erc1155
                ? EAssetType.Erc1155
                : EAssetType.Erc20;
        const iconUrl =
          typeof row.iconUrl === "string" && row.iconUrl.length > 0
            ? row.iconUrl
            : undefined;
        assets.push(
          new TrackedAsset(
            chainId,
            address,
            type,
            row.name,
            row.symbol,
            row.decimals,
            makeTrackedAssetId(chainId, address),
            null,
            iconUrl,
          ),
        );
      }
      return assets;
    } catch {
      return [];
    }
  }

  private writeAssets(storageKey: string, assets: TrackedAsset[]): void {
    // Persist only user-added (non-default) rows as NewTrackedAsset fields + id.
    const userAssets = assets.filter(
      (asset) => !isDefaultTrackedAsset(asset.chainId, asset.address),
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
        ...(asset.iconUrl ? { iconUrl: asset.iconUrl } : {}),
      })),
    };
    this.storage.setItem(storageKey, JSON.stringify(blob));
  }
}
