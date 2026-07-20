import type { PublicClient } from "viem";
import type { EVMChainId } from "@1shotapi/ows-types";

export interface IBlockchainProvider {
  /** Returns a viem PublicClient for the chain, or throws if unsupported. */
  getPublicClient(chainId: EVMChainId): PublicClient;
}

export const IBlockchainProviderType = Symbol.for("IBlockchainProvider");
