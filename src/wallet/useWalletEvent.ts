import { useEffect } from "react";
import type {
  BalanceUpdatedEvent,
  RefreshBalanceRequestedEvent,
} from "../lib/types/events";
import { useWallet } from "./WalletProvider";

/** Subscribe to BalanceUpdated for the lifetime of the component. */
export function useBalanceUpdated(
  handler: (event: BalanceUpdatedEvent) => void,
): void {
  const { eventBus } = useWallet();
  useEffect(() => eventBus.onBalanceUpdated(handler), [eventBus, handler]);
}

/** Subscribe to RefreshBalanceRequested for the lifetime of the component. */
export function useRefreshBalanceRequested(
  handler: (event: RefreshBalanceRequestedEvent) => void,
): void {
  const { eventBus } = useWallet();
  useEffect(
    () => eventBus.onRefreshBalanceRequested(handler),
    [eventBus, handler],
  );
}
