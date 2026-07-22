import { useCallback, useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
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
import { TrackedAsset } from "../../lib/types/domain";
import { useStyle } from "../../style";
import { useWallet } from "../../wallet/WalletProvider";
import { useWalletSessionStore } from "../../wallet/sessionStore";
import { BalanceDisplay } from "../BalanceDisplay";

const PAGE_SIZE = 5;

export function AssetList({
  onView,
}: {
  onView: (asset: TrackedAsset) => void;
}) {
  const { style } = useStyle();
  const { balances: copy } = style.copy;
  const { listTrackedAssets, requestBalanceRefresh } = useWallet();
  const trackedAssetCount = useWalletSessionStore(
    (state) => state.trackedAssetCount,
  );
  const chainId = useWalletSessionStore((state) => state.chainId);
  const evmAddress = useWalletSessionStore((state) => state.evmAddress);

  const [rows, setRows] = useState<TrackedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tracked = (await listTrackedAssets()).filter(
        (asset) => asset.chainId === chainId,
      );
      setRows(tracked);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : copy.loadFailedError);
    } finally {
      setLoading(false);
    }
  }, [listTrackedAssets, chainId, copy.loadFailedError]);

  useEffect(() => {
    void reload();
  }, [reload, trackedAssetCount, evmAddress]);

  const columns = useMemo<ColumnDef<TrackedAsset>[]>(
    () => [
      {
        id: "asset",
        header: copy.assetColumn,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <div
              className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold"
              aria-hidden
            >
              $
            </div>
            <span className="truncate font-medium">{row.original.symbol}</span>
          </div>
        ),
      },
      {
        id: "balance",
        header: copy.balanceColumn,
        meta: { align: "end" as const },
        cell: ({ row }) => (
          <BalanceDisplay
            trackedAssetId={row.original.id}
            balance={row.original.balance}
            decimals={row.original.decimals}
            className="text-xs tabular-nums"
          />
        ),
      },
    ],
    [copy.assetColumn, copy.balanceColumn],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    initialState: {
      pagination: { pageSize: PAGE_SIZE },
    },
  });

  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {rows.length === 0
            ? copy.emptyCountLabel
            : copy.countLabel.replace("{count}", String(rows.length))}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => requestBalanceRefresh()}
          aria-label="Refresh balances"
        >
          <RefreshCwIcon className="size-3.5" />
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
        <>
          <Table className="table-fixed">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const align =
                      (
                        header.column.columnDef.meta as
                          | { align?: "end" }
                          | undefined
                      )?.align === "end"
                        ? "text-right"
                        : "text-left";
                    const widthClass =
                      header.column.id === "asset" ? "w-[60%]" : "w-[40%]";
                    return (
                      <TableHead
                        key={header.id}
                        className={`h-8 px-2 text-xs ${align} ${widthClass}`}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${copy.viewLabel} ${row.original.symbol}`}
                  className="cursor-pointer"
                  onClick={() => onView(row.original)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onView(row.original);
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const align =
                      (
                        cell.column.columnDef.meta as
                          | { align?: "end" }
                          | undefined
                      )?.align === "end"
                        ? "text-right"
                        : "text-left";
                    return (
                      <TableCell
                        key={cell.id}
                        className={`px-2 py-2 align-middle ${align}`}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    );
                  })}
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
    </div>
  );
}
