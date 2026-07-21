import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import type { TrackedAssetId } from "../../types/primitives";
import type { NewTrackedAsset, TrackedAsset } from "../../types/domain";

export interface ITrackedAssetRepository {
  list(owner: EVMAccountAddress): Promise<TrackedAsset[]>;
  has(chainId: EVMChainId, address: EVMAccountAddress): Promise<boolean>;
  add(
    asset: NewTrackedAsset,
    owner: EVMAccountAddress,
  ): Promise<TrackedAsset>;
  remove(chainId: EVMChainId, address: EVMAccountAddress): Promise<void>;
  /** Clears session balance cache (one id or all) and re-fetches. */
  getBalances(
    owner: EVMAccountAddress,
    id?: TrackedAssetId,
  ): Promise<TrackedAsset[]>;
}

export const ITrackedAssetRepositoryType = Symbol.for(
  "ITrackedAssetRepository",
);
