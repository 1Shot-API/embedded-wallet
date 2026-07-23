import { useCallback, useState } from "react";
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

type LiveBalance = {
  balance: bigint | null;
  decimals: number;
};

/**
 * Formats a raw token balance and stays live via BalanceUpdated events.
 * Props are the source of truth; event updates override until the asset or
 * props change (reset during render — no prop→state sync effect).
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
  const [live, setLive] = useState<LiveBalance | null>(null);
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
        const next = event.assets.find(
          (asset) => asset.id === trackedAssetId,
        );
        if (!next) return;
        setLive({ balance: next.balance, decimals: next.decimals });
      },
      [trackedAssetId],
    ),
  );

  const balance = live?.balance ?? propBalance;
  const decimals = live?.decimals ?? propDecimals;

  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {formatBalance(balance, decimals, unavailable)}
    </span>
  );
}
