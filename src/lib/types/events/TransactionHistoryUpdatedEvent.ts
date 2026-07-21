import type { TrackedAssetId } from "../primitives/TrackedAssetId";
import { EWalletEventKind } from "../enum/EWalletEventKind";

/** Fired after optimistic activity is recorded or history is refreshed. */
export class TransactionHistoryUpdatedEvent {
  readonly kind = EWalletEventKind.TransactionHistoryUpdated as const;
  constructor(public readonly trackedAssetId?: TrackedAssetId) {}
}
