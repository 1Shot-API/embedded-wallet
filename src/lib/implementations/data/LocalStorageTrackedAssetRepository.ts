import {
  type EVMChainId,
  ChainUtils,
  EVMAccountAddress,
  EVMContractAddress,
  SolanaAddressUtils,
  type SolanaAccountAddress,
  type SolanaATAAddress,
  type SolanaChainId,
  type SolanaMintAddress,
} from "@1shotapi/ows-types";
import type { IBlockchainProvider } from "@1shotapi/ows-wallet-utils";
import { erc20Abi, type Address } from "viem";

import type { AssetOwnerAddress } from "../../interfaces/data/IKnownAssetRepository";
import type { ISolanaRpc } from "../../interfaces/data/ISolanaRpc";
import type { ITrackedAssetRepository } from "../../interfaces/data/ITrackedAssetRepository";
import type {
  IVaultTrackedAssetRow,
  IVaultTrackedAssetSync,
} from "../../interfaces/data/IVaultTrackedAssetSync";
import type { IConfigProvider } from "../../interfaces/utils/IConfigProvider";
import type { IEventBus } from "../../interfaces/utils/IEventBus";
import type {
  KnownAssetAddress,
  KnownAssetChainId,
} from "../../types/domain/KnownAsset";
import { NewTrackedAsset, TrackedAsset } from "../../types/domain/TrackedAsset";
import { EAssetType } from "../../types/enum/EAssetType";
import { BalanceUpdatedEvent } from "../../types/events/BalanceUpdatedEvent";
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
import {
  registerTrackedAssetIconUrl,
  unregisterTrackedAssetIconUrl,
  syncTrackedAssetIconUrls,
} from "../../utils/tokenIcons";

import {
  DEFAULT_TRACKED_ASSETS,
  isDefaultTrackedAsset,
} from "./HardcodedKnownAssetRepository";

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
    ataAddress?: string | null;
    ataRentPaid?: boolean | null;
  }>;
};

export type TrackedAssetRepositoryOptions = {
  storage?: AsyncKvStore;
};

const EMPTY_EVM_OWNER = EVMAccountAddress("0x0");

function isSolanaOwner(owner: AssetOwnerAddress): owner is SolanaAccountAddress {
  return !String(owner).startsWith("0x");
}

export class LocalStorageTrackedAssetRepository
  implements ITrackedAssetRepository, IVaultTrackedAssetSync
{
  private readonly storage: AsyncKvStore;
  private readonly balanceCache = new Map<TrackedAssetId, bigint>();
  private storageKey: string | null = null;
  private migratedKeys = new Set<string>();
  private changeListener: (() => void) | null = null;

  constructor(
    private readonly blockchain: IBlockchainProvider,
    private readonly eventBus: IEventBus,
    private readonly configProvider: IConfigProvider,
    private readonly solanaRpc: ISolanaRpc,
    options: TrackedAssetRepositoryOptions = {},
  ) {
    this.storage =
      options.storage ??
      (typeof indexedDB !== "undefined"
        ? createIdbKvBackend()
        : createMemoryAsyncKvStore());
  }

  setChangeListener(listener: (() => void) | null): void {
    this.changeListener = listener;
  }

  async exportUserAssetsForVault(): Promise<IVaultTrackedAssetRow[]> {
    const storageKey = await this.resolveStorageKey();
    const assets = await this.readStoredAssets(storageKey);
    return assets.map((asset) => ({
      chainId: asset.chainId,
      address: asset.address,
      type: asset.type,
      name: asset.name,
      symbol: asset.symbol,
      decimals: asset.decimals,
      id: asset.id,
      ...(asset.iconUrl ? { iconUrl: asset.iconUrl } : {}),
      ...(asset.ataAddress != null ? { ataAddress: asset.ataAddress } : {}),
      ...(asset.ataRentPaid != null ? { ataRentPaid: asset.ataRentPaid } : {}),
    }));
  }

  async replaceUserAssetsFromVault(
    assets: IVaultTrackedAssetRow[],
  ): Promise<void> {
    const storageKey = await this.resolveStorageKey();
    const next: TrackedAsset[] = [];
    for (const row of assets) {
      if (isDefaultTrackedAsset(row.chainId, row.address)) continue;
      const tracked = TrackedAsset.fromNew(
        new NewTrackedAsset(
          row.chainId,
          row.address,
          row.type,
          row.name,
          row.symbol,
          row.decimals,
          row.iconUrl,
          0,
          false,
          row.ataAddress ?? null,
          row.ataRentPaid ?? null,
        ),
      );
      next.push(tracked);
    }
    await this.writeAssets(storageKey, next, false);
    syncTrackedAssetIconUrls(this.mergeWithDefaults(next));
  }

  private async resolveStorageKey(): Promise<string> {
    if (this.storageKey) {
      if (!this.migratedKeys.has(this.storageKey)) {
        await migrateLocalStorageKeyToIdb(this.storage, this.storageKey);
        this.migratedKeys.add(this.storageKey);
      }
      return this.storageKey;
    }
    const config = await this.configProvider.getConfig();
    this.storageKey = config.trackedAssetsStorageKey;
    await migrateLocalStorageKeyToIdb(this.storage, this.storageKey);
    this.migratedKeys.add(this.storageKey);
    return this.storageKey;
  }

  async list(chainId?: KnownAssetChainId): Promise<TrackedAsset[]> {
    const storageKey = await this.resolveStorageKey();
    const assets = this.filterByChain(
      this.mergeWithDefaults(await this.readStoredAssets(storageKey)),
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
    chainId: KnownAssetChainId,
    address: KnownAssetAddress,
  ): Promise<boolean> {
    if (isDefaultTrackedAsset(chainId, address)) {
      return true;
    }
    const storageKey = await this.resolveStorageKey();
    const key = makeTrackedAssetId(chainId, address);
    return (await this.readStoredAssets(storageKey)).some(
      (asset) => asset.id === key,
    );
  }

  async add(
    asset: NewTrackedAsset,
    owner: AssetOwnerAddress,
  ): Promise<TrackedAsset> {
    if (isDefaultTrackedAsset(asset.chainId, asset.address)) {
      const existing = TrackedAsset.fromNew(asset);
      const [withBalance] = await this.ensureBalances([existing], owner, false);
      return withBalance!;
    }

    const storageKey = await this.resolveStorageKey();
    const assets = await this.readStoredAssets(storageKey);
    const key = makeTrackedAssetId(asset.chainId, asset.address);
    const foundIndex = assets.findIndex((a) => a.id === key);
    if (foundIndex >= 0) {
      const found = assets[foundIndex]!;
      let next = found;
      if (asset.iconUrl !== undefined && asset.iconUrl !== found.iconUrl) {
        next = TrackedAsset.fromNew(
          found.withIconUrl(asset.iconUrl),
          found.balance,
        );
      }
      if (
        asset.ataAddress != null &&
        (asset.ataAddress !== found.ataAddress ||
          asset.ataRentPaid !== found.ataRentPaid)
      ) {
        next = next.withAta(asset.ataAddress, asset.ataRentPaid);
      }
      if (next !== found) {
        assets[foundIndex] = next;
        await this.writeAssets(storageKey, assets);
        if (asset.iconUrl) {
          registerTrackedAssetIconUrl(key, asset.iconUrl);
        } else if (asset.iconUrl === undefined) {
          // keep existing icon registration
        } else {
          unregisterTrackedAssetIconUrl(key);
        }
        const [withBalance] = await this.ensureBalances([next], owner, false);
        return withBalance!;
      }
      const [withBalance] = await this.ensureBalances([found], owner, false);
      return withBalance!;
    }

    const tracked = TrackedAsset.fromNew(asset);
    assets.push(tracked);
    await this.writeAssets(storageKey, assets);
    if (tracked.iconUrl) {
      registerTrackedAssetIconUrl(key, tracked.iconUrl);
    }
    const [withBalance] = await this.ensureBalances([tracked], owner, false);
    return withBalance!;
  }

  async remove(
    chainId: KnownAssetChainId,
    address: KnownAssetAddress,
  ): Promise<void> {
    if (isDefaultTrackedAsset(chainId, address)) {
      return;
    }
    const storageKey = await this.resolveStorageKey();
    const key = makeTrackedAssetId(chainId, address);
    const next = (await this.readStoredAssets(storageKey)).filter(
      (asset) => asset.id !== key,
    );
    await this.writeAssets(storageKey, next);
    this.balanceCache.delete(key);
    unregisterTrackedAssetIconUrl(key);
  }

  async getBalances(
    owner: AssetOwnerAddress,
    options:
      | { id: TrackedAssetId }
      | { chainId: EVMChainId | SolanaChainId },
  ): Promise<TrackedAsset[]> {
    const storageKey = await this.resolveStorageKey();
    const all = this.mergeWithDefaults(await this.readStoredAssets(storageKey));
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
    chainId?: KnownAssetChainId,
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
    owner: AssetOwnerAddress,
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
    owner: AssetOwnerAddress,
  ): Promise<bigint | null> {
    if (asset.type === EAssetType.Spl) {
      if (!isSolanaOwner(owner) || owner === ("—" as SolanaAccountAddress)) {
        return null;
      }
      return this.fetchSplBalance(asset, owner);
    }

    if (owner === EMPTY_EVM_OWNER || isSolanaOwner(owner)) {
      return null;
    }
    if (asset.type === EAssetType.Native) {
      try {
        if (!ChainUtils.isEVMChainId(asset.chainId)) return null;
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
      if (!ChainUtils.isEVMChainId(asset.chainId)) return null;
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

  private async fetchSplBalance(
    asset: TrackedAsset,
    _owner: SolanaAccountAddress,
  ): Promise<bigint | null> {
    if (!ChainUtils.isSolanaChainId(asset.chainId)) {
      return null;
    }
    try {
      let ata = asset.ataAddress;
      if (!ata) {
        // Without a stored ATA, balance is unknown until Add Asset / ensureAta.
        return 0n;
      }
      const exists = await this.solanaRpc.accountExists(asset.chainId, ata);
      if (!exists) {
        return 0n;
      }
      const { amount } = await this.solanaRpc.getTokenAccountBalance(
        asset.chainId,
        ata,
      );
      return amount;
    } catch (error: unknown) {
      console.warn("[balances] SPL token balance failed", error);
      return null;
    }
  }

  private parseAssetType(type: string): EAssetType {
    if (type === EAssetType.Native) return EAssetType.Native;
    if (type === EAssetType.Erc721) return EAssetType.Erc721;
    if (type === EAssetType.Erc1155) return EAssetType.Erc1155;
    if (type === EAssetType.Spl) return EAssetType.Spl;
    return EAssetType.Erc20;
  }

  private async readStoredAssets(storageKey: string): Promise<TrackedAsset[]> {
    const raw = await this.storage.getItem(storageKey);
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
          typeof row?.decimals !== "number"
        ) {
          continue;
        }

        if (ChainUtils.isSolanaChainId(row.chainId)) {
          const chainId = ChainUtils.asSolanaChainId(row.chainId);
          let mint: SolanaMintAddress;
          try {
            mint = SolanaAddressUtils.asMintAddress(row.address);
          } catch {
            continue;
          }
          const type = this.parseAssetType(row.type);
          if (type !== EAssetType.Spl) continue;
          const iconUrl =
            typeof row.iconUrl === "string" && row.iconUrl.length > 0
              ? row.iconUrl
              : undefined;
          let ataAddress: SolanaATAAddress | null = null;
          if (typeof row.ataAddress === "string" && row.ataAddress.length > 0) {
            try {
              ataAddress = SolanaAddressUtils.asAtaAddress(row.ataAddress);
            } catch {
              ataAddress = null;
            }
          }
          const ataRentPaid =
            typeof row.ataRentPaid === "boolean" ? row.ataRentPaid : null;
          assets.push(
            new TrackedAsset(
              chainId,
              mint,
              EAssetType.Spl,
              row.name,
              row.symbol,
              row.decimals,
              makeTrackedAssetId(chainId, mint),
              null,
              iconUrl,
              0,
              false,
              ataAddress,
              ataRentPaid,
            ),
          );
          continue;
        }

        if (
          !/^0x[0-9a-fA-F]+$/.test(row.chainId) ||
          !/^0x[0-9a-fA-F]{40}$/.test(row.address)
        ) {
          continue;
        }
        const chainId = ChainUtils.asEVMChainId(row.chainId);
        const address = EVMContractAddress(row.address as `0x${string}`);
        const type = this.parseAssetType(row.type);
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

  private async writeAssets(
    storageKey: string,
    assets: TrackedAsset[],
    notifyChange = true,
  ): Promise<void> {
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
        ...(asset.ataAddress != null ? { ataAddress: asset.ataAddress } : {}),
        ...(asset.ataRentPaid != null
          ? { ataRentPaid: asset.ataRentPaid }
          : {}),
      })),
    };
    await this.storage.setItem(storageKey, JSON.stringify(blob));
    if (notifyChange) {
      this.changeListener?.();
    }
  }
}
