import { erc20Abi } from "viem";
import {
  EVMAccountAddress,
  EVMChainId,
  type EVMAccountAddress as EVMAccountAddressType,
  type EVMChainId as EVMChainIdType,
} from "@1shotapi/ows-types";
import type { IBlockchainProvider } from "../../interfaces/utils/IBlockchainProvider";
import type { IKnownAssetRepository } from "../../interfaces/data/IKnownAssetRepository";
import {
  KnownAsset,
  NewTrackedAsset,
} from "../../types/business";
import { EAssetType } from "../../types/enum";
import { makeTrackedAssetId } from "@/lib/types/primitives";

/** Seeded known ERC-20s for demos (USDC on every DEMO_CHAINS network + Base USDT). */
const SEEDED_KNOWN: readonly KnownAsset[] = [
  new KnownAsset(
    EVMChainId("0x4cef52"),
    EVMAccountAddress("0x3600000000000000000000000000000000000000"),
    EAssetType.Erc20,
    "USDC",
    "USDC",
    6,
  ),
  new KnownAsset(
    EVMChainId("0xaa36a7"),
    EVMAccountAddress("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"),
    EAssetType.Erc20,
    "USDC",
    "USDC",
    6,
  ),
  new KnownAsset(
    EVMChainId("0x14a34"),
    EVMAccountAddress("0x036CbD53842c5426634e7929541eC2318f3dCF7e"),
    EAssetType.Erc20,
    "USDC",
    "USDC",
    6,
  ),
  new KnownAsset(
    EVMChainId("0x2105"),
    EVMAccountAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
    EAssetType.Erc20,
    "USDC",
    "USDC",
    6,
  ),
  new KnownAsset(
    EVMChainId("0x2105"),
    EVMAccountAddress("0xfde4c96c8593536e31f229ea8f37b2ada2699bb2"),
    EAssetType.Erc20,
    "USDT",
    "USDT",
    6,
  ),
];

const BY_KEY = new Map(
  SEEDED_KNOWN.map((asset) => [
    makeTrackedAssetId(asset.chainId, asset.address),
    asset,
  ]),
);

/**
 * USDC on every supported demo chain — always shown in Balances (not removable).
 */
export const DEFAULT_TRACKED_USDC: readonly NewTrackedAsset[] =
  SEEDED_KNOWN.filter((asset) => asset.symbol === "USDC").map((asset) =>
    NewTrackedAsset.fromKnown(asset),
  );

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
