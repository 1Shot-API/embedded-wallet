import { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import {
  createMemoryStorageBackend,
  type CredentialStorageBackend,
} from "../demo/local-storage-store";
import {
  DEFAULT_TRACKED_USDC,
  isDefaultTrackedUsdc,
} from "./HardcodedKnownAssetRepository";
import type { ITrackedAssetRepository } from "./ITrackedAssetRepository";
import { trackedAssetKey, type ITrackedAsset } from "./types";

/** localStorage key for user-tracked assets (defaults like USDC are merged in). */
export const OWS_TRACKED_ASSETS_STORAGE_KEY = "ows.tracked-assets.v1";

type StoredBlob = {
  assets: Array<{ chainId: string; address: string }>;
};

export class LocalStorageTrackedAssetRepository
  implements ITrackedAssetRepository
{
  private readonly storageKey: string;
  private readonly storage: CredentialStorageBackend;

  constructor(
    options: {
      storageKey?: string;
      storage?: CredentialStorageBackend;
    } = {},
  ) {
    this.storageKey = options.storageKey ?? OWS_TRACKED_ASSETS_STORAGE_KEY;
    this.storage =
      options.storage ??
      (typeof localStorage !== "undefined"
        ? localStorage
        : createMemoryStorageBackend());
  }

  async list(): Promise<ITrackedAsset[]> {
    return this.mergeWithDefaults(this.readStoredAssets());
  }

  async has(
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ): Promise<boolean> {
    if (isDefaultTrackedUsdc(chainId, address)) {
      return true;
    }
    const key = trackedAssetKey(chainId, address);
    return this.readStoredAssets().some(
      (asset) => trackedAssetKey(asset.chainId, asset.address) === key,
    );
  }

  async add(asset: ITrackedAsset): Promise<void> {
    if (isDefaultTrackedUsdc(asset.chainId, asset.address)) {
      return;
    }
    const assets = this.readStoredAssets();
    const key = trackedAssetKey(asset.chainId, asset.address);
    if (assets.some((a) => trackedAssetKey(a.chainId, a.address) === key)) {
      return;
    }
    assets.push({
      chainId: asset.chainId,
      address: asset.address,
    });
    this.writeAssets(assets);
  }

  async remove(
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ): Promise<void> {
    // Built-in USDC rows are always tracked.
    if (isDefaultTrackedUsdc(chainId, address)) {
      return;
    }
    const key = trackedAssetKey(chainId, address);
    const next = this.readStoredAssets().filter(
      (asset) => trackedAssetKey(asset.chainId, asset.address) !== key,
    );
    this.writeAssets(next);
  }

  private mergeWithDefaults(stored: ITrackedAsset[]): ITrackedAsset[] {
    const seen = new Set<string>();
    const merged: ITrackedAsset[] = [];
    for (const asset of DEFAULT_TRACKED_USDC) {
      const key = trackedAssetKey(asset.chainId, asset.address);
      seen.add(key);
      merged.push(asset);
    }
    for (const asset of stored) {
      const key = trackedAssetKey(asset.chainId, asset.address);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(asset);
    }
    return merged;
  }

  private readStoredAssets(): ITrackedAsset[] {
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
            /^0x[0-9a-fA-F]+$/.test(row.chainId) &&
            /^0x[0-9a-fA-F]{40}$/.test(row.address),
        )
        .map((row) => ({
          chainId: EVMChainId(row.chainId as `0x${string}`),
          address: EVMAccountAddress(row.address as `0x${string}`),
        }));
    } catch {
      return [];
    }
  }

  private writeAssets(assets: ITrackedAsset[]): void {
    const blob: StoredBlob = {
      assets: assets.map((asset) => ({
        chainId: String(asset.chainId),
        address: String(asset.address),
      })),
    };
    this.storage.setItem(this.storageKey, JSON.stringify(blob));
  }
}
