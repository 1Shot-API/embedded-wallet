import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import type { KnownAsset, NewTrackedAsset } from "../../types/domain";

export interface IKnownAssetRepository {
  getKnownAsset(
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ): Promise<KnownAsset | null>;

  /**
   * Catalog hit or on-chain ERC-20 probe → NewTrackedAsset.
   * Throws if the address is not a contract or not ERC-20.
   */
  resolveForTracking(
    chainId: EVMChainId,
    address: EVMAccountAddress,
    owner: EVMAccountAddress,
  ): Promise<NewTrackedAsset>;
}

export const IKnownAssetRepositoryType = Symbol.for("IKnownAssetRepository");
