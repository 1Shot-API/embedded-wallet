import { ChainUtils } from "@1shotapi/ows-types";

import type {
  IAssetActivityRepository,
  IListAssetActivityParams,
  IRecordSentActivityParams,
} from "../../interfaces/data/IAssetActivityRepository";
import type { AssetActivity } from "../../types/domain/AssetActivity";

/**
 * Routes asset activity to the EVM (Blockscout) or Solana (Alchemy ATA) backend.
 */
export class CompositeAssetActivityRepository
  implements IAssetActivityRepository
{
  constructor(
    private readonly evm: IAssetActivityRepository,
    private readonly solana: IAssetActivityRepository,
  ) {}

  list(params: IListAssetActivityParams): Promise<AssetActivity[]> {
    if (ChainUtils.isSolanaChainId(params.asset.chainId)) {
      return this.solana.list(params);
    }
    return this.evm.list(params);
  }

  recordSent(params: IRecordSentActivityParams): Promise<AssetActivity> {
    if (ChainUtils.isSolanaChainId(params.chainId)) {
      return this.solana.recordSent(params);
    }
    return this.evm.recordSent(params);
  }
}
