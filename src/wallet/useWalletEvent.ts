import { useEffect } from "react";
import type {
  BalanceUpdatedEvent,
  RefreshBalanceRequestedEvent,
  TransactionHistoryUpdatedEvent,
} from "../lib/types/events";
import { useWallet } from "./WalletProvider";

/** Subscribe to BalanceUpdated for the lifetime of the component. */
export function useBalanceUpdated(
  handler: (event: BalanceUpdatedEvent) => void,
): void {
  const { eventBus } = useWallet();
  useEffect(() => {
    return eventBus.onBalanceUpdated(handler);
  }, [eventBus, handler]);
}

/** Subscribe to RefreshBalanceRequested for the lifetime of the component. */
export function useRefreshBalanceRequested(
  handler: (event: RefreshBalanceRequestedEvent) => void,
): void {
  const { eventBus } = useWallet();
  useEffect(() => {
    return eventBus.onRefreshBalanceRequested(handler);
  }, [eventBus, handler]);
}

/** Subscribe to TransactionHistoryUpdated for the lifetime of the component. */
export function useTransactionHistoryUpdated(
  handler: (event: TransactionHistoryUpdatedEvent) => void,
): void {
  const { eventBus } = useWallet();
  useEffect(() => {
    return eventBus.onTransactionHistoryUpdated(handler);
  }, [eventBus, handler]);
}
