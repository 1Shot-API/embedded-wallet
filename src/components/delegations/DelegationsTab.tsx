import { useCallback, useEffect, useState } from "react";
import type {
  EVMChainId,
  EVMTransactionHash,
} from "@1shotapi/ows-types";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IDelegationSummary } from "../../lib/types/domain/StoredDelegation";
import type { DelegationId } from "../../lib/types/primitives/DelegationId";
import { useStyle } from "../../style/StyleProvider";
import { useWallet } from "../../wallet/WalletProvider";
import { SentTransactionModal } from "../modals/SentTransactionModal";
import { DelegationsList } from "./DelegationsList";

function fillTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

export function DelegationsTab() {
  const { style } = useStyle();
  const { delegations: copy } = style.copy;
  const {
    listDelegations,
    refreshDelegationsFromRelayer,
    cancelStoredDelegation,
  } = useWallet();

  const [rows, setRows] = useState<IDelegationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelingId, setCancelingId] = useState<DelegationId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{
    chainId: EVMChainId;
    transactionHash: EVMTransactionHash;
  } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const listed = await listDelegations();
      setRows(listed);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : copy.loadFailedError,
      );
    } finally {
      setLoading(false);
    }
  }, [listDelegations, copy.loadFailedError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await refreshDelegationsFromRelayer();
      await reload();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : copy.refreshFailedError,
      );
    } finally {
      setRefreshing(false);
    }
  };

  const onCancel = async (delegationId: DelegationId) => {
    setCancelingId(delegationId);
    setError(null);
    try {
      const result = await cancelStoredDelegation(delegationId);
      setSent({
        chainId: result.chainId,
        transactionHash: result.transactionHash,
      });
      await reload();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("User rejected") ||
        message.includes("user rejected")
      ) {
        return;
      }
      setError(
        err instanceof Error ? err.message : copy.cancelFailedError,
      );
    } finally {
      setCancelingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground m-0 text-xs">
          {rows.length === 0
            ? copy.emptyCountLabel
            : fillTemplate(copy.countLabel, { count: String(rows.length) })}
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
        <p className="text-destructive m-0 text-xs" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-muted-foreground m-0 text-sm">{copy.loadingBody}</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground m-0 text-sm">{copy.emptyBody}</p>
      ) : (
        <DelegationsList
          rows={rows}
          cancelingId={cancelingId}
          onCancel={(id) => {
            void onCancel(id);
          }}
        />
      )}

      {sent ? (
        <SentTransactionModal
          chainId={sent.chainId}
          transactionHash={sent.transactionHash}
          onClose={() => setSent(null)}
        />
      ) : null}
    </div>
  );
}
