import type { BalanceUpdatedEvent } from "./BalanceUpdatedEvent";
import type { RefreshBalanceRequestedEvent } from "./RefreshBalanceRequestedEvent";
import type { TransactionHistoryUpdatedEvent } from "./TransactionHistoryUpdatedEvent";

export type WalletDomainEvent =
  | RefreshBalanceRequestedEvent
  | BalanceUpdatedEvent
  | TransactionHistoryUpdatedEvent;
