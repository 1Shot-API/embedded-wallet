import { useCallback, useState } from "react";
import type { TrackedAssetId } from "../lib/types/primitives";
import { useBalanceUpdated } from "./useWalletEvent";

/**
 * Keep a tracked-asset balance in sync with {@link BalanceUpdatedEvent}.
 * List/detail props are often a snapshot; BalanceDisplay already uses this
 * pattern — send validation must too or it rejects against a stale `0n`.
 */
export function useLiveTrackedBalance(
  trackedAssetId: TrackedAssetId,
  propBalance: bigint | null,
  propDecimals: number,
): { balance: bigint | null; decimals: number } {
  const [live, setLive] = useState<{
    balance: bigint | null;
    decimals: number;
  } | null>(null);
  const [prev, setPrev] = useState({
    trackedAssetId,
    propBalance,
    propDecimals,
  });

  if (
    trackedAssetId !== prev.trackedAssetId ||
    propBalance !== prev.propBalance ||
    propDecimals !== prev.propDecimals
  ) {
    setPrev({ trackedAssetId, propBalance, propDecimals });
    setLive(null);
  }

  useBalanceUpdated(
    useCallback(
      (event) => {
        const next = event.assets.find((asset) => asset.id === trackedAssetId);
        if (!next) return;
        setLive({ balance: next.balance, decimals: next.decimals });
      },
      [trackedAssetId],
    ),
  );

  return {
    balance: live?.balance ?? propBalance,
    decimals: live?.decimals ?? propDecimals,
  };
}
