import { type Brand, make } from "ts-brand";
import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";

/**
 * Deterministic tracked-asset id: `${chainId}:${address}` lowercased.
 */
export type TrackedAssetId = Brand<string, "TrackedAssetId">;
export const TrackedAssetId = make<TrackedAssetId>();

export function makeTrackedAssetId(
  chainId: EVMChainId | string,
  address: EVMAccountAddress | string,
): TrackedAssetId {
  return TrackedAssetId(
    `${String(chainId).toLowerCase()}:${String(address).toLowerCase()}`,
  );
}
