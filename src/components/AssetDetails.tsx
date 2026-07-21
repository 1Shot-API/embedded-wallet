import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  PlusIcon,
  QrCodeIcon,
  SendIcon,
} from "lucide-react";
import { AddressUtils } from "@1shotapi/ows-wallet-utils";
import type { TrackedAsset } from "../lib/types/domain";
import { EAssetType } from "../lib/types/enum";
import type { EVMChainId } from "@1shotapi/ows-types";
import { DEMO_CHAINS } from "../ows/demoChains";
import { DemoChainsBlockchainProvider } from "../lib/implementations/utils";
import { useStyle } from "../style";
import { useWallet } from "../wallet/WalletProvider";
import { resolveActiveAddress } from "../wallet/activeAddress";
import { useWalletSessionStore } from "../wallet/sessionStore";
import { BalanceDisplay } from "./BalanceDisplay";
import { TransactionHistory } from "./TransactionHistory";
import { ReceiveModal } from "./modals/ReceiveModal";
import { PurchaseComingSoonModal } from "./modals/PurchaseComingSoonModal";
import { TransferTokensModal } from "./modals/TransferTokensModal";

const addressUtils = new AddressUtils(new DemoChainsBlockchainProvider());

function chainLabel(chainId: EVMChainId): string {
  return (
    DEMO_CHAINS.find((chain) => chain.chainId === chainId)?.label ?? chainId
  );
}

export interface IAssetDetailsProps {
  asset: TrackedAsset;
}

/**
 * Shared focused-asset / asset-detail shell.
 * Balance and recent activity are live.
 */
export function AssetDetails({ asset }: IAssetDetailsProps) {
  const { style } = useStyle();
  const { balances: copy } = style.copy;
  const { requestBalanceRefresh } = useWallet();
  const { evmAddress, solanaAddress } = useWalletSessionStore(
    useShallow((state) => ({
      evmAddress: state.evmAddress,
      solanaAddress: state.solanaAddress,
    })),
  );
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  useEffect(() => {
    requestBalanceRefresh(asset.id);
  }, [asset.id, requestBalanceRefresh]);

  const network = chainLabel(asset.chainId);
  const active = resolveActiveAddress({
    chainId: asset.chainId,
    evmAddress,
    solanaAddress,
  });
  const canSend = asset.type === EAssetType.Erc20;

  return (
    <div className="flex flex-col gap-5" aria-label={`${asset.symbol} details`}>
      <header className="flex flex-col items-center gap-2 pt-2 text-center">
        <div
          className="bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-full"
          aria-hidden
        >
          <span className="text-lg font-semibold tracking-tight">$</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-foreground text-lg font-semibold tracking-tight">
            {asset.symbol}
          </h2>
          <p className="text-muted-foreground text-xs">
            {asset.name} · {network}
          </p>
        </div>
        <BalanceDisplay
          trackedAssetId={asset.id}
          balance={asset.balance}
          decimals={asset.decimals}
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
          onClick={() => setSendOpen(true)}
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
          addressUtils={addressUtils}
          onClose={() => setSendOpen(false)}
          onSuccess={() => {
            requestBalanceRefresh(asset.id);
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
