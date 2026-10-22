import type {
  EVMChainId,
  EVMContractAddress,
  SolanaChainId,
  SolanaMintAddress,
} from "@1shotapi/ows-types";

import type {
  KnownAssetAddress,
  KnownAssetChainId,
  NewTrackedAsset,
  TrackedAsset,
} from "../../types/domain";
import type { TrackedAssetId } from "../../types/primitives";

import type { AssetOwnerAddress } from "./IKnownAssetRepository";

export interface ITrackedAssetRepository {
  /**
   * Catalog + stored assets. Optional `chainId` scopes the result.
   * Does **not** hit RPC — balances come from session cache only (else `null`).
   */
  list(chainId?: KnownAssetChainId): Promise<TrackedAsset[]>;
  has(
    chainId: KnownAssetChainId,
    address: KnownAssetAddress,
  ): Promise<boolean>;
  add(
    asset: NewTrackedAsset,
    owner: AssetOwnerAddress,
  ): Promise<TrackedAsset>;
  remove(
    chainId: KnownAssetChainId,
    address: KnownAssetAddress,
  ): Promise<void>;
  /**
   * Network balance fetch. Pass `id` for one asset, or `chainId` for every
   * tracked asset on that chain. One of the two is required.
   */
  getBalances(
    owner: AssetOwnerAddress,
    options:
      | { id: TrackedAssetId }
      | { chainId: EVMChainId | SolanaChainId },
  ): Promise<TrackedAsset[]>;
}

export const ITrackedAssetRepositoryType = Symbol.for(
  "ITrackedAssetRepository",
);

/** @deprecated Prefer KnownAssetChainId — kept for call-site clarity. */
export type TrackedAssetChainId = EVMChainId | SolanaChainId;
export type TrackedAssetTokenAddress =
  | EVMContractAddress
  | SolanaMintAddress;
