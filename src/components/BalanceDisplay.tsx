import { useCallback, useEffect, useState } from "react";
import { formatUnits } from "viem";
import { cn } from "@/lib/utils";
import type { TrackedAssetId } from "../lib/types/primitives";
import { useBalanceUpdated } from "../wallet/useWalletEvent";

export interface IBalanceDisplayProps {
  trackedAssetId: TrackedAssetId;
  balance: bigint | null;
  decimals: number;
  className?: string;
}

function formatBalance(balance: bigint | null, decimals: number): string {
  if (balance === null) return "—";
  try {
    return formatUnits(balance, decimals);
  } catch {
    return "—";
  }
}

/**
 * Formats a raw token balance and stays live via BalanceUpdated events.
 */
export function BalanceDisplay({
  trackedAssetId,
  balance: initialBalance,
  decimals: initialDecimals,
  className,
}: IBalanceDisplayProps) {
  const [balance, setBalance] = useState(initialBalance);
  const [decimals, setDecimals] = useState(initialDecimals);

  useEffect(() => {
    setBalance(initialBalance);
    setDecimals(initialDecimals);
  }, [initialBalance, initialDecimals, trackedAssetId]);

  useBalanceUpdated(
    useCallback(
      (event) => {
        const next = event.assets.find(
          (asset) => asset.id === trackedAssetId,
        );
        if (!next) return;
        setBalance(next.balance);
        setDecimals(next.decimals);
      },
      [trackedAssetId],
    ),
  );

  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {formatBalance(balance, decimals)}
    </span>
  );
}
