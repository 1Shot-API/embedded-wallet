import {
  ChainUtils,
  type EVMChainId,
  type EVMContractAddress,
  type SolanaChainId,
  type SolanaMintAddress,
} from "@1shotapi/ows-types";
import { type Brand, make } from "ts-brand";

/**
 * Deterministic tracked-asset id: `${chainId}:${address}`.
 * EVM lowercases both parts; Solana keeps base58 mint case.
 */
export type TrackedAssetId = Brand<string, "TrackedAssetId">;
export const TrackedAssetId = make<TrackedAssetId>();

export function makeTrackedAssetId(
  chainId: EVMChainId | SolanaChainId | string,
  address: EVMContractAddress | SolanaMintAddress | string,
): TrackedAssetId {
  const chain = String(chainId);
  const addr = String(address);
  if (ChainUtils.isSolanaChainId(chain)) {
    return TrackedAssetId(`${chain}:${addr}`);
  }
  return TrackedAssetId(`${chain.toLowerCase()}:${addr.toLowerCase()}`);
}
