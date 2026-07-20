import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import type { IKnownAsset } from "./types";

export interface IKnownAssetRepository {
  getKnownAsset(
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ): Promise<IKnownAsset | null>;
}

export const IKnownAssetRepositoryType = Symbol.for("IKnownAssetRepository");
