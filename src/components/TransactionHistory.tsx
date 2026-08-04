import { useCallback, useEffect, useState } from "react";
import { formatUnits } from "viem";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
} from "lucide-react";
import type { EVMAccountAddress } from "@1shotapi/ows-types";
import type { AssetActivity, TrackedAsset } from "../lib/types/domain";
import { EAssetActivityKind } from "../lib/types/enum/EAssetActivityKind";
import { EAssetActivityStatus } from "../lib/types/enum/EAssetActivityStatus";
import { useWallet } from "../wallet/WalletProvider";
import { useTransactionHistoryUpdated } from "../wallet/useWalletEvent";

const RECENT_LIMIT = 10;
const TRUNCATE_CHARS = 5;

const ACTIVITY_WHEN_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export interface ITransactionHistoryProps {
  asset: TrackedAsset;
  owner: EVMAccountAddress | null;
}

function truncateAddress(address: string): string {
  if (address.length <= TRUNCATE_CHARS * 2 + 1) {
    return address;
  }
  return `${address.slice(0, TRUNCATE_CHARS)}…${address.slice(-TRUNCATE_CHARS)}`;
}

function formatWhen(timestampMs: number): string {
  if (!timestampMs) {
    return "Unknown time";
  }
  try {
    return ACTIVITY_WHEN_FORMAT.format(new Date(timestampMs));
  } catch {
    return new Date(timestampMs).toLocaleString();
  }
}

function formatSignedAmount(activity: AssetActivity, symbol: string): string {
  let amount: string;
  try {
    amount = formatUnits(activity.amount, activity.decimals);
  } catch {
    amount = activity.amount.toString();
  }
  const sign =
    activity.kind === EAssetActivityKind.Received ? "+" : "-";
  return `${sign}${amount} ${symbol}`;
}

function activityTitle(activity: AssetActivity): string {
  const peer = truncateAddress(String(activity.counterparty));
  if (activity.kind === EAssetActivityKind.Sent) {
    const pending =
      activity.status === EAssetActivityStatus.Pending ? " (pending)" : "";
    return `Sent to ${peer}${pending}`;
  }
  return `Received from ${peer}`;
}

function ActivityIcon({ kind }: { kind: EAssetActivityKind }) {
  const className = "size-4 text-muted-foreground";
  if (kind === EAssetActivityKind.Received) {
    return <ArrowDownLeftIcon className={className} />;
  }
  return <ArrowUpRightIcon className={className} />;
}

/**
 * Recent ERC-20 transfers for a tracked asset (Alchemy + optimistic local sends).
 */
export function TransactionHistory({
  asset,
  owner,
}: ITransactionHistoryProps) {
  const { listAssetActivity, resolveChain } = useWallet();
  const [rows, setRows] = useState<AssetActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!owner) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await listAssetActivity(owner, asset, RECENT_LIMIT);
      setRows(next);
    } catch (err: unknown) {
      console.error("[oneshot-wallet] activity load failed", err);
      setError(
        err instanceof Error ? err.message : "Failed to load activity",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [asset, listAssetActivity, owner]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useTransactionHistoryUpdated(
    useCallback(
      (event) => {
        if (
          event.trackedAssetId !== undefined &&
          event.trackedAssetId !== asset.id
        ) {
          return;
        }
        void refresh();
      },
      [asset.id, refresh],
    ),
  );

  const chain = resolveChain(asset.chainId);
  const viewAllUrl =
    owner !== null && chain
      ? chain.addressExplorerUrl(owner)
      : null;

  return (
    <section className="border-border flex min-h-0 flex-1 flex-col gap-3 border-t pt-4">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h3 className="text-foreground text-sm font-semibold">
          Recent Activity
        </h3>
        {viewAllUrl ? (
          <a
            href={viewAllUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary text-sm font-medium"
          >
            View all
          </a>
        ) : (
          <button
            type="button"
            className="text-primary text-sm font-medium"
            disabled
          >
            View all
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : null}
        {error && rows.length === 0 ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No recent activity.</p>
        ) : null}

        {rows.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {rows.map((item) => {
            const explorerUrl = chain?.txExplorerUrl(item.hash);
            const positive = item.kind === EAssetActivityKind.Received;
            const content = (
              <>
                <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
                  <ActivityIcon kind={item.kind} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">
                    {activityTitle(item)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatWhen(item.timestampMs)}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-sm font-medium ${
                    positive ? "text-primary" : "text-foreground"
                  }`}
                >
                  {formatSignedAmount(item, asset.symbol)}
                </p>
              </>
            );

            return (
              <li key={`${item.hash}-${item.kind}`}>
                {explorerUrl ? (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:bg-muted/60 flex items-center gap-3 rounded-lg py-2"
                  >
                    {content}
                  </a>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg py-2">
                    {content}
                  </div>
                )}
              </li>
            );
          })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
