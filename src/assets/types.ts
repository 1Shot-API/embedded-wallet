import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";

/** On-chain asset standard. Only ERC-20 balances are fetched today. */
export enum EAssetType {
  Erc20 = "erc20",
  Erc721 = "erc721",
  Erc1155 = "erc1155",
}

/** Catalog metadata for a known token (hardcoded registry). */
export interface IKnownAsset {
  chainId: EVMChainId;
  address: EVMAccountAddress;
  name: string;
  type: EAssetType;
  iconUrl?: string;
}

/** User-tracked asset identity (display comes from known repo when available). */
export interface ITrackedAsset {
  chainId: EVMChainId;
  address: EVMAccountAddress;
}

export function trackedAssetKey(
  chainId: EVMChainId | string,
  address: EVMAccountAddress | string,
): string {
  return `${String(chainId).toLowerCase()}:${String(address).toLowerCase()}`;
}
