import {
  ChainUtils,
  type SolanaAccountAddress,
} from "@1shotapi/ows-types";
import { ArrowLeftIcon, QrCodeIcon, RefreshCwIcon, SendIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatUnits } from "viem";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";

import solanaLogo from "../assets/images/chains/solana-logo.svg";
import type { SolanaLamports } from "../lib/types/primitives/SolanaLamports";
import { useStyle } from "../style/StyleProvider";
import { useWalletSessionStore } from "../wallet/sessionStore";
import { useWallet } from "../wallet/WalletProvider";

import { SolanaAssetList } from "./balances/SolanaAssetList";
import { ReceiveModal } from "./modals/ReceiveModal";
import { SolanaSendModal } from "./modals/SolanaSendModal";

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

/**
 * Solana shell: EVM-like asset list (native SOL only) + detail with
 * Receive / Send. Product clusters: mainnet + Devnet.
 */
export function SolanaDetails() {
  const { style } = useStyle();
  const balances = style.copy.balances;
  const solanaCopy = style.copy.solana;
  const { solanaService, resolveChain } = useWallet();
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
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const requestIdRef = useRef(0);
  const inFlightLoadRef = useRef(0);
  const inFlightQuietRef = useRef(0);

  const refresh = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!address) {
        setBalanceLamports(null);
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
        const balance = await solanaService.getBalance(solChainId, address);
        if (requestId !== requestIdRef.current) return;
        setBalanceLamports(balance);
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
    [address, solanaCopy.loadFailedError, solanaService, solChainId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh, unlocked]);

  const canAct = Boolean(address);

  if (detailOpen) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label={balances.closeLabel}
            onClick={() => setDetailOpen(false)}
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
            src={logoUrl}
            alt=""
            className="size-16 rounded-full object-cover"
          />
          <div className="text-center">
            <p className="text-muted-foreground m-0 text-xs font-medium tracking-wide uppercase">
              {networkLabel}
            </p>
            <p className="m-0 mt-1 text-2xl font-semibold tabular-nums">
              {loading
                ? solanaCopy.loadingBody
                : `${formatSol(balanceLamports, balances.balanceUnavailable)} ${solanaCopy.assetSymbol}`}
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
            onClose={() => setReceiveOpen(false)}
          />
        ) : null}

        {sendOpen && address ? (
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
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
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
        onSelect={() => setDetailOpen(true)}
      />
    </div>
  );
}
