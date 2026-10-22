import type {
  EVMChainId,
  EVMContractAddress,
  SolanaATAAddress,
  SolanaChainId,
  SolanaMintAddress,
} from "@1shotapi/ows-types";

import type { EAssetType } from "../../types/enum/EAssetType";

/** Persistable user-added tracked asset row (vault / localStorage). */
export interface IVaultTrackedAssetRow {
  chainId: EVMChainId | SolanaChainId;
  address: EVMContractAddress | SolanaMintAddress;
  type: EAssetType;
  name: string;
  symbol: string;
  decimals: number;
  id: string;
  iconUrl?: string;
  ataAddress?: SolanaATAAddress | null;
  ataRentPaid?: boolean | null;
}

/**
 * Bridge so the vault can hydrate and sync user-added tracked assets without
 * depending on the full {@link ITrackedAssetRepository} surface.
 */
export interface IVaultTrackedAssetSync {
  exportUserAssetsForVault(): Promise<IVaultTrackedAssetRow[]>;
  replaceUserAssetsFromVault(assets: IVaultTrackedAssetRow[]): Promise<void>;
  setChangeListener(listener: (() => void) | null): void;
}

export const IVaultTrackedAssetSyncType = Symbol.for("IVaultTrackedAssetSync");
