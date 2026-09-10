import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
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
    public readonly address: EVMAccountAddress,
    public readonly type: EAssetType,
    public readonly name: string,
    public readonly symbol: string,
    public readonly decimals: number,
    /** Optional host- or catalog-supplied HTTPS icon URL. */
    public readonly iconUrl?: string,
    /** Higher weight sorts above peers in Balances defaults. */
    public readonly weight: number = 0,
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
    );
  }
}

/** Session-facing tracked asset with id and optional raw balance. */
export class TrackedAsset extends NewTrackedAsset {
  constructor(
    chainId: EVMChainId,
    address: EVMAccountAddress,
    type: EAssetType,
    name: string,
    symbol: string,
    decimals: number,
    public readonly id: TrackedAssetId,
    public balance: bigint | null,
    iconUrl?: string,
    weight: number = 0,
  ) {
    super(chainId, address, type, name, symbol, decimals, iconUrl, weight);
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
    );
  }
}
