import type { EVMAccountAddress, EVMChainId, EVMContractAddress } from "@1shotapi/ows-types";
import type { KnownAsset, NewTrackedAsset } from "../../types/domain";

export interface IKnownAssetRepository {
  getKnownAsset(
    chainId: EVMChainId,
    address: EVMContractAddress,
  ): Promise<KnownAsset | null>;

  /** Native Circle USDC on `chainId` when the catalog marks `useCCTPBridge`. */
  getCctpBridgeAsset(chainId: EVMChainId): Promise<KnownAsset | null>;

  /** Buyable stable on `chainId` for Circle onramp (defaults to USDC). */
  getOnrampAsset(
    chainId: EVMChainId,
    symbol?: string,
  ): Promise<KnownAsset | null>;

  /**
   * Catalog hit or on-chain ERC-20 probe → NewTrackedAsset.
   * Throws if the address is not a contract or not ERC-20.
   */
  resolveForTracking(
    chainId: EVMChainId,
    address: EVMContractAddress,
    owner: EVMAccountAddress,
  ): Promise<NewTrackedAsset>;
}

export const IKnownAssetRepositoryType = Symbol.for("IKnownAssetRepository");
