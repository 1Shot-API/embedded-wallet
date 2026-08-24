import { erc20Abi } from "viem";
import type {
  EVMAccountAddress as EVMAccountAddressType,
  EVMChainId as EVMChainIdType,
} from "@1shotapi/ows-types";
import type { IBlockchainProvider } from "@1shotapi/ows-wallet-utils";
import type { IKnownAssetRepository } from "../../interfaces/data/IKnownAssetRepository";
import { KnownAsset } from "../../types/domain/KnownAsset";
import { NewTrackedAsset } from "../../types/domain/TrackedAsset";
import { EAssetType } from "../../types/enum/EAssetType";
import { makeTrackedAssetId } from "@/lib/types/primitives";
import { RELAYER_KNOWN_ASSETS } from "./relayerKnownAssets";

const BY_KEY = new Map(
  RELAYER_KNOWN_ASSETS.map((asset) => [
    makeTrackedAssetId(asset.chainId, asset.address),
    asset,
  ]),
);

/** Chain → pinned default stablecoin symbol (always shown, not removable). */
const DEFAULT_TRACKED_STABLE_BY_CHAIN = new Map([
  ["0x4cef52", "USDC"],
  ["0xaa36a7", "USDC"],
  ["0x14a34", "USDC"],
  ["0x2105", "USDC"],
  ["0x1237", "USDG"],
]);

/**
 * Default stablecoin on demo chains — always shown in Balances (not removable).
 * USDC where listed; USDG on Robinhood (USDC is not deployed there).
 */
export const DEFAULT_TRACKED_USDC: readonly NewTrackedAsset[] =
  RELAYER_KNOWN_ASSETS.filter((asset) => {
    const expected = DEFAULT_TRACKED_STABLE_BY_CHAIN.get(
      String(asset.chainId).toLowerCase(),
    );
    return expected != null && asset.symbol === expected;
  }).map((asset) => NewTrackedAsset.fromKnown(asset));

const DEFAULT_TRACKED_USDC_KEYS = new Set(
  DEFAULT_TRACKED_USDC.map((asset) =>
    makeTrackedAssetId(asset.chainId, asset.address),
  ),
);

export function isDefaultTrackedUsdc(
  chainId: EVMChainIdType,
  address: EVMAccountAddressType,
): boolean {
  return DEFAULT_TRACKED_USDC_KEYS.has(makeTrackedAssetId(chainId, address));
}

export class HardcodedKnownAssetRepository implements IKnownAssetRepository {
  constructor(private readonly blockchain: IBlockchainProvider) {}

  async getKnownAsset(
    chainId: EVMChainIdType,
    address: EVMAccountAddressType,
  ): Promise<KnownAsset | null> {
    return BY_KEY.get(makeTrackedAssetId(chainId, address)) ?? null;
  }

  async resolveForTracking(
    chainId: EVMChainIdType,
    address: EVMAccountAddressType,
    owner: EVMAccountAddressType,
  ): Promise<NewTrackedAsset> {
    const known = await this.getKnownAsset(chainId, address);
    if (known?.type === EAssetType.Erc20) {
      return NewTrackedAsset.fromKnown(known);
    }

    const client = this.blockchain.getPublicClient(chainId);
    const code = await client.getCode({ address: address });
    if (!code || code === "0x") {
      throw new Error("Address is not a contract");
    }

    try {
      const [name, symbol, decimals] = await Promise.all([
        client.readContract({
          address: address,
          abi: erc20Abi,
          functionName: "name",
        }),
        client.readContract({
          address: address,
          abi: erc20Abi,
          functionName: "symbol",
        }),
        client.readContract({
          address: address,
          abi: erc20Abi,
          functionName: "decimals",
        }),
      ]);

      // Validate ERC-20 with a balanceOf probe (reverts → not ERC-20).
      await client.readContract({
        address: address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [owner],
      });

      return new NewTrackedAsset(
        chainId,
        address,
        EAssetType.Erc20,
        name,
        symbol,
        decimals,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "ERC-20 probe failed";
      throw new Error(`Not an ERC-20 token: ${message}`);
    }
  }
}
