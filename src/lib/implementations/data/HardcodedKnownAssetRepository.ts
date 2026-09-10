import { erc20Abi, zeroAddress } from "viem";
import {
  ChainUtils,
  EVMAccountAddress,
  type EVMAccountAddress as EVMAccountAddressType,
  type EVMChainId as EVMChainIdType,
} from "@1shotapi/ows-types";
import type { IBlockchainProvider } from "@1shotapi/ows-wallet-utils";
import type { IKnownAssetRepository } from "../../interfaces/data/IKnownAssetRepository";
import { KnownAsset } from "../../types/domain/KnownAsset";
import { NewTrackedAsset } from "../../types/domain/TrackedAsset";
import { EAssetType } from "../../types/enum/EAssetType";
import { EChain } from "../../types/enum/EChain";
import { makeTrackedAssetId } from "@/lib/types/primitives";
import {
  RELAYER_KNOWN_ASSETS,
  getCctpBridgeAsset as lookupCctpBridgeAsset,
} from "./relayerKnownAssets";
import { HardcodedChainRepository } from "./HardcodedChainRepository";
import { registerKnownAssetIconResolver } from "../../utils/tokenIcons";

const NATIVE_ADDRESS = EVMAccountAddress(zeroAddress);
const NATIVE_WEIGHT = 50;

/** Arc gas is the pinned USDC ERC-20 — do not also show a zero-address Native row. */
const SKIP_NATIVE_DEFAULT = new Set([
  String(EChain.Arc).toLowerCase(),
  String(EChain.ArcTestnet).toLowerCase(),
]);

function buildNativeKnownAssets(): KnownAsset[] {
  const catalog = new HardcodedChainRepository().getCatalog();
  const natives: KnownAsset[] = [];
  for (const chain of catalog) {
    if (!ChainUtils.isEVMChainId(chain.chainId)) continue;
    const key = String(chain.chainId).toLowerCase();
    if (SKIP_NATIVE_DEFAULT.has(key)) continue;
    natives.push(
      new KnownAsset(
        chain.chainId,
        NATIVE_ADDRESS,
        EAssetType.Native,
        chain.nativeCurrency.name,
        chain.nativeCurrency.symbol,
        chain.nativeCurrency.decimals,
        false,
        NATIVE_WEIGHT,
        chain.logoUrl,
      ),
    );
  }
  return natives;
}

const NATIVE_KNOWN_ASSETS: readonly KnownAsset[] = buildNativeKnownAssets();

const ALL_KNOWN_ASSETS: readonly KnownAsset[] = [
  ...RELAYER_KNOWN_ASSETS,
  ...NATIVE_KNOWN_ASSETS,
];

const BY_KEY = new Map(
  ALL_KNOWN_ASSETS.map((asset) => [
    makeTrackedAssetId(asset.chainId, asset.address),
    asset,
  ]),
);

// Include native (chain logo) rows in the known-asset icon resolver.
registerKnownAssetIconResolver(
  (chainId, address) => BY_KEY.get(makeTrackedAssetId(chainId, address))?.iconUrl,
);

/** Chain → pinned default stablecoin symbol (always shown, not removable). */
const DEFAULT_TRACKED_STABLE_BY_CHAIN = new Map([
  [String(EChain.ArcTestnet).toLowerCase(), "USDC"],
  [String(EChain.Sepolia).toLowerCase(), "USDC"],
  [String(EChain.BaseSepolia).toLowerCase(), "USDC"],
  [String(EChain.Base).toLowerCase(), "USDC"],
  [String(EChain.Robinhood).toLowerCase(), "USDG"],
]);

function isPinnedStable(asset: KnownAsset): boolean {
  const expected = DEFAULT_TRACKED_STABLE_BY_CHAIN.get(
    String(asset.chainId).toLowerCase(),
  );
  return (
    expected != null &&
    asset.type === EAssetType.Erc20 &&
    asset.symbol === expected
  );
}

/**
 * Pinned Balances rows: default stables (weight 100) then natives (weight 50),
 * sorted by weight desc. Not removable.
 */
export const DEFAULT_TRACKED_ASSETS: readonly NewTrackedAsset[] = [
  ...RELAYER_KNOWN_ASSETS.filter(isPinnedStable),
  ...NATIVE_KNOWN_ASSETS,
]
  .sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.symbol.localeCompare(b.symbol);
  })
  .map((asset) => NewTrackedAsset.fromKnown(asset));

const DEFAULT_TRACKED_KEYS = new Set(
  DEFAULT_TRACKED_ASSETS.map((asset) =>
    makeTrackedAssetId(asset.chainId, asset.address),
  ),
);

export function isDefaultTrackedAsset(
  chainId: EVMChainIdType,
  address: EVMAccountAddressType,
): boolean {
  return DEFAULT_TRACKED_KEYS.has(makeTrackedAssetId(chainId, address));
}

export class HardcodedKnownAssetRepository implements IKnownAssetRepository {
  constructor(private readonly blockchain: IBlockchainProvider) {}

  async getKnownAsset(
    chainId: EVMChainIdType,
    address: EVMAccountAddressType,
  ): Promise<KnownAsset | null> {
    return BY_KEY.get(makeTrackedAssetId(chainId, address)) ?? null;
  }

  async getCctpBridgeAsset(
    chainId: EVMChainIdType,
  ): Promise<KnownAsset | null> {
    return lookupCctpBridgeAsset(chainId);
  }

  async resolveForTracking(
    chainId: EVMChainIdType,
    address: EVMAccountAddressType,
    owner: EVMAccountAddressType,
  ): Promise<NewTrackedAsset> {
    const known = await this.getKnownAsset(chainId, address);
    if (
      known?.type === EAssetType.Erc20 ||
      known?.type === EAssetType.Native
    ) {
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
