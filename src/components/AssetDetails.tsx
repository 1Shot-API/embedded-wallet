import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  PlusIcon,
  QrCodeIcon,
  SendIcon,
} from "lucide-react";
import { TrackedAsset } from "../lib/types/domain";
import { EAssetType } from "../lib/types/enum/EAssetType";
import { useStyle } from "../style/StyleProvider";
import { useWallet } from "../wallet/WalletProvider";
import { resolveActiveAddress } from "../wallet/activeAddress";
import { useLiveTrackedBalance } from "../wallet/useLiveTrackedBalance";
import { useWalletSessionStore } from "../wallet/sessionStore";
import { AssetIdentityMark } from "./AssetIdentityMark";
import { BalanceDisplay } from "./BalanceDisplay";
import { TransactionHistory } from "./TransactionHistory";
import { ReceiveModal } from "./modals/ReceiveModal";
import { PurchaseComingSoonModal } from "./modals/PurchaseComingSoonModal";
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
  const { requestBalanceRefresh, resolveChain } = useWallet();
  const { evmAddress, solanaAddress } = useWalletSessionStore(
    useShallow((state) => ({
      evmAddress: state.evmAddress,
      solanaAddress: state.solanaAddress,
    })),
  );
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

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
        );

  useEffect(() => {
    void requestBalanceRefresh(assetProp.id);
  }, [assetProp.id, requestBalanceRefresh]);

  const chain = resolveChain(asset.chainId);
  const network = chain?.label ?? String(asset.chainId);
  const active = resolveActiveAddress({
    chainId: asset.chainId,
    evmAddress,
    solanaAddress,
  });
  const canSend = asset.type === EAssetType.Erc20;

  const openSend = useCallback(() => {
    void requestBalanceRefresh(asset.id);
    setSendOpen(true);
  }, [asset.id, requestBalanceRefresh]);

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
              asset.type !== EAssetType.Erc20 ? copy.balanceNonErc20 : undefined
            }
            className="text-primary text-3xl font-semibold tracking-tight"
          />
        </header>

        <nav
          className="flex items-start justify-center gap-8"
          aria-label="Asset actions"
        >
          <ActionButton
            label="Buy"
            variant="outline"
            onClick={() => setPurchaseOpen(true)}
          >
            <PlusIcon className="size-5" />
          </ActionButton>
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
      {sendOpen ? (
        <TransferTokensModal
          asset={asset}
          onClose={() => setSendOpen(false)}
          onSuccess={() => {
            void requestBalanceRefresh(asset.id);
          }}
        />
      ) : null}
      {purchaseOpen ? (
        <PurchaseComingSoonModal onClose={() => setPurchaseOpen(false)} />
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
