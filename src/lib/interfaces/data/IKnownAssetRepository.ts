import type {
  EVMAccountAddress,
  EVMChainId,
  EVMContractAddress,
  SolanaAccountAddress,
  SolanaChainId,
  SolanaMintAddress,
} from "@1shotapi/ows-types";

import type {
  KnownAsset,
  KnownAssetAddress,
  KnownAssetChainId,
  NewTrackedAsset,
  SolanaKnownAsset,
} from "../../types/domain";

export type AssetOwnerAddress = EVMAccountAddress | SolanaAccountAddress;

export interface IKnownAssetRepository {
  getKnownAsset(
    chainId: KnownAssetChainId,
    address: KnownAssetAddress,
  ): Promise<KnownAsset | null>;

  /** Catalog SPL mints for a Solana cluster (e.g. USDC for Add Asset). */
  listSolanaKnownAssets(chainId: SolanaChainId): Promise<SolanaKnownAsset[]>;

  /** Native Circle USDC on `chainId` when the catalog marks `useCCTPBridge`. */
  getCctpBridgeAsset(chainId: EVMChainId): Promise<KnownAsset | null>;

  /** Buyable stable on `chainId` for Circle onramp (defaults to USDC). */
  getOnrampAsset(
    chainId: EVMChainId,
    symbol?: string,
  ): Promise<KnownAsset | null>;

  /**
   * Catalog hit or on-chain ERC-20 probe → NewTrackedAsset.
   * Solana: catalog mint only (no arbitrary mint paste).
   * Throws if the address cannot be tracked.
   */
  resolveForTracking(
    chainId: EVMChainId | SolanaChainId,
    address: EVMContractAddress | SolanaMintAddress,
    owner: AssetOwnerAddress,
  ): Promise<NewTrackedAsset>;
}

export const IKnownAssetRepositoryType = Symbol.for("IKnownAssetRepository");
