import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { Button } from "@/components/ui/button";
import {
  LIFI_SWAP_APPROVE,
  LIFI_SWAP_PERIODIC,
} from "../../lib/interfaces/business/IDelegationService";
import type { IDelegationSummary } from "../../lib/types/domain/StoredDelegation";
import type { DelegationId } from "../../lib/types/primitives/DelegationId";
import { useStyle } from "../../style/StyleProvider";
import { useWallet } from "../../wallet/WalletProvider";
import { faviconUrl, truncateAddress } from "../../lib/utils/identityDisplay";

function fillTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

function formatDuration(seconds: number): string {
  if (seconds % 86_400 === 0) {
    const days = seconds / 86_400;
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (seconds % 3_600 === 0) {
    const hours = seconds / 3_600;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }
  return seconds === 1 ? "1 second" : `${seconds} seconds`;
}

interface IDelegationGroup {
  hostDomain: string;
  rows: IDelegationSummary[];
}

function groupByHost(rows: IDelegationSummary[]): IDelegationGroup[] {
  const map = new Map<string, IDelegationSummary[]>();
  for (const row of rows) {
    const key = String(row.hostDomain) || "unknown";
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hostDomain, groupRows]) => ({
      hostDomain,
      rows: [...groupRows].sort(
        (a, b) => Number(b.createdAt) - Number(a.createdAt),
      ),
    }));
}

function DelegationRowSummary({ row }: { row: IDelegationSummary }) {
  const { style } = useStyle();
  const { getKnownAsset, resolveChain } = useWallet();
  const copy = style.copy.delegations;
  const [symbol, setSymbol] = useState(
    row.tokenAddress ? truncateAddress(row.tokenAddress) : "TOKEN",
  );
  const [decimals, setDecimals] = useState(18);

  useEffect(() => {
    if (!row.tokenAddress) return;
    let cancelled = false;
    void getKnownAsset(row.chainId, row.tokenAddress)
      .then((known) => {
        if (cancelled || !known) return;
        setSymbol(known.symbol);
        setDecimals(known.decimals);
      })
      .catch(() => {
        /* keep truncated address fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [getKnownAsset, row.chainId, row.tokenAddress]);

  const chainLabel =
    resolveChain(row.chainId)?.label ?? String(row.chainId);

  const destinationLabel = (() => {
    if (row.destinationChainId === undefined) return "destination";
    const raw = row.destinationChainId;
    const asHex =
      raw.startsWith("0x") || raw.startsWith("0X")
        ? raw
        : /^\d+$/.test(raw)
          ? `0x${BigInt(raw).toString(16)}`
          : null;
    if (asHex) {
      const known = resolveChain(asHex as never);
      if (known) return known.label;
    }
    return raw;
  })();

  let detail: string;
  if (row.permissionType === LIFI_SWAP_APPROVE && row.tokenAddress) {
    detail = fillTemplate(copy.approveSummary, { symbol });
  } else if (
    row.permissionType === LIFI_SWAP_PERIODIC &&
    row.tokenAddress &&
    row.periodAmount !== undefined &&
    row.periodDuration !== undefined
  ) {
    let amountText: string = row.periodAmount;
    try {
      amountText = formatUnits(BigInt(row.periodAmount), decimals);
    } catch {
      /* keep hex */
    }
    detail = fillTemplate(copy.swapSummary, {
      amount: amountText,
      symbol,
      duration: formatDuration(row.periodDuration),
      dest: destinationLabel,
    });
  } else if (
    row.tokenAddress &&
    row.periodAmount !== undefined &&
    row.periodDuration !== undefined
  ) {
    let amountText: string = row.periodAmount;
    try {
      amountText = formatUnits(BigInt(row.periodAmount), decimals);
    } catch {
      /* keep hex */
    }
    detail = fillTemplate(copy.periodSummary, {
      amount: amountText,
      symbol,
      duration: formatDuration(row.periodDuration),
    });
  } else {
    detail = fillTemplate(copy.permissionSummary, {
      permissionType: row.permissionType,
      to: truncateAddress(row.to),
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <p className="text-foreground m-0 truncate text-sm font-medium">
        {row.memo.trim() ? row.memo : copy.noMemoLabel}
      </p>
      <p className="text-muted-foreground m-0 truncate text-xs">{detail}</p>
      <p className="text-muted-foreground m-0 truncate text-[0.7rem]">
        {chainLabel} · {truncateAddress(row.to)}
      </p>
    </div>
  );
}

export function DelegationsList({
  rows,
  selectedIds,
  canceling,
  onToggle,
  onCancelSelected,
}: {
  rows: IDelegationSummary[];
  selectedIds: ReadonlySet<DelegationId>;
  canceling: boolean;
  onToggle: (delegationId: DelegationId) => void;
  onCancelSelected: () => void;
}) {
  const { style } = useStyle();
  const copy = style.copy.delegations;
  const groups = useMemo(() => groupByHost(rows), [rows]);
  const selectedCount = selectedIds.size;

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group.hostDomain} className="flex flex-col gap-2">
          <header className="flex items-center gap-2">
            <img
              src={faviconUrl(group.hostDomain)}
              alt=""
              width={16}
              height={16}
              className="size-4 rounded-sm"
            />
            <h3 className="text-foreground m-0 truncate text-xs font-semibold tracking-wide uppercase">
              {group.hostDomain}
            </h3>
          </header>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {group.rows.map((row) => {
              const checked = selectedIds.has(row.delegationId);
              return (
                <li
                  key={row.delegationId}
                  className="border-border flex items-start gap-2 border-b pb-2 last:border-b-0 last:pb-0"
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      className="border-input bg-background text-primary mt-1 size-4 shrink-0 rounded border accent-[var(--primary)]"
                      checked={checked}
                      disabled={canceling}
                      onChange={() => onToggle(row.delegationId)}
                    />
                    <DelegationRowSummary row={row} />
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {selectedCount > 0 ? (
        <div className="border-border flex items-center justify-between gap-2 border-t pt-3">
          <p className="text-muted-foreground m-0 text-xs">
            {selectedCount} selected
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={canceling}
            onClick={onCancelSelected}
          >
            {copy.cancelLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
