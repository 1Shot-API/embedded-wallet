import { formatUnits } from "viem";

import solanaLogo from "../../assets/images/chains/solana-logo.svg";
import type { SolanaLamports } from "../../lib/types/primitives/SolanaLamports";
import { useStyle } from "../../style/StyleProvider";

const SOL_DECIMALS = 9;

export interface ISolanaAssetListProps {
  balanceLamports: SolanaLamports | null;
  loading: boolean;
  logoUrl?: string;
  networkLabel: string;
  onSelect: () => void;
}

/**
 * Single-row native SOL list for the Solana shell (Phase 3 — no SPL mints).
 */
export function SolanaAssetList({
  balanceLamports,
  loading,
  logoUrl,
  networkLabel,
  onSelect,
}: ISolanaAssetListProps) {
  const { style } = useStyle();
  const solanaCopy = style.copy.solana;
  const balances = style.copy.balances;

  const amountLabel = loading
    ? solanaCopy.loadingBody
    : balanceLamports === null
      ? balances.balanceUnavailable
      : formatUnits(balanceLamports, SOL_DECIMALS);

  return (
    <ul className="m-0 list-none p-0">
      <li>
        <button
          type="button"
          className="hover:bg-muted/60 flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors"
          onClick={onSelect}
        >
          <img
            src={logoUrl ?? solanaLogo}
            alt=""
            className="size-10 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-sm font-medium">
              {solanaCopy.assetName}
            </p>
            <p className="text-muted-foreground m-0 truncate text-xs">
              {networkLabel}
            </p>
          </div>
          <div className="text-right">
            <p className="m-0 text-sm font-medium tabular-nums">
              {amountLabel} {solanaCopy.assetSymbol}
            </p>
          </div>
        </button>
      </li>
    </ul>
  );
}
