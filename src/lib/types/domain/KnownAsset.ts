import type { EVMChainId, EVMContractAddress } from "@1shotapi/ows-types";
import type { EAssetType } from "../enum/EAssetType";

/** Catalog metadata for a known token (hardcoded registry). */
export class KnownAsset {
  constructor(
    public readonly chainId: EVMChainId,
    /** Token contract, or zero address for native. */
    public readonly address: EVMContractAddress,
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
