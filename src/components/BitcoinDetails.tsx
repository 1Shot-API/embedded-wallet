import { useCallback, useEffect, useRef, useState } from "react";
import { QrCodeIcon, SendIcon } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import {
  BITCOIN_MAINNET_CHAIN_ID,
  ChainUtils,
  type BitcoinSegwitAccountAddress,
} from "@1shotapi/ows-types";
import { formatUnits } from "viem";
import { useStyle } from "../style/StyleProvider";
import { useWallet } from "../wallet/WalletProvider";
import { hydrateBitcoinAddressesFromCachedSecp } from "../wallet/hydrateBitcoinAddresses";
import { useWalletSessionStore } from "../wallet/sessionStore";
import {
  makeBitcoinSatoshiAmount,
  makeBitcoinSatoshiDelta,
  type BitcoinSatoshiAmount,
} from "../lib/types/primitives/BitcoinSatoshiAmount";
import { Button } from "@/components/ui/button";
import { ReceiveModal } from "./modals/ReceiveModal";
import { BitcoinSendModal } from "./modals/BitcoinSendModal";
import bitcoinLogo from "../assets/images/chains/bitcoin-logo.svg";

const BTC_DECIMALS = 8;

function formatBtc(
  sats: BitcoinSatoshiAmount | null,
  unavailable: string,
): string {
  if (sats === null) return unavailable;
  try {
    return formatUnits(sats, BTC_DECIMALS);
  } catch {
    return unavailable;
  }
}

/**
 * Bitcoin-only main panel body: balance + Send / Receive (no tabs, bridge, buy).
 */
export function BitcoinDetails() {
  const { style } = useStyle();
  const balances = style.copy.balances;
  const bitcoinCopy = style.copy.bitcoin;
  const { bitcoinService, resolveChain, refreshAddresses, getSigner } =
    useWallet();
  const { chainId, bitcoinMainnetAddress, bitcoinTestnetAddress, unlocked } =
    useWalletSessionStore(
      useShallow((state) => ({
        chainId: state.chainId,
        bitcoinMainnetAddress: state.bitcoinMainnetAddress,
        bitcoinTestnetAddress: state.bitcoinTestnetAddress,
        unlocked: state.unlocked,
      })),
    );

  const btcChainId = ChainUtils.asBitcoinChainId(chainId);
  const address: BitcoinSegwitAccountAddress | null =
    btcChainId === BITCOIN_MAINNET_CHAIN_ID
      ? bitcoinMainnetAddress
      : bitcoinTestnetAddress;

  const chain = resolveChain(btcChainId);
  const networkLabel = chain?.label ?? bitcoinCopy.assetName;
  const logoUrl = chain?.logoUrl ?? bitcoinLogo;

  const [confirmedSats, setConfirmedSats] =
    useState<BitcoinSatoshiAmount | null>(null);
  const [unconfirmedSats, setUnconfirmedSats] = useState<BitcoinSatoshiAmount>(
    makeBitcoinSatoshiDelta(0n),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const addressRefreshAttemptedRef = useRef(false);

  // Returning sessions may lack BTC addresses until secp cache / unlock fills them.
  useEffect(() => {
    if (address || !unlocked || addressRefreshAttemptedRef.current) return;
    if (hydrateBitcoinAddressesFromCachedSecp(getSigner())) return;
    addressRefreshAttemptedRef.current = true;
    void refreshAddresses().catch((err: unknown) => {
      console.warn("[oneshot-wallet] bitcoin address refresh failed", err);
    });
  }, [address, unlocked, refreshAddresses, getSigner]);

  const refresh = useCallback(async () => {
    if (!address) {
      setConfirmedSats(null);
      setUnconfirmedSats(makeBitcoinSatoshiDelta(0n));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const balance = await bitcoinService.getBalance(btcChainId, address);
      setConfirmedSats(balance.confirmed);
      setUnconfirmedSats(balance.unconfirmed);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : bitcoinCopy.loadFailedError,
      );
      setConfirmedSats(null);
      setUnconfirmedSats(makeBitcoinSatoshiDelta(0n));
    } finally {
      setLoading(false);
    }
  }, [address, bitcoinCopy.loadFailedError, bitcoinService, btcChainId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const canAct = Boolean(address);
  const spendableSats: BitcoinSatoshiAmount | null =
    confirmedSats === null
      ? null
      : makeBitcoinSatoshiAmount(
          confirmedSats + unconfirmedSats < 0n
            ? 0n
            : confirmedSats + unconfirmedSats,
        );
  const showUnconfirmed = !loading && unconfirmedSats !== 0n;

  return (
    <div className="flex flex-col gap-4">
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
              ? bitcoinCopy.loadingBody
              : `${formatBtc(confirmedSats, balances.balanceUnavailable)} ${bitcoinCopy.assetSymbol}`}
          </p>
          {showUnconfirmed ? (
            <p className="text-muted-foreground m-0 mt-1 text-sm tabular-nums">
              {formatBtc(unconfirmedSats, balances.balanceUnavailable)}{" "}
              {bitcoinCopy.assetSymbol} {bitcoinCopy.unconfirmedLabel}
            </p>
          ) : null}
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
            void refresh();
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
        <BitcoinSendModal
          chainId={btcChainId}
          fromAddress={address}
          balanceSats={spendableSats}
          onClose={() => setSendOpen(false)}
          onSuccess={() => {
            void refresh();
          }}
        />
      ) : null}
    </div>
  );
}
