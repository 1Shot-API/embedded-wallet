import type { TrackedAsset } from "../business/TrackedAsset";
import { EWalletEventKind } from "../enum/EWalletEventKind";

export class BalanceUpdatedEvent {
  readonly kind = EWalletEventKind.BalanceUpdated as const;
  constructor(public readonly assets: readonly TrackedAsset[]) {}
}
