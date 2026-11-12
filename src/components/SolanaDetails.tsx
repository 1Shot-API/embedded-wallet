import { ChainUtils, type SolanaAccountAddress } from "@1shotapi/ows-types";
import {
  ArrowLeftRightIcon,
  QrCodeIcon,
  RefreshCwIcon,
  SendIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatUnits } from "viem";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";

import solanaLogo from "../assets/images/chains/solana-logo.svg";
import { openSolanaBridge } from "../circle/openSolanaBridge";
import { FormatUtils } from "../lib/implementations/utils/FormatUtils";
import {
  isSolanaTrackedAsset,
  type SolanaTrackedAsset,
  type TrackedAsset,
} from "../lib/types/domain";
import { EAssetType } from "../lib/types/enum/EAssetType";
import type { SolanaLamports } from "../lib/types/primitives/SolanaLamports";
import { useStyle } from "../style/StyleProvider";
import { useWalletSessionStore } from "../wallet/sessionStore";
import { useWallet } from "../wallet/WalletProvider";

import { AssetActionButton } from "./AssetActionButton";
import { AssetIdentityMark } from "./AssetIdentityMark";
import {
  SolanaAssetList,
  type SolanaListSelection,
} from "./balances/SolanaAssetList";
import { ReceiveModal } from "./modals/ReceiveModal";
import { SolanaAddAssetModal } from "./modals/SolanaAddAssetModal";
import { SolanaSendModal } from "./modals/SolanaSendModal";
import { SolanaSendSplModal } from "./modals/SolanaSendSplModal";
import { TransactionHistory } from "./TransactionHistory";

const SOL_DECIMALS = 9;

function formatSol(
  lamports: SolanaLamports | null,
  unavailable: string,
): string {
  if (lamports === null) return unavailable;
  try {
    return FormatUtils.formatDisplayTokenAmount(lamports, SOL_DECIMALS);
  } catch {
    return unavailable;
  }
}

type DetailView =
  { kind: "native" } | { kind: "spl"; asset: TrackedAsset } | null;

export interface ISolanaDetailsProps {
  /** Account chrome hides while an asset detail is open. */
  onActiveDetailChange?: (active: boolean) => void;
}

/**
 * Solana shell: native SOL + tracked SPL list/detail with Add Asset (ATA),
 * Send / Receive. ATA addresses are never shown in primary UI.
 */
export function SolanaDetails({ onActiveDetailChange }: ISolanaDetailsProps) {
  const { style } = useStyle();
  const balances = style.copy.balances;
  const solanaCopy = style.copy.solana;
  const {
    solanaService,
    resolveChain,
    listTrackedAssets,
    requestBalanceRefresh,
    removeTrackedAsset,
    closeSolanaAtaAndUntrack,
    getKnownAsset,
  } = useWallet();
  const { chainId, solanaAddress, unlocked, trackedAssetCount } =
    useWalletSessionStore(
      useShallow((state) => ({
        chainId: state.chainId,
        solanaAddress: state.solanaAddress,
        unlocked: state.unlocked,
        trackedAssetCount: state.trackedAssetCount,
      })),
    );

  const solChainId = ChainUtils.asSolanaChainId(chainId);
  const address: SolanaAccountAddress | null =
    solanaAddress && solanaAddress !== "—" ? solanaAddress : null;

  const chain = resolveChain(solChainId);
  const networkLabel = chain?.label ?? solanaCopy.assetName;
  const logoUrl = chain?.logoUrl ?? solanaLogo;

  const [balanceLamports, setBalanceLamports] = useState<SolanaLamports | null>(
    null,
  );
  const [splAssets, setSplAssets] = useState<TrackedAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailView>(null);
  const detailRef = useRef<DetailView>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [canBridge, setCanBridge] = useState(false);
  const [bridgeBusy, setBridgeBusy] = useState(false);
  const requestIdRef = useRef(0);
  const inFlightLoadRef = useRef(0);
  const inFlightQuietRef = useRef(0);

  const refresh = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!address) {
        setBalanceLamports(null);
        setSplAssets([]);
        return;
      }
      const quiet = opts?.quiet === true;
      const requestId = ++requestIdRef.current;
      if (quiet) {
        inFlightQuietRef.current += 1;
        setRefreshing(true);
      } else {
        inFlightLoadRef.current += 1;
        setLoading(true);
      }
      setError(null);
      const retainOpenSpl = (listed: TrackedAsset[]) => {
        const current = detailRef.current;
        if (current?.kind !== "spl") return;
        const next = listed.find((asset) => asset.id === current.asset.id);
        if (!next) {
          detailRef.current = null;
          setDetail(null);
          onActiveDetailChange?.(false);
          return;
        }
        const updated: DetailView = { kind: "spl", asset: next };
        detailRef.current = updated;
        setDetail(updated);
      };
      try {
        // Paint tracked SPL rows from local store first so add/remove shows up
        // even if balance RPC is slow or fails (same pattern as EVM AssetList).
        const listed = await listTrackedAssets(solChainId);
        if (requestId !== requestIdRef.current) return;
        setSplAssets(listed.filter((a) => a.type === EAssetType.Spl));
        retainOpenSpl(listed);

        const [balance, refreshed] = await Promise.all([
          solanaService.getBalance(solChainId, address),
          requestBalanceRefresh(undefined, solChainId)
            .then(() => listTrackedAssets(solChainId))
            .catch((err: unknown) => {
              console.warn("[solana] balance refresh failed", err);
              return listed;
            }),
        ]);
        if (requestId !== requestIdRef.current) return;
        setBalanceLamports(balance);
        setSplAssets(refreshed.filter((a) => a.type === EAssetType.Spl));
        retainOpenSpl(refreshed);
      } catch (err: unknown) {
        if (requestId !== requestIdRef.current) return;
        setError(
          err instanceof Error ? err.message : solanaCopy.loadFailedError,
        );
        setBalanceLamports(null);
      } finally {
        if (quiet) {
          inFlightQuietRef.current = Math.max(0, inFlightQuietRef.current - 1);
          if (inFlightQuietRef.current === 0) setRefreshing(false);
        } else {
          inFlightLoadRef.current = Math.max(0, inFlightLoadRef.current - 1);
          if (inFlightLoadRef.current === 0) setLoading(false);
        }
      }
    },
    [
      address,
      listTrackedAssets,
      requestBalanceRefresh,
      solanaCopy.loadFailedError,
      onActiveDetailChange,
      solanaService,
      solChainId,
    ],
  );

  useEffect(() => {
    void refresh();
  }, [refresh, unlocked]);

  useEffect(() => {
    detailRef.current = null;
    setDetail(null);
  }, [solChainId]);

  const showDetail = useCallback(
    (next: Exclude<DetailView, null>) => {
      detailRef.current = next;
      setDetail(next);
      onActiveDetailChange?.(true);
    },
    [onActiveDetailChange],
  );

  const hideDetail = useCallback(() => {
    detailRef.current = null;
    setDetail(null);
    onActiveDetailChange?.(false);
  }, [onActiveDetailChange]);

  const detailKey =
    detail == null
      ? null
      : detail.kind === "native"
        ? "native"
        : detail.asset.id;

  useEffect(() => {
    if (detailKey == null) return;
    void refresh({ quiet: true });
  }, [detailKey, refresh]);

  // Same signal EVM AssetList uses — pick up add/remove without relying on
  // modal callbacks alone.
  useEffect(() => {
    void refresh({ quiet: true });
  }, [trackedAssetCount, refresh]);

  const canAct = Boolean(address);

  const onSelect = (selection: SolanaListSelection) => {
    if (selection.kind === "native") {
      showDetail({ kind: "native" });
      return;
    }
    setRemoveError(null);
    showDetail({ kind: "spl", asset: selection.asset });
  };

  const stopTrackingSpl = useCallback(
    async (asset: TrackedAsset) => {
      await removeTrackedAsset(asset.chainId, asset.address);
      hideDetail();
      await refresh({ quiet: true });
    },
    [hideDetail, refresh, removeTrackedAsset],
  );

  const closeAtaAndRemove = useCallback(
    async (asset: SolanaTrackedAsset) => {
      if (!address) return;
      setRemoveBusy(true);
      setRemoveError(null);
      try {
        if (asset.balance !== null && asset.balance !== 0n) {
          setRemoveError(solanaCopy.closeAtaMustEmptyError);
          return;
        }
        await closeSolanaAtaAndUntrack(solChainId, asset.address, address);
        hideDetail();
        await refresh({ quiet: true });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : solanaCopy.closeAtaFailedError;
        if (/empty|must be empty|balance/i.test(message)) {
          setRemoveError(solanaCopy.closeAtaMustEmptyError);
        } else {
          setRemoveError(message);
        }
      } finally {
        setRemoveBusy(false);
      }
    },
    [
      address,
      closeSolanaAtaAndUntrack,
      hideDetail,
      refresh,
      solChainId,
      solanaCopy.closeAtaFailedError,
      solanaCopy.closeAtaMustEmptyError,
    ],
  );

  useEffect(() => {
    if (!detail || detail.kind !== "spl") {
      setCanBridge(false);
      return;
    }
    let cancelled = false;
    void getKnownAsset(detail.asset.chainId, detail.asset.address).then(
      (known) => {
        if (!cancelled) {
          setCanBridge(known?.useCCTPBridge === true);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [detail, getKnownAsset]);

  if (detail) {
    const spl =
      detail.kind === "spl" && isSolanaTrackedAsset(detail.asset)
        ? detail.asset
        : null;
    const splBalanceEmpty = spl?.balance === 0n;
    const burnAta = spl?.ataAddress;
    const rentLabel = formatUnits(
      solanaService.estimateAtaRentLamports(),
      SOL_DECIMALS,
    );
    const detailSymbol = spl ? spl.symbol : solanaCopy.assetSymbol;
    const detailAmount = spl
      ? spl.balance === null
        ? balances.balanceUnavailable
        : FormatUtils.formatDisplayTokenAmount(spl.balance, spl.decimals)
      : loading
        ? solanaCopy.loadingBody
        : formatSol(balanceLamports, balances.balanceUnavailable);

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 justify-end">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={balances.closeLabel}
            onClick={hideDetail}
          >
            <XIcon />
          </Button>
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col gap-5"
          aria-label={`${detailSymbol} details`}
        >
          <div className="flex shrink-0 flex-col gap-5">
            <header className="flex flex-col items-center gap-2 pt-2 text-center">
              {spl ? (
                <AssetIdentityMark
                  chainId={spl.chainId}
                  address={spl.address}
                  symbol={spl.symbol}
                  iconUrl={spl.iconUrl}
                  chainLogoUrl={chain?.logoUrl}
                />
              ) : (
                <img
                  src={logoUrl}
                  alt=""
                  className="size-16 rounded-full object-cover"
                />
              )}
              <div className="flex flex-col gap-0.5">
                <h2 className="text-foreground text-lg font-semibold tracking-tight">
                  {detailSymbol}
                </h2>
                <p className="text-muted-foreground text-xs">{networkLabel}</p>
              </div>
              <p className="text-primary m-0 text-3xl font-semibold tracking-tight">
                {detailAmount}
              </p>
              {error ? (
                <p className="text-destructive m-0 text-sm">{error}</p>
              ) : null}
            </header>

            <nav
              className="flex items-start justify-center gap-6"
              aria-label="Asset actions"
            >
              <AssetActionButton
                label={balances.sendLabel}
                variant="primary"
                disabled={!canAct}
                onClick={() => {
                  void refresh({ quiet: true });
                  setSendOpen(true);
                }}
              >
                <SendIcon className="size-5" />
              </AssetActionButton>
              <AssetActionButton
                label={balances.receiveLabel}
                variant="outline"
                disabled={!canAct}
                onClick={() => setReceiveOpen(true)}
              >
                <QrCodeIcon className="size-5" />
              </AssetActionButton>
              {canBridge && spl && address && burnAta ? (
                <AssetActionButton
                  label={balances.bridgeLabel}
                  variant="outline"
                  disabled={!canAct || bridgeBusy}
                  onClick={() => {
                    setBridgeBusy(true);
                    void openSolanaBridge({
                      sourceChainId: solChainId,
                      ownerAddress: address,
                      mint: spl.address,
                      burnAta,
                      balance: spl.balance,
                    })
                      .catch(() => {
                        /* user closed or rejected */
                      })
                      .finally(() => {
                        setBridgeBusy(false);
                        void refresh({ quiet: true });
                      });
                  }}
                >
                  <ArrowLeftRightIcon className="size-5" />
                </AssetActionButton>
              ) : null}
            </nav>
          </div>

          {spl ? <TransactionHistory asset={spl} owner={address} /> : null}

          {spl ? (
            <div className="mt-2 flex flex-col items-center gap-3 pt-2">
              {splBalanceEmpty ? (
                <p className="text-muted-foreground m-0 text-center text-sm leading-relaxed">
                  {solanaCopy.closeAtaBody.replace("{rent}", rentLabel)}
                </p>
              ) : (
                <p className="text-muted-foreground m-0 text-center text-sm leading-relaxed">
                  {solanaCopy.stopTrackingBody}
                </p>
              )}
              <Button
                type="button"
                size="sm"
                className="self-center"
                disabled={!canAct || removeBusy}
                onClick={() => {
                  if (splBalanceEmpty) {
                    void closeAtaAndRemove(spl);
                    return;
                  }
                  setRemoveBusy(true);
                  setRemoveError(null);
                  void stopTrackingSpl(spl)
                    .catch((err: unknown) => {
                      setRemoveError(
                        err instanceof Error
                          ? err.message
                          : solanaCopy.closeAtaFailedError,
                      );
                    })
                    .finally(() => setRemoveBusy(false));
                }}
              >
                {splBalanceEmpty
                  ? removeBusy
                    ? solanaCopy.closeAtaBusyLabel
                    : solanaCopy.closeAtaLabel
                  : solanaCopy.stopTrackingLabel}
              </Button>
              {removeError ? (
                <p className="text-destructive m-0 text-sm">{removeError}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        {receiveOpen && address ? (
          <ReceiveModal
            address={address}
            chainLabel={networkLabel}
            footnote={solanaCopy.receiveTokenNote}
            onClose={() => setReceiveOpen(false)}
          />
        ) : null}

        {sendOpen && address && detail.kind === "native" ? (
          <SolanaSendModal
            chainId={solChainId}
            fromAddress={address}
            balanceLamports={balanceLamports}
            onClose={() => setSendOpen(false)}
            onSuccess={() => {
              void refresh({ quiet: true });
            }}
          />
        ) : null}

        {sendOpen && address && spl ? (
          <SolanaSendSplModal
            chainId={solChainId}
            fromAddress={address}
            asset={spl}
            onClose={() => setSendOpen(false)}
            onSuccess={() => {
              void refresh({ quiet: true });
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={balances.refreshLabel}
          disabled={!address || refreshing || loading}
          onClick={() => {
            void refresh({ quiet: true });
          }}
        >
          <RefreshCwIcon
            className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
        </Button>
      </div>
      {error ? <p className="text-destructive m-0 text-sm">{error}</p> : null}
      <SolanaAssetList
        balanceLamports={balanceLamports}
        loading={loading}
        logoUrl={logoUrl}
        networkLabel={networkLabel}
        splAssets={splAssets}
        onSelect={onSelect}
      />
      <Button
        type="button"
        size="sm"
        className="self-center"
        disabled={!address}
        onClick={() => setAddOpen(true)}
      >
        {balances.addLabel}
      </Button>
      {addOpen ? (
        <SolanaAddAssetModal
          chainId={solChainId}
          onClose={() => setAddOpen(false)}
          onAdded={() => {
            void refresh({ quiet: true });
          }}
        />
      ) : null}
    </div>
  );
}
