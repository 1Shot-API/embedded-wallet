import type { TrackedAssetId } from "../primitives/TrackedAssetId";
import { EWalletEventKind } from "../enum/EWalletEventKind";

export class RefreshBalanceRequestedEvent {
  readonly kind = EWalletEventKind.RefreshBalanceRequested as const;
  constructor(public readonly trackedAssetId?: TrackedAssetId) {}
}
