import type { BalanceUpdatedEvent } from "./BalanceUpdatedEvent";
import type { RefreshBalanceRequestedEvent } from "./RefreshBalanceRequestedEvent";

export type WalletDomainEvent =
  | RefreshBalanceRequestedEvent
  | BalanceUpdatedEvent;
