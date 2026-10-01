import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  ArrowLeftRightIcon,
  PlusIcon,
  QrCodeIcon,
  SendIcon,
  TrendingUpIcon,
} from "lucide-react";
import { formatUnits } from "viem";
import { TrackedAsset } from "../lib/types/domain";
import { EAssetType } from "../lib/types/enum/EAssetType";
import { useStyle } from "../style/StyleProvider";
import { useWallet } from "../wallet/WalletProvider";
import { resolveActiveAddress } from "../wallet/activeAddress";
import {
  BITCOIN_MAINNET_CHAIN_ID,
  ChainUtils,
} from "@1shotapi/ows-types";
import { useLiveTrackedBalance } from "../wallet/useLiveTrackedBalance";
import { useWalletSessionStore } from "../wallet/sessionStore";
import { openOnramp } from "../circle/openOnramp";
import { openCctpBridge } from "../circle/openCctpBridge";
import { openEarn } from "../circle/openEarn";
import { AssetIdentityMark } from "./AssetIdentityMark";
import { BalanceDisplay } from "./BalanceDisplay";
import { TransactionHistory } from "./TransactionHistory";
import { ReceiveModal } from "./modals/ReceiveModal";
import { SendNativeTokenModal } from "./modals/SendNativeTokenModal";
import { TransferTokensModal } from "./modals/TransferTokensModal";

export interface IAssetDetailsProps {
  asset: TrackedAsset;
}

/**
 * Shared focused-asset / asset-detail shell.
 * Balance and recent activity are live.
 */
export function AssetDetails({ asset: assetProp }: IAssetDetailsProps) {
  const { style } = useStyle();
  const { balances: copy } = style.copy;
  const { requestBalanceRefresh, resolveChain, getKnownAsset, earnService } =
    useWallet();
  const { evmAddress, solanaAddress, bitcoinMainnetAddress, bitcoinTestnetAddress } =
    useWalletSessionStore(
    useShallow((state) => ({
      evmAddress: state.evmAddress,
      solanaAddress: state.solanaAddress,
      bitcoinMainnetAddress: state.bitcoinMainnetAddress,
      bitcoinTestnetAddress: state.bitcoinTestnetAddress,
    })),
  );
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [buyBusy, setBuyBusy] = useState(false);
  const [bridgeBusy, setBridgeBusy] = useState(false);
  const [earnBusy, setEarnBusy] = useState(false);
  const [canBridge, setCanBridge] = useState(false);
  const [canBuyAsset, setCanBuyAsset] = useState(false);
  const [canEarn, setCanEarn] = useState(false);
  const [earningAtoms, setEarningAtoms] = useState<bigint | null>(null);

  const { balance, decimals } = useLiveTrackedBalance(
    assetProp.id,
    assetProp.balance,
    assetProp.decimals,
  );
  const asset =
    balance === assetProp.balance && decimals === assetProp.decimals
      ? assetProp
      : new TrackedAsset(
          assetProp.chainId,
          assetProp.address,
          assetProp.type,
          assetProp.name,
          assetProp.symbol,
          decimals,
          assetProp.id,
          balance,
          assetProp.iconUrl,
          assetProp.weight,
          assetProp.canBuy,
        );

  useEffect(() => {
    void requestBalanceRefresh(assetProp.id);
  }, [assetProp.id, requestBalanceRefresh]);

  useEffect(() => {
    let cancelled = false;
    void getKnownAsset(assetProp.chainId, assetProp.address).then((known) => {
      if (!cancelled) {
        setCanBridge(known?.useCCTPBridge === true);
        setCanBuyAsset(known?.canBuy === true);
        setCanEarn(known?.useEarn === true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [assetProp.address, assetProp.chainId, getKnownAsset]);

  useEffect(() => {
    if (!canEarn || !evmAddress) {
      setEarningAtoms(null);
      return;
    }
    let cancelled = false;
    void earnService
      .getPosition(assetProp.chainId, evmAddress)
      .then((position) => {
        if (!cancelled) setEarningAtoms(position.assets);
      })
      .catch(() => {
        if (!cancelled) setEarningAtoms(0n);
      });
    return () => {
      cancelled = true;
    };
  }, [assetProp.chainId, canEarn, earnService, evmAddress, balance]);

  const chain = resolveChain(asset.chainId);
  const network = chain?.label ?? String(asset.chainId);
  const active = resolveActiveAddress({
    chainId: asset.chainId,
    evmAddress,
    solanaAddress,
    bitcoinAddress: ChainUtils.isBitcoinChainId(asset.chainId)
      ? asset.chainId === BITCOIN_MAINNET_CHAIN_ID
        ? bitcoinMainnetAddress
        : bitcoinTestnetAddress
      : undefined,
  });
  const canSend =
    asset.type === EAssetType.Erc20 || asset.type === EAssetType.Native;
  const hasEvmWallet =
    Boolean(evmAddress) && String(evmAddress).toLowerCase() !== "0x0";
  const showBuy = canBuyAsset;

  const openSend = useCallback(() => {
    void requestBalanceRefresh(asset.id);
    setSendOpen(true);
  }, [asset.id, requestBalanceRefresh]);

  const openBuy = useCallback(() => {
    if (!evmAddress || buyBusy || !canBuyAsset) return;
    setBuyBusy(true);
    void openOnramp({
      destinationAddress: evmAddress,
      chainId: Number(BigInt(asset.chainId)),
      tokenSymbol: asset.symbol,
      tokenAddress: asset.address,
      iconUrl: asset.iconUrl,
    })
      .catch(() => {
        /* user closed or mint failed — OnrampView surfaces errors */
      })
      .finally(() => {
        setBuyBusy(false);
      });
  }, [asset.chainId, asset.symbol, buyBusy, canBuyAsset, evmAddress]);

  const openBridge = useCallback(() => {
    if (!evmAddress || bridgeBusy || !canBridge) return;
    setBridgeBusy(true);
    void openCctpBridge({
      sourceChainId: asset.chainId,
      ownerAddress: evmAddress,
      balance,
    })
      .catch(() => {
        /* user closed or rejected */
      })
      .finally(() => {
        setBridgeBusy(false);
        void requestBalanceRefresh(asset.id);
      });
  }, [
    asset.chainId,
    asset.id,
    balance,
    bridgeBusy,
    canBridge,
    evmAddress,
    requestBalanceRefresh,
  ]);

  const openEarnFlow = useCallback(() => {
    if (!evmAddress || earnBusy || !canEarn) return;
    setEarnBusy(true);
    void openEarn({
      chainId: asset.chainId,
      ownerAddress: evmAddress,
      availableAtoms: balance,
    })
      .catch(() => {
        /* user closed or rejected */
      })
      .finally(() => {
        setEarnBusy(false);
        void requestBalanceRefresh(asset.id);
        void earnService
          .getPosition(asset.chainId, evmAddress)
          .then((position) => setEarningAtoms(position.assets))
          .catch(() => setEarningAtoms(0n));
      });
  }, [
    asset.chainId,
    asset.id,
    balance,
    canEarn,
    earnBusy,
    earnService,
    evmAddress,
    requestBalanceRefresh,
  ]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-5"
      aria-label={`${asset.symbol} details`}
    >
      <div className="flex shrink-0 flex-col gap-5">
        <header className="flex flex-col items-center gap-2 pt-2 text-center">
          <AssetIdentityMark
            chainId={asset.chainId}
            address={asset.address}
            symbol={asset.symbol}
            iconUrl={asset.iconUrl}
            chainLogoUrl={chain?.logoUrl}
          />
          <div className="flex flex-col gap-0.5">
            <h2 className="text-foreground text-lg font-semibold tracking-tight">
              {asset.symbol}
            </h2>
            <p className="text-muted-foreground text-xs">{network}</p>
          </div>
          <BalanceDisplay
            trackedAssetId={asset.id}
            balance={asset.balance}
            decimals={asset.decimals}
            fallback={
              asset.type !== EAssetType.Erc20 &&
              asset.type !== EAssetType.Native
                ? copy.balanceNonErc20
                : undefined
            }
            className="text-primary text-3xl font-semibold tracking-tight"
          />
          {canEarn ? (
            <p className="text-muted-foreground text-sm">
              {copy.earningLabel}:{" "}
              {earningAtoms === null
                ? "…"
                : `${formatUnits(earningAtoms, asset.decimals)} ${asset.symbol}`}
            </p>
          ) : null}
        </header>

        <nav
          className="flex items-start justify-center gap-6"
          aria-label="Asset actions"
        >
          {showBuy ? (
            <ActionButton
              label="Buy"
              variant="outline"
              disabled={!hasEvmWallet || buyBusy}
              onClick={openBuy}
            >
              <PlusIcon className="size-5" />
            </ActionButton>
          ) : null}
          <ActionButton
            label={copy.sendLabel}
            variant="primary"
            disabled={!canSend}
            onClick={openSend}
          >
            <SendIcon className="size-5" />
          </ActionButton>
          <ActionButton
            label={copy.receiveLabel}
            variant="outline"
            onClick={() => setReceiveOpen(true)}
          >
            <QrCodeIcon className="size-5" />
          </ActionButton>
          {canBridge ? (
            <ActionButton
              label={copy.bridgeLabel}
              variant="outline"
              disabled={!hasEvmWallet || bridgeBusy}
              onClick={openBridge}
            >
              <ArrowLeftRightIcon className="size-5" />
            </ActionButton>
          ) : null}
          {canEarn ? (
            <ActionButton
              label={copy.earnLabel}
              variant="outline"
              disabled={!hasEvmWallet || earnBusy}
              onClick={openEarnFlow}
            >
              <TrendingUpIcon className="size-5" />
            </ActionButton>
          ) : null}
        </nav>
      </div>

      <TransactionHistory asset={asset} owner={evmAddress} />

      {receiveOpen ? (
        <ReceiveModal
          address={active.address}
          chainLabel={network}
          onClose={() => setReceiveOpen(false)}
        />
      ) : null}
      {sendOpen && asset.type === EAssetType.Native ? (
        <SendNativeTokenModal
          asset={asset}
          onClose={() => setSendOpen(false)}
          onSuccess={() => {
            void requestBalanceRefresh(asset.id);
          }}
        />
      ) : null}
      {sendOpen && asset.type === EAssetType.Erc20 ? (
        <TransferTokensModal
          asset={asset}
          onClose={() => setSendOpen(false)}
          onSuccess={() => {
            void requestBalanceRefresh(asset.id);
          }}
        />
      ) : null}
    </div>
  );
}

function ActionButton({
  label,
  variant,
  children,
  disabled = false,
  onClick,
}: {
  label: string;
  variant: "primary" | "outline";
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        onClick={onClick}
        className={
          variant === "primary"
            ? "bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-full opacity-90 disabled:opacity-50"
            : "border-border bg-background text-foreground flex size-12 items-center justify-center rounded-full border disabled:opacity-50"
        }
      >
        {children}
      </button>
      <span
        className={`text-xs font-medium ${
          variant === "primary" ? "text-primary" : "text-foreground"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
