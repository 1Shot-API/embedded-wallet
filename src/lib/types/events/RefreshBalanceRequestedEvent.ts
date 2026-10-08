import { EWalletEventKind } from "../enum/EWalletEventKind";
import type { TrackedAssetId } from "../primitives/TrackedAssetId";

export class RefreshBalanceRequestedEvent {
  readonly kind = EWalletEventKind.RefreshBalanceRequested as const;
  constructor(public readonly trackedAssetId?: TrackedAssetId) {}
}
