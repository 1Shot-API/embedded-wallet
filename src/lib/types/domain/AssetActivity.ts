import type {
  EVMAccountAddress,
  EVMChainId,
  EVMTransactionHash,
} from "@1shotapi/ows-types";
import type { EAssetActivityKind } from "../enum/EAssetActivityKind";
import type { EAssetActivityStatus } from "../enum/EAssetActivityStatus";
import type { TrackedAssetId } from "../primitives/TrackedAssetId";

/** One ERC-20 transfer involving the wallet owner for a tracked asset. */
export class AssetActivity {
  constructor(
    public readonly hash: EVMTransactionHash,
    public readonly chainId: EVMChainId,
    public readonly tokenAddress: EVMAccountAddress,
    public readonly trackedAssetId: TrackedAssetId,
    public readonly owner: EVMAccountAddress,
    public readonly counterparty: EVMAccountAddress,
    public readonly amount: bigint,
    public readonly decimals: number,
    public readonly kind: EAssetActivityKind,
    public readonly status: EAssetActivityStatus,
    /** Unix timestamp in milliseconds. */
    public readonly timestampMs: number,
  ) {}
}
