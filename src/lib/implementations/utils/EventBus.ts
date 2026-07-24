import type { IEventBus } from "../../interfaces/utils/IEventBus";
import { EWalletEventKind } from "../../types/enum/EWalletEventKind";
import type { BalanceUpdatedEvent } from "../../types/events/BalanceUpdatedEvent";
import type { RefreshBalanceRequestedEvent } from "../../types/events/RefreshBalanceRequestedEvent";
import type { TransactionHistoryUpdatedEvent } from "../../types/events/TransactionHistoryUpdatedEvent";
import type { WalletDomainEvent } from "../../types/events/WalletDomainEvent";

type Listener = (event: WalletDomainEvent) => void;

/** In-process typed pub/sub for wallet domain events. */
export class EventBus implements IEventBus {
  private readonly listeners = new Map<EWalletEventKind, Set<Listener>>();

  emit(event: WalletDomainEvent): void {
    const handlers = this.listeners.get(event.kind);
    if (!handlers || handlers.size === 0) return;

    for (const handler of [...handlers]) {
      try {
        handler(event);
      } catch (error: unknown) {
        console.error("[event-bus] listener failed", error);
      }
    }
  }

  onBalanceUpdated(
    handler: (event: BalanceUpdatedEvent) => void,
  ): () => void {
    return this.addListener(
      EWalletEventKind.BalanceUpdated,
      handler as Listener,
    );
  }

  onRefreshBalanceRequested(
    handler: (event: RefreshBalanceRequestedEvent) => void,
  ): () => void {
    return this.addListener(
      EWalletEventKind.RefreshBalanceRequested,
      handler as Listener,
    );
  }

  onTransactionHistoryUpdated(
    handler: (event: TransactionHistoryUpdatedEvent) => void,
  ): () => void {
    return this.addListener(
      EWalletEventKind.TransactionHistoryUpdated,
      handler as Listener,
    );
  }

  private addListener(
    kind: EWalletEventKind,
    handler: Listener,
  ): () => void {
    let handlers = this.listeners.get(kind);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(kind, handlers);
    }
    handlers.add(handler);
    return () => {
      handlers!.delete(handler);
      if (handlers!.size === 0) {
        this.listeners.delete(kind);
      }
    };
  }
}
