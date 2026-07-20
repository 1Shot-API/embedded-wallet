import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import type { ITrackedAsset } from "./types";

export interface ITrackedAssetRepository {
  list(): Promise<ITrackedAsset[]>;
  has(chainId: EVMChainId, address: EVMAccountAddress): Promise<boolean>;
  add(asset: ITrackedAsset): Promise<void>;
  remove(chainId: EVMChainId, address: EVMAccountAddress): Promise<void>;
}

export const ITrackedAssetRepositoryType = Symbol.for(
  "ITrackedAssetRepository",
);
