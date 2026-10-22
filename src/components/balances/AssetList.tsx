import { ChainUtils } from "@1shotapi/ows-types";
import { RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import type { TrackedAsset } from "../../lib/types/domain";
import { EAssetType } from "../../lib/types/enum/EAssetType";
import { useStyle } from "../../style/StyleProvider";
import { useWalletSessionStore } from "../../wallet/sessionStore";
import { useWallet } from "../../wallet/WalletProvider";
import { AssetIcon } from "../AssetIcon";
import { BalanceDisplay } from "../BalanceDisplay";

export function AssetList({
  onView,
}: {
  onView: (asset: TrackedAsset) => void;
}) {
  const { style } = useStyle();
  const { balances: copy } = style.copy;
  const { listTrackedAssets, requestBalanceRefresh, resolveChain } =
    useWallet();
  const trackedAssetCount = useWalletSessionStore(
    (state) => state.trackedAssetCount,
  );
  const chainId = useWalletSessionStore((state) => state.chainId);
  const evmAddress = useWalletSessionStore((state) => state.evmAddress);

  const [rows, setRows] = useState<TrackedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Metadata + cache only (no RPC) so the list can paint immediately.
      const tracked = ChainUtils.isEVMChainId(chainId)
        ? await listTrackedAssets(chainId)
        : [];
      setRows(tracked);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : copy.loadFailedError);
    } finally {
      setLoading(false);
    }
    // Active-chain balances in the background; BalanceDisplay stays live via events.
    if (ChainUtils.isEVMChainId(chainId)) {
      void requestBalanceRefresh(undefined, chainId).catch(() => {
        /* list already painted; refresh errors stay in console */
      });
    }
  }, [
    listTrackedAssets,
    chainId,
    copy.loadFailedError,
    requestBalanceRefresh,
  ]);

  useEffect(() => {
    void reload();
  }, [reload, trackedAssetCount, evmAddress]);

  const onRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      if (!ChainUtils.isEVMChainId(chainId)) {
        setRows([]);
        return;
      }
      await requestBalanceRefresh(undefined, chainId);
      setRows(await listTrackedAssets(chainId));
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : copy.refreshFailedError,
      );
    } finally {
      setRefreshing(false);
    }
  };

  const networkLabel =
    resolveChain(chainId)?.label ?? String(chainId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground m-0 text-xs">
          {rows.length === 0
            ? copy.emptyCountLabel
            : copy.countLabel.replace("{count}", String(rows.length))}
        </p>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={copy.refreshLabel}
          disabled={refreshing || loading}
          onClick={() => {
            void onRefresh();
          }}
        >
          <RefreshCwIcon
            className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      {error ? (
        <p className="text-destructive m-0 text-sm">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-muted-foreground m-0 text-sm">{copy.loadingBody}</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground m-0 text-sm">{copy.emptyBody}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {rows.map((asset) => (
            <li key={asset.id}>
              <button
                type="button"
                className="hover:bg-muted/60 flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors"
                aria-label={`${copy.viewLabel} ${asset.symbol}`}
                onClick={() => onView(asset)}
              >
                <AssetIcon
                  chainId={asset.chainId}
                  address={asset.address}
                  symbol={asset.symbol}
                  iconUrl={asset.iconUrl}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-medium">
                    {asset.name || asset.symbol}
                  </p>
                  <p className="text-muted-foreground m-0 truncate text-xs">
                    {networkLabel}
                  </p>
                </div>
                <div className="text-right">
                  <p className="m-0 text-sm font-medium tabular-nums">
                    <BalanceDisplay
                      trackedAssetId={asset.id}
                      balance={asset.balance}
                      decimals={asset.decimals}
                      fallback={
                        asset.type !== EAssetType.Erc20 &&
                        asset.type !== EAssetType.Native
                          ? copy.balanceNonErc20
                          : undefined
                      }
                      className="inline text-sm font-medium tabular-nums"
                    />{" "}
                    {asset.symbol}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
