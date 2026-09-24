import type { EVMChainId, EVMContractAddress } from "@1shotapi/ows-types";
import {
  makeTrackedAssetId,
  type TrackedAssetId,
} from "../primitives/TrackedAssetId";
import type { EAssetType } from "../enum/EAssetType";
import type { KnownAsset } from "./KnownAsset";

/**
 * Persistable tracked-asset DTO (no session id/balance).
 * Constructed from the known catalog or an on-chain ERC-20 probe.
 */
export class NewTrackedAsset {
  constructor(
    public readonly chainId: EVMChainId,
    /** Token contract, or zero address for native. */
    public readonly address: EVMContractAddress,
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
    );
  }
}

/** Session-facing tracked asset with id and optional raw balance. */
export class TrackedAsset extends NewTrackedAsset {
  constructor(
    chainId: EVMChainId,
    address: EVMContractAddress,
    type: EAssetType,
    name: string,
    symbol: string,
    decimals: number,
    public readonly id: TrackedAssetId,
    public balance: bigint | null,
    iconUrl?: string,
    weight: number = 0,
    canBuy: boolean = false,
  ) {
    super(chainId, address, type, name, symbol, decimals, iconUrl, weight, canBuy);
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
    );
  }
}
