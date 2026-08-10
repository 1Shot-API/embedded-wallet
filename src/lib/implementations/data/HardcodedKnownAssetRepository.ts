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

const DEFAULT_TRACKED_USDC_CHAIN_IDS = new Set([
  "0x13b2",
  "0x4cef52",
  "0xaa36a7",
  "0x14a34",
  "0x2105",
]);

/**
 * USDC on every supported demo chain — always shown in Balances (not removable).
 */
export const DEFAULT_TRACKED_USDC: readonly NewTrackedAsset[] =
  RELAYER_KNOWN_ASSETS.filter(
    (asset) =>
      asset.symbol === "USDC" &&
      DEFAULT_TRACKED_USDC_CHAIN_IDS.has(
        String(asset.chainId).toLowerCase(),
      ),
  ).map((asset) => NewTrackedAsset.fromKnown(asset));

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
