import { useEffect } from "react";
import type { ReactNode } from "react";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  PlusIcon,
  QrCodeIcon,
  SendIcon,
  ShoppingBagIcon,
} from "lucide-react";
import type { TrackedAsset } from "../lib/types/business";
import type { EVMChainId } from "@1shotapi/ows-types";
import { DEMO_CHAINS } from "../ows/demoChains";
import { useWallet } from "../wallet/WalletProvider";
import { BalanceDisplay } from "./BalanceDisplay";

type ActivityKind = "received" | "sent" | "purchase";

interface IMockActivity {
  kind: ActivityKind;
  title: string;
  when: string;
  amount: string;
  positive: boolean;
}

const MOCK_ACTIVITY: IMockActivity[] = [
  {
    kind: "received",
    title: "Received from 0x…4a2b",
    when: "Today, 2:45 PM",
    amount: "+10.00",
    positive: true,
  },
  {
    kind: "sent",
    title: "Sent to alex.eth",
    when: "Yesterday, 11:12 AM",
    amount: "-5.00",
    positive: false,
  },
  {
    kind: "purchase",
    title: "Purchase from Uniswap",
    when: "Oct 24, 09:30 AM",
    amount: "+50.00",
    positive: true,
  },
];

function chainLabel(chainId: EVMChainId): string {
  return (
    DEMO_CHAINS.find((chain) => chain.chainId === chainId)?.label ?? chainId
  );
}

function ActivityIcon({ kind }: { kind: ActivityKind }) {
  const className = "size-4 text-muted-foreground";
  switch (kind) {
    case "received":
      return <ArrowDownLeftIcon className={className} />;
    case "sent":
      return <ArrowUpRightIcon className={className} />;
    case "purchase":
      return <ShoppingBagIcon className={className} />;
  }
}

export interface IAssetDetailsProps {
  asset: TrackedAsset;
}

/**
 * Shared focused-asset / asset-detail shell.
 * Balance is live; recent activity remains mock for now.
 */
export function AssetDetails({ asset }: IAssetDetailsProps) {
  const { requestBalanceRefresh } = useWallet();

  useEffect(() => {
    requestBalanceRefresh(asset.id);
  }, [asset.id, requestBalanceRefresh]);

  const network = chainLabel(asset.chainId);

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
        <ActionButton label="Buy" variant="outline">
          <PlusIcon className="size-5" />
        </ActionButton>
        <ActionButton label="Send" variant="primary">
          <SendIcon className="size-5" />
        </ActionButton>
        <ActionButton label="Receive" variant="outline">
          <QrCodeIcon className="size-5" />
        </ActionButton>
      </nav>

      <section className="border-border flex flex-col gap-3 border-t pt-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-foreground text-sm font-semibold">
            Recent Activity
          </h3>
          <button
            type="button"
            className="text-primary text-sm font-medium"
            disabled
          >
            View all
          </button>
        </div>
        <ul className="flex flex-col gap-1">
          {MOCK_ACTIVITY.map((item) => (
            <li
              key={`${item.kind}-${item.when}`}
              className="flex items-center gap-3 rounded-lg py-2"
            >
              <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
                <ActivityIcon kind={item.kind} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-medium">
                  {item.title}
                </p>
                <p className="text-muted-foreground text-xs">{item.when}</p>
              </div>
              <p
                className={`shrink-0 text-sm font-medium ${
                  item.positive ? "text-primary" : "text-foreground"
                }`}
              >
                {item.amount} {asset.symbol}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ActionButton({
  label,
  variant,
  children,
}: {
  label: string;
  variant: "primary" | "outline";
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        disabled
        aria-label={label}
        className={
          variant === "primary"
            ? "bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-full opacity-90"
            : "border-border bg-background text-foreground flex size-12 items-center justify-center rounded-full border"
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
