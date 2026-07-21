import type {
  EVMAccountAddress,
  EVMChainId,
  EVMTransactionHash,
} from "@1shotapi/ows-types";
import type { AssetActivity } from "../../types/domain/AssetActivity";
import type { TrackedAsset } from "../../types/domain/TrackedAsset";

export interface IRecordSentActivityParams {
  chainId: EVMChainId;
  tokenAddress: EVMAccountAddress;
  owner: EVMAccountAddress;
  to: EVMAccountAddress;
  amount: bigint;
  decimals: number;
  hash: EVMTransactionHash;
}

export interface IListAssetActivityParams {
  owner: EVMAccountAddress;
  asset: TrackedAsset;
  /** Max rows to return (default 10). */
  limit?: number;
}

export interface IAssetActivityRepository {
  /** Indexed history merged with local optimistic sends. */
  list(params: IListAssetActivityParams): Promise<AssetActivity[]>;
  /** Persist an in-wallet send until the indexer catches up. */
  recordSent(params: IRecordSentActivityParams): Promise<AssetActivity>;
}

export const IAssetActivityRepositoryType = Symbol.for(
  "IAssetActivityRepository",
);
