import type { OWSAnalyticsEvent } from "@1shotapi/ows-types";

import type {
  BalanceUpdatedEvent,
  RefreshBalanceRequestedEvent,
  TransactionHistoryUpdatedEvent,
  WalletDomainEvent,
} from "../../types/events";

export interface IEventBus {
  emit(event: WalletDomainEvent): void;

  /** Branding analytics channel (separate from balance/history domain events). */
  emitAnalytics(event: OWSAnalyticsEvent): void;

  onBalanceUpdated(
    handler: (event: BalanceUpdatedEvent) => void,
  ): () => void;

  onRefreshBalanceRequested(
    handler: (event: RefreshBalanceRequestedEvent) => void,
  ): () => void;

  onTransactionHistoryUpdated(
    handler: (event: TransactionHistoryUpdatedEvent) => void,
  ): () => void;

  onAnalytics(handler: (event: OWSAnalyticsEvent) => void): () => void;
}

export const IEventBusType = Symbol.for("IEventBus");
