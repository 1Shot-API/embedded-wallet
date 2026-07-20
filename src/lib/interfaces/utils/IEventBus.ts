import type {
  BalanceUpdatedEvent,
  RefreshBalanceRequestedEvent,
  WalletDomainEvent,
} from "../../types/events";

export interface IEventBus {
  emit(event: WalletDomainEvent): void;

  onBalanceUpdated(
    handler: (event: BalanceUpdatedEvent) => void,
  ): () => void;

  onRefreshBalanceRequested(
    handler: (event: RefreshBalanceRequestedEvent) => void,
  ): () => void;
}

export const IEventBusType = Symbol.for("IEventBus");
