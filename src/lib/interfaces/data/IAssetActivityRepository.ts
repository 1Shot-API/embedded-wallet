import type {
  EVMAccountAddress,
  SolanaAccountAddress,
  TransactionHash,
} from "@1shotapi/ows-types";

import type { AssetActivity } from "../../types/domain/AssetActivity";
import type {
  KnownAssetAddress,
  KnownAssetChainId,
} from "../../types/domain/KnownAsset";
import type { TrackedAsset } from "../../types/domain/TrackedAsset";

export type ActivityOwnerAddress = EVMAccountAddress | SolanaAccountAddress;

export interface IRecordSentActivityParams {
  chainId: KnownAssetChainId;
  tokenAddress: KnownAssetAddress;
  owner: ActivityOwnerAddress;
  to: ActivityOwnerAddress;
  amount: bigint;
  decimals: number;
  hash: TransactionHash;
}

export interface IListAssetActivityParams {
  owner: ActivityOwnerAddress;
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
