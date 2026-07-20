import { useCallback, useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import type { EVMChainId } from "@1shotapi/ows-types";
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
import {
  EAssetType,
  fetchErc20Balance,
  resolveErc20Decimals,
  trackedAssetKey,
  type IKnownAsset,
  type ITrackedAsset,
} from "../../assets";
import { DEMO_CHAINS } from "../../ows/demoChains";
import { useStyle } from "../../style";
import { useWallet } from "../../wallet/WalletProvider";
import { useWalletSessionStore } from "../../wallet/sessionStore";

const PAGE_SIZE = 5;

export interface IAssetListRow extends ITrackedAsset {
  known: IKnownAsset | null;
  displayName: string;
  chainLabel: string;
  balanceLabel: string;
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function chainLabelFor(chainId: EVMChainId): string {
  return (
    DEMO_CHAINS.find((chain) => chain.chainId === chainId)?.label ??
    String(chainId)
  );
}

export function AssetList({
  onView,
}: {
  onView: (asset: ITrackedAsset) => void;
}) {
  const { style } = useStyle();
  const { balances: copy } = style.copy;
  const { listTrackedAssets, getKnownAsset } = useWallet();
  const trackedAssetCount = useWalletSessionStore(
    (state) => state.trackedAssetCount,
  );
  const evmAddress = useWalletSessionStore((state) => state.evmAddress);
  const chainId = useWalletSessionStore((state) => state.chainId);

  const [rows, setRows] = useState<IAssetListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tracked = (await listTrackedAssets()).filter(
        (asset) => asset.chainId === chainId,
      );
      const enriched: IAssetListRow[] = await Promise.all(
        tracked.map(async (asset) => {
          const known = await getKnownAsset(asset.chainId, asset.address);
          const displayName =
            known?.name ?? truncateAddress(String(asset.address));
          const network = chainLabelFor(asset.chainId);

          let balanceLabel = copy.balanceUnavailable;
          if (known && known.type !== EAssetType.Erc20) {
            balanceLabel = copy.balanceNonErc20;
          } else if (!known || known.type === EAssetType.Erc20) {
            const decimals = resolveErc20Decimals(known);
            const balance = await fetchErc20Balance({
              chainId: asset.chainId,
              tokenAddress: asset.address,
              ownerAddress: evmAddress,
              decimals,
            });
            balanceLabel = balance ?? copy.balanceUnavailable;
          }

          return {
            ...asset,
            known,
            displayName,
            chainLabel: network,
            balanceLabel,
          };
        }),
      );
      setRows(enriched);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : copy.loadFailedError);
    } finally {
      setLoading(false);
    }
  }, [
    listTrackedAssets,
    getKnownAsset,
    chainId,
    evmAddress,
    copy.balanceUnavailable,
    copy.balanceNonErc20,
    copy.loadFailedError,
  ]);

  useEffect(() => {
    void reload();
  }, [reload, trackedAssetCount]);

  const columns = useMemo<ColumnDef<IAssetListRow>[]>(
    () => [
      {
        id: "asset",
        header: copy.assetColumn,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            {row.original.known?.iconUrl ? (
              <img
                src={row.original.known.iconUrl}
                alt=""
                className="size-6 shrink-0 rounded-full"
              />
            ) : (
              <div
                className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold"
                aria-hidden
              >
                $
              </div>
            )}
            <span className="truncate font-medium">
              {row.original.displayName}
            </span>
          </div>
        ),
      },
      {
        id: "chain",
        header: copy.chainColumn,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {row.original.chainLabel}
          </span>
        ),
      },
      {
        id: "balance",
        header: copy.balanceColumn,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.balanceLabel}</span>
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
            onClick={() => onView(row.original)}
          >
            {copy.viewLabel}
          </Button>
        ),
      },
    ],
    [onView, copy.assetColumn, copy.chainColumn, copy.balanceColumn, copy.viewLabel],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => trackedAssetKey(row.chainId, row.address),
    initialState: {
      pagination: { pageSize: PAGE_SIZE },
    },
  });

  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-xs">
        {rows.length === 0
          ? copy.emptyCountLabel
          : copy.countLabel.replace("{count}", String(rows.length))}
      </p>

      {error ? (
        <p className="text-destructive m-0 text-sm">{error}</p>
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
    </div>
  );
}
