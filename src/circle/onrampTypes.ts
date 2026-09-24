import type { EVMAccountAddress, EVMContractAddress } from "@1shotapi/ows-types";

/** Params for opening the Circle onramp fullscreen view. */
export type IOnrampOpenRequest = {
  destinationAddress: EVMAccountAddress;
  chainId?: number;
  amount?: string;
  tokenSymbol?: string;
  tokenAddress?: EVMContractAddress;
  iconUrl?: string;
};
