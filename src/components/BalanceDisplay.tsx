import { useCallback, useEffect, useState } from "react";
import { formatUnits } from "viem";
import { cn } from "@/lib/utils";
import type { TrackedAssetId } from "../lib/types/primitives";
import { useStyle } from "../style/StyleProvider";
import { useBalanceUpdated } from "../wallet/useWalletEvent";

export interface IBalanceDisplayProps {
  trackedAssetId: TrackedAssetId;
  balance: bigint | null;
  decimals: number;
  /** Override for null / unformatable balances (e.g. non-ERC-20). */
  fallback?: string;
  className?: string;
}

function formatBalance(
  balance: bigint | null,
  decimals: number,
  unavailable: string,
): string {
  if (balance === null) return unavailable;
  try {
    return formatUnits(balance, decimals);
  } catch {
    return unavailable;
  }
}

/**
 * Formats a raw token balance and stays live via BalanceUpdated events.
 */
export function BalanceDisplay({
  trackedAssetId,
  balance: initialBalance,
  decimals: initialDecimals,
  fallback,
  className,
}: IBalanceDisplayProps) {
  const { style } = useStyle();
  const unavailable = fallback ?? style.copy.balances.balanceUnavailable;
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
      {formatBalance(balance, decimals, unavailable)}
    </span>
  );
}
