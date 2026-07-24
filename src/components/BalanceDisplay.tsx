import { cn } from "@/lib/utils";
import type { TrackedAssetId } from "../lib/types/primitives";
import { useStyle } from "../style/StyleProvider";
import { useLiveTrackedBalance } from "../wallet/useLiveTrackedBalance";
import { formatUnits } from "viem";

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
 * Props are the source of truth until an event overrides them.
 */
export function BalanceDisplay({
  trackedAssetId,
  balance: propBalance,
  decimals: propDecimals,
  fallback,
  className,
}: IBalanceDisplayProps) {
  const { style } = useStyle();
  const unavailable = fallback ?? style.copy.balances.balanceUnavailable;
  const { balance, decimals } = useLiveTrackedBalance(
    trackedAssetId,
    propBalance,
    propDecimals,
  );

  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {formatBalance(balance, decimals, unavailable)}
    </span>
  );
}
