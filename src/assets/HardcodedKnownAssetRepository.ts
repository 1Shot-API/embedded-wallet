import { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import type { IKnownAssetRepository } from "./IKnownAssetRepository";
import {
  EAssetType,
  trackedAssetKey,
  type IKnownAsset,
  type ITrackedAsset,
} from "./types";

/** Seeded known ERC-20s for demos (USDC on every DEMO_CHAINS network + Base USDT). */
const KNOWN_ASSETS: readonly IKnownAsset[] = [
  {
    chainId: EVMChainId("0x4cef52"),
    address: EVMAccountAddress("0x3600000000000000000000000000000000000000"),
    name: "USDC",
    type: EAssetType.Erc20,
  },
  {
    chainId: EVMChainId("0xaa36a7"),
    address: EVMAccountAddress("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"),
    name: "USDC",
    type: EAssetType.Erc20,
  },
  {
    chainId: EVMChainId("0x14a34"),
    address: EVMAccountAddress("0x036CbD53842c5426634e7929541eC2318f3dCF7e"),
    name: "USDC",
    type: EAssetType.Erc20,
  },
  {
    chainId: EVMChainId("0x2105"),
    address: EVMAccountAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
    name: "USDC",
    type: EAssetType.Erc20,
  },
  {
    chainId: EVMChainId("0x2105"),
    address: EVMAccountAddress("0xfde4c96c8593536e31f229ea8f37b2ada2699bb2"),
    name: "USDT",
    type: EAssetType.Erc20,
  },
];

const BY_KEY = new Map(
  KNOWN_ASSETS.map((asset) => [
    trackedAssetKey(asset.chainId, asset.address),
    asset,
  ]),
);

/**
 * USDC on every supported demo chain — always shown in Balances (not removable).
 */
export const DEFAULT_TRACKED_USDC: readonly ITrackedAsset[] = KNOWN_ASSETS.filter(
  (asset) => asset.name === "USDC",
).map((asset) => ({
  chainId: asset.chainId,
  address: asset.address,
}));

const DEFAULT_TRACKED_USDC_KEYS = new Set(
  DEFAULT_TRACKED_USDC.map((asset) =>
    trackedAssetKey(asset.chainId, asset.address),
  ),
);

export function isDefaultTrackedUsdc(
  chainId: EVMChainId,
  address: EVMAccountAddress,
): boolean {
  return DEFAULT_TRACKED_USDC_KEYS.has(trackedAssetKey(chainId, address));
}

export class HardcodedKnownAssetRepository implements IKnownAssetRepository {
  async getKnownAsset(
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ): Promise<IKnownAsset | null> {
    return BY_KEY.get(trackedAssetKey(chainId, address)) ?? null;
  }
}
