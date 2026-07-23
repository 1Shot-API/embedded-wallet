import { useCallback, useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import type { CredentialId, CredentialSummary, StoredCredential } from "@1shotapi/ows-types";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStyle } from "../../style";
import { useWallet } from "../../wallet/WalletProvider";
import { useWalletSessionStore } from "../../wallet/sessionStore";
import { CredentialDetailDialog } from "./CredentialDetailDialog";

const PAGE_SIZE = 5;

function fillTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

export function CredentialsTab() {
  const { style } = useStyle();
  const { credentials: copy } = style.copy;
  const {
    listCredentials,
    getCredential,
    refreshCredentialsFromRelayer,
    refreshCredentialCount,
  } = useWallet();
  const credentialCount = useWalletSessionStore(
    (state) => state.credentialCount,
  );

  const [rows, setRows] = useState<CredentialSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<StoredCredential | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const listed = await listCredentials();
      setRows(listed);
      await refreshCredentialCount();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : copy.loadFailedError,
      );
    } finally {
      setLoading(false);
    }
  }, [listCredentials, refreshCredentialCount, copy.loadFailedError]);

  // Reload when store count changes (e.g. recover after discoverable login).
  useEffect(() => {
    void reload();
  }, [reload, credentialCount]);

  const onRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await refreshCredentialsFromRelayer();
      await reload();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : copy.refreshFailedError,
      );
    } finally {
      setRefreshing(false);
    }
  };

  const onView = useCallback(
    async (credentialId: CredentialId) => {
      setError(null);
      try {
        const full = await getCredential(credentialId);
        if (!full) {
          setError(copy.notFoundError);
          return;
        }
        setDetail(full);
        setDetailOpen(true);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : copy.openFailedError,
        );
      }
    },
    [getCredential, copy.notFoundError, copy.openFailedError],
  );

  const columns = useMemo<ColumnDef<CredentialSummary>[]>(
    () => [
      {
        id: "type",
        header: copy.typeColumn,
        cell: ({ row }) => (
          <span className="font-medium">{row.original.type.join(", ")}</span>
        ),
      },
      {
        id: "issuer",
        header: copy.issuerColumn,
        cell: ({ row }) => (
          <span className="text-muted-foreground line-clamp-2 break-all text-xs">
            {row.original.issuer}
          </span>
        ),
      },
      {
        id: "issued",
        header: copy.issuedColumn,
        cell: ({ row }) => (
          <span className="font-mono text-[0.7rem]">
            {row.original.issuedAt}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              void onView(row.original.credentialId);
            }}
          >
            {copy.viewLabel}
          </Button>
        ),
      },
    ],
    [
      onView,
      copy.typeColumn,
      copy.issuerColumn,
      copy.issuedColumn,
      copy.viewLabel,
    ],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: PAGE_SIZE },
    },
  });

  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;

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
        <>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="h-8 px-2 text-xs">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-2 py-2 align-top">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {pageCount > 1 ? (
            <Pagination className="justify-between">
              <PaginationContent className="w-full justify-between">
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    className={
                      !table.getCanPreviousPage()
                        ? "pointer-events-none opacity-40"
                        : undefined
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      table.previousPage();
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="text-muted-foreground px-2 text-xs">
                    {pageIndex + 1} / {pageCount}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    className={
                      !table.getCanNextPage()
                        ? "pointer-events-none opacity-40"
                        : undefined
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      table.nextPage();
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </>
      )}

      <CredentialDetailDialog
        credential={detail}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
