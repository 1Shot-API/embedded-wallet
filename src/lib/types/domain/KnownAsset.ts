import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import type { EAssetType } from "../enum/EAssetType";

/** Catalog metadata for a known token (hardcoded registry). */
export class KnownAsset {
  constructor(
    public readonly chainId: EVMChainId,
    public readonly address: EVMAccountAddress,
    public readonly type: EAssetType,
    public readonly name: string,
    public readonly symbol: string,
    public readonly decimals: number,
    public readonly useCCTPBridge: boolean,
    public readonly iconUrl?: string,
  ) {}
}
