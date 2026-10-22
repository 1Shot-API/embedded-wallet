import { formatUnits } from "viem";

import solanaLogo from "../../assets/images/chains/solana-logo.svg";
import type { TrackedAsset } from "../../lib/types/domain";
import type { SolanaLamports } from "../../lib/types/primitives/SolanaLamports";
import { resolveAssetIconUrl } from "../../lib/utils/tokenIcons";
import { useStyle } from "../../style/StyleProvider";

const SOL_DECIMALS = 9;

export type SolanaListSelection =
  | { kind: "native" }
  | { kind: "spl"; asset: TrackedAsset };

export interface ISolanaAssetListProps {
  balanceLamports: SolanaLamports | null;
  loading: boolean;
  logoUrl?: string;
  networkLabel: string;
  splAssets: TrackedAsset[];
  onSelect: (selection: SolanaListSelection) => void;
}

/**
 * Native SOL + tracked SPL rows for the Solana shell.
 * Never shows ATA addresses.
 */
export function SolanaAssetList({
  balanceLamports,
  loading,
  logoUrl,
  networkLabel,
  splAssets,
  onSelect,
}: ISolanaAssetListProps) {
  const { style } = useStyle();
  const solanaCopy = style.copy.solana;
  const balances = style.copy.balances;

  const solAmountLabel = loading
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
          onClick={() => onSelect({ kind: "native" })}
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
              {solAmountLabel} {solanaCopy.assetSymbol}
            </p>
          </div>
        </button>
      </li>
      {splAssets.map((asset) => {
        const icon =
          resolveAssetIconUrl(
            asset.chainId as never,
            asset.address as never,
            asset.symbol,
            asset.iconUrl,
          ) ?? logoUrl ?? solanaLogo;
        const amountLabel =
          asset.balance === null
            ? balances.balanceUnavailable
            : formatUnits(asset.balance, asset.decimals);
        return (
          <li key={asset.id}>
            <button
              type="button"
              className="hover:bg-muted/60 flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors"
              onClick={() => onSelect({ kind: "spl", asset })}
            >
              <img
                src={icon}
                alt=""
                className="size-10 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-sm font-medium">{asset.name}</p>
                <p className="text-muted-foreground m-0 truncate text-xs">
                  {networkLabel}
                </p>
              </div>
              <div className="text-right">
                <p className="m-0 text-sm font-medium tabular-nums">
                  {amountLabel} {asset.symbol}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
