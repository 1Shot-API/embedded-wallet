import type {
  EVMAccountAddress,
  SolanaAccountAddress,
  TransactionHash,
} from "@1shotapi/ows-types";

import type { EAssetActivityKind } from "../enum/EAssetActivityKind";
import type { EAssetActivityStatus } from "../enum/EAssetActivityStatus";
import type { TrackedAssetId } from "../primitives/TrackedAssetId";

import type { KnownAssetAddress, KnownAssetChainId } from "./KnownAsset";

/** Wallet address involved in an activity row (EVM or Solana). */
export type ActivityAccountAddress = EVMAccountAddress | SolanaAccountAddress;

/** One token transfer involving the wallet owner for a tracked asset. */
export class AssetActivity {
  constructor(
    public readonly hash: TransactionHash,
    public readonly chainId: KnownAssetChainId,
    public readonly tokenAddress: KnownAssetAddress,
    public readonly trackedAssetId: TrackedAssetId,
    public readonly owner: ActivityAccountAddress,
    public readonly counterparty: ActivityAccountAddress,
    public readonly amount: bigint,
    public readonly decimals: number,
    public readonly kind: EAssetActivityKind,
    public readonly status: EAssetActivityStatus,
    /** Unix timestamp in milliseconds. */
    public readonly timestampMs: number,
  ) {}
}
