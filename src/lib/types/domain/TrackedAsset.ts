import {
  ChainUtils,
  type EVMChainId,
  type EVMContractAddress,
  type SolanaATAAddress,
  type SolanaChainId,
  type SolanaMintAddress,
} from "@1shotapi/ows-types";

import { EAssetType } from "../enum/EAssetType";
import {
  makeTrackedAssetId,
  type TrackedAssetId,
} from "../primitives/TrackedAssetId";

import type {
  KnownAsset,
  KnownAssetAddress,
  KnownAssetChainId,
} from "./KnownAsset";

/**
 * Persistable tracked-asset DTO (no session id/balance).
 * Constructed from the known catalog or an on-chain ERC-20 / SPL probe.
 */
export class NewTrackedAsset {
  constructor(
    public readonly chainId: KnownAssetChainId,
    /** Token contract / mint, or zero address for EVM native. */
    public readonly address: KnownAssetAddress,
    public readonly type: EAssetType,
    public readonly name: string,
    public readonly symbol: string,
    public readonly decimals: number,
    /** Optional host- or catalog-supplied HTTPS icon URL. */
    public readonly iconUrl?: string,
    /** Higher weight sorts above peers in Balances defaults. */
    public readonly weight: number = 0,
    /** When true, Asset Details shows Circle onramp Buy. */
    public readonly canBuy: boolean = false,
    /**
     * User’s associated token account when known (SPL only).
     * EVM rows leave `null`.
     */
    public readonly ataAddress: SolanaATAAddress | null = null,
    /**
     * Whether the ATA account exists / rent is locked (SPL only).
     * EVM rows leave `null`.
     */
    public readonly ataRentPaid: boolean | null = null,
  ) {}

  static fromKnown(known: KnownAsset): NewTrackedAsset {
    return new NewTrackedAsset(
      known.chainId,
      known.address,
      known.type,
      known.name,
      known.symbol,
      known.decimals,
      known.iconUrl,
      known.weight,
      known.canBuy,
      null,
      null,
    );
  }

  withIconUrl(iconUrl: string | undefined): NewTrackedAsset {
    return new NewTrackedAsset(
      this.chainId,
      this.address,
      this.type,
      this.name,
      this.symbol,
      this.decimals,
      iconUrl,
      this.weight,
      this.canBuy,
      this.ataAddress,
      this.ataRentPaid,
    );
  }

  withAta(
    ataAddress: SolanaATAAddress | null,
    ataRentPaid: boolean | null,
  ): NewTrackedAsset {
    return new NewTrackedAsset(
      this.chainId,
      this.address,
      this.type,
      this.name,
      this.symbol,
      this.decimals,
      this.iconUrl,
      this.weight,
      this.canBuy,
      ataAddress,
      ataRentPaid,
    );
  }
}

/** Session-facing tracked asset with id and optional raw balance. */
export class TrackedAsset extends NewTrackedAsset {
  constructor(
    chainId: KnownAssetChainId,
    address: KnownAssetAddress,
    type: EAssetType,
    name: string,
    symbol: string,
    decimals: number,
    public readonly id: TrackedAssetId,
    public balance: bigint | null,
    iconUrl?: string,
    weight: number = 0,
    canBuy: boolean = false,
    ataAddress: SolanaATAAddress | null = null,
    ataRentPaid: boolean | null = null,
  ) {
    super(
      chainId,
      address,
      type,
      name,
      symbol,
      decimals,
      iconUrl,
      weight,
      canBuy,
      ataAddress,
      ataRentPaid,
    );
  }

  static fromNew(
    asset: NewTrackedAsset,
    balance: bigint | null = null,
  ): TrackedAsset {
    return new TrackedAsset(
      asset.chainId,
      asset.address,
      asset.type,
      asset.name,
      asset.symbol,
      asset.decimals,
      makeTrackedAssetId(asset.chainId, asset.address),
      balance,
      asset.iconUrl,
      asset.weight,
      asset.canBuy,
      asset.ataAddress,
      asset.ataRentPaid,
    );
  }

  withBalance(balance: bigint | null): TrackedAsset {
    return new TrackedAsset(
      this.chainId,
      this.address,
      this.type,
      this.name,
      this.symbol,
      this.decimals,
      this.id,
      balance,
      this.iconUrl,
      this.weight,
      this.canBuy,
      this.ataAddress,
      this.ataRentPaid,
    );
  }

  withAta(
    ataAddress: SolanaATAAddress | null,
    ataRentPaid: boolean | null,
  ): TrackedAsset {
    return new TrackedAsset(
      this.chainId,
      this.address,
      this.type,
      this.name,
      this.symbol,
      this.decimals,
      this.id,
      this.balance,
      this.iconUrl,
      this.weight,
      this.canBuy,
      ataAddress,
      ataRentPaid,
    );
  }
}

/** EVM tracked row. */
export type EVMTrackedAsset = TrackedAsset & {
  readonly chainId: EVMChainId;
  readonly address: EVMContractAddress;
  readonly type:
    | EAssetType.Native
    | EAssetType.Erc20
    | EAssetType.Erc721
    | EAssetType.Erc1155;
};

/** Solana SPL tracked row. */
export type SolanaTrackedAsset = TrackedAsset & {
  readonly chainId: SolanaChainId;
  readonly address: SolanaMintAddress;
  readonly type: EAssetType.Spl;
};

export function isSolanaTrackedAsset(
  asset: TrackedAsset | NewTrackedAsset,
): asset is SolanaTrackedAsset {
  return (
    asset.type === EAssetType.Spl || ChainUtils.isSolanaChainId(asset.chainId)
  );
}

export function isEvmTrackedAsset(
  asset: TrackedAsset | NewTrackedAsset,
): asset is EVMTrackedAsset {
  return !isSolanaTrackedAsset(asset);
}
