import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import type { TrackedAssetId } from "../../types/primitives";
import type { NewTrackedAsset, TrackedAsset } from "../../types/domain";

export interface ITrackedAssetRepository {
  /**
   * Catalog + stored assets. Optional `chainId` scopes the result.
   * Does **not** hit RPC — balances come from session cache only (else `null`).
   */
  list(chainId?: EVMChainId): Promise<TrackedAsset[]>;
  has(chainId: EVMChainId, address: EVMAccountAddress): Promise<boolean>;
  add(
    asset: NewTrackedAsset,
    owner: EVMAccountAddress,
  ): Promise<TrackedAsset>;
  remove(chainId: EVMChainId, address: EVMAccountAddress): Promise<void>;
  /**
   * Network balance fetch. Pass `id` for one asset, or `chainId` for every
   * tracked asset on that chain. One of the two is required.
   */
  getBalances(
    owner: EVMAccountAddress,
    options: { id: TrackedAssetId } | { chainId: EVMChainId },
  ): Promise<TrackedAsset[]>;
}

export const ITrackedAssetRepositoryType = Symbol.for(
  "ITrackedAssetRepository",
);
