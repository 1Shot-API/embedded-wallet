import {
  ChainUtils,
  type SolanaAccountAddress,
} from "@1shotapi/ows-types";
import {
  ArrowLeftIcon,
  PlusIcon,
  QrCodeIcon,
  RefreshCwIcon,
  SendIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatUnits } from "viem";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";

import solanaLogo from "../assets/images/chains/solana-logo.svg";
import type { TrackedAsset } from "../lib/types/domain";
import { EAssetType } from "../lib/types/enum/EAssetType";
import type { SolanaLamports } from "../lib/types/primitives/SolanaLamports";
import { resolveAssetIconUrl } from "../lib/utils/tokenIcons";
import { useStyle } from "../style/StyleProvider";
import { useWalletSessionStore } from "../wallet/sessionStore";
import { useWallet } from "../wallet/WalletProvider";

import {
  SolanaAssetList,
  type SolanaListSelection,
} from "./balances/SolanaAssetList";
import { ReceiveModal } from "./modals/ReceiveModal";
import { SolanaAddAssetModal } from "./modals/SolanaAddAssetModal";
import { SolanaSendModal } from "./modals/SolanaSendModal";
import { SolanaSendSplModal } from "./modals/SolanaSendSplModal";

const SOL_DECIMALS = 9;

function formatSol(
  lamports: SolanaLamports | null,
  unavailable: string,
): string {
  if (lamports === null) return unavailable;
  try {
    return formatUnits(lamports, SOL_DECIMALS);
  } catch {
    return unavailable;
  }
}

type DetailView =
  | { kind: "native" }
  | { kind: "spl"; asset: TrackedAsset }
  | null;

/**
 * Solana shell: native SOL + tracked SPL list/detail with Add Asset (ATA),
 * Send / Receive. ATA addresses are never shown in primary UI.
 */
export function SolanaDetails() {
  const { style } = useStyle();
  const balances = style.copy.balances;
  const solanaCopy = style.copy.solana;
  const {
    solanaService,
    resolveChain,
    listTrackedAssets,
    requestBalanceRefresh,
  } = useWallet();
  const { chainId, solanaAddress, unlocked } = useWalletSessionStore(
    useShallow((state) => ({
      chainId: state.chainId,
      solanaAddress: state.solanaAddress,
      unlocked: state.unlocked,
    })),
  );

  const solChainId = ChainUtils.asSolanaChainId(chainId);
  const address: SolanaAccountAddress | null =
    solanaAddress && solanaAddress !== "—" ? solanaAddress : null;

  const chain = resolveChain(solChainId);
  const networkLabel = chain?.label ?? solanaCopy.assetName;
  const logoUrl = chain?.logoUrl ?? solanaLogo;

  const [balanceLamports, setBalanceLamports] =
    useState<SolanaLamports | null>(null);
  const [splAssets, setSplAssets] = useState<TrackedAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailView>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
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
      try {
        const [balance, refreshed] = await Promise.all([
          solanaService.getBalance(solChainId, address),
          requestBalanceRefresh(undefined, solChainId).then(() =>
            listTrackedAssets(solChainId),
          ),
        ]);
        if (requestId !== requestIdRef.current) return;
        setBalanceLamports(balance);
        setSplAssets(refreshed.filter((a) => a.type === EAssetType.Spl));
        setDetail((current) => {
          if (current?.kind !== "spl") return current;
          const next = refreshed.find((a) => a.id === current.asset.id);
          return next ? { kind: "spl", asset: next } : current;
        });
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
      solanaService,
      solChainId,
    ],
  );

  useEffect(() => {
    void refresh();
  }, [refresh, unlocked]);

  const canAct = Boolean(address);

  const onSelect = (selection: SolanaListSelection) => {
    if (selection.kind === "native") {
      setDetail({ kind: "native" });
      return;
    }
    setDetail({ kind: "spl", asset: selection.asset });
  };

  if (detail) {
    const isNative = detail.kind === "native";
    const spl = detail.kind === "spl" ? detail.asset : null;
    const detailLogo = isNative
      ? logoUrl
      : (resolveAssetIconUrl(
          spl!.chainId as never,
          spl!.address as never,
          spl!.symbol,
          spl!.iconUrl,
        ) ?? logoUrl);
    const detailTitle = isNative ? solanaCopy.assetName : spl!.name;
    const detailAmount = isNative
      ? `${formatSol(balanceLamports, balances.balanceUnavailable)} ${solanaCopy.assetSymbol}`
      : spl!.balance === null
        ? balances.balanceUnavailable
        : `${formatUnits(spl!.balance, spl!.decimals)} ${spl!.symbol}`;

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label={balances.closeLabel}
            onClick={() => setDetail(null)}
          >
            <ArrowLeftIcon className="size-3.5" />
          </Button>
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

        <div className="flex flex-col items-center gap-3 py-4">
          <img
            src={detailLogo}
            alt=""
            className="size-16 rounded-full object-cover"
          />
          <div className="text-center">
            <p className="text-muted-foreground m-0 text-xs font-medium tracking-wide uppercase">
              {networkLabel}
            </p>
            <p className="m-0 mt-1 text-lg font-medium">{detailTitle}</p>
            <p className="m-0 mt-1 text-2xl font-semibold tabular-nums">
              {loading ? solanaCopy.loadingBody : detailAmount}
            </p>
            {error ? (
              <p className="text-destructive m-0 mt-2 text-sm">{error}</p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!canAct}
            onClick={() => setReceiveOpen(true)}
          >
            <QrCodeIcon />
            {balances.receiveLabel}
          </Button>
          <Button
            type="button"
            disabled={!canAct}
            onClick={() => {
              void refresh({ quiet: true });
              setSendOpen(true);
            }}
          >
            <SendIcon />
            {balances.sendLabel}
          </Button>
        </div>

        {receiveOpen && address ? (
          <ReceiveModal
            address={address}
            chainLabel={networkLabel}
            footnote={solanaCopy.receiveTokenNote}
            onClose={() => setReceiveOpen(false)}
          />
        ) : null}

        {sendOpen && address && isNative ? (
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
          aria-label={balances.addLabel}
          disabled={!address}
          onClick={() => setAddOpen(true)}
        >
          <PlusIcon className="size-3.5" />
        </Button>
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
      {error ? (
        <p className="text-destructive m-0 text-sm">{error}</p>
      ) : null}
      <SolanaAssetList
        balanceLamports={balanceLamports}
        loading={loading}
        logoUrl={logoUrl}
        networkLabel={networkLabel}
        splAssets={splAssets}
        onSelect={onSelect}
      />
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
