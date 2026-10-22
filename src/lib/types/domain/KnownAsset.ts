import {
  ChainUtils,
  type EVMChainId,
  type EVMContractAddress,
  type SolanaChainId,
  type SolanaMintAddress,
} from "@1shotapi/ows-types";

import { EAssetType } from "../enum/EAssetType";

/** Catalog chain id: EVM hex or Solana CAIP-2. */
export type KnownAssetChainId = EVMChainId | SolanaChainId;

/** Catalog address: EVM contract (or zero for native) or Solana mint. */
export type KnownAssetAddress = EVMContractAddress | SolanaMintAddress;

/** Catalog metadata for a known token (hardcoded registry). */
export class KnownAsset {
  constructor(
    public readonly chainId: KnownAssetChainId,
    /** Token contract / mint, or zero address for EVM native. */
    public readonly address: KnownAssetAddress,
    public readonly type: EAssetType,
    public readonly name: string,
    public readonly symbol: string,
    public readonly decimals: number,
    public readonly useCCTPBridge: boolean,
    /** When true, Asset Details shows Circle onramp Buy. */
    public readonly canBuy: boolean = false,
    /** Higher weight sorts above peers in Balances defaults (e.g. stable > native). */
    public readonly weight: number = 0,
    public readonly iconUrl?: string,
  ) {}
}

/** EVM catalog row (native / ERC-20 / NFT). */
export type EVMKnownAsset = KnownAsset & {
  readonly chainId: EVMChainId;
  readonly address: EVMContractAddress;
  readonly type:
    | EAssetType.Native
    | EAssetType.Erc20
    | EAssetType.Erc721
    | EAssetType.Erc1155;
};

/** Solana SPL mint catalog row. */
export type SolanaKnownAsset = KnownAsset & {
  readonly chainId: SolanaChainId;
  readonly address: SolanaMintAddress;
  readonly type: EAssetType.Spl;
};

export function isSolanaKnownAsset(asset: KnownAsset): asset is SolanaKnownAsset {
  return (
    asset.type === EAssetType.Spl || ChainUtils.isSolanaChainId(asset.chainId)
  );
}

export function isEvmKnownAsset(asset: KnownAsset): asset is EVMKnownAsset {
  return !isSolanaKnownAsset(asset);
}
