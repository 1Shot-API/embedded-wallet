import type { ReactNode } from "react";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  PlusIcon,
  QrCodeIcon,
  SendIcon,
  ShoppingBagIcon,
} from "lucide-react";
import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import { useWalletSessionStore } from "../wallet/sessionStore";
import { DEMO_CHAINS } from "../ows/demoChains";

/** Arc Testnet native USDC. */
const ARC_USDC = "0x3600000000000000000000000000000000000000";
/** Base mainnet USDT. */
const BASE_USDT = "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2";

interface IAssetMeta {
  symbol: string;
  name: string;
}

const KNOWN_ASSETS: Record<string, IAssetMeta> = {
  [ARC_USDC.toLowerCase()]: { symbol: "USDC", name: "USD Coin" },
  [BASE_USDT.toLowerCase()]: { symbol: "USDT", name: "Tether USD" },
};

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

function resolveAssetMeta(assetAddress: string): IAssetMeta {
  const known = KNOWN_ASSETS[assetAddress.toLowerCase()];
  if (known) return known;
  const short =
    assetAddress.length > 10
      ? `${assetAddress.slice(0, 6)}…${assetAddress.slice(-4)}`
      : assetAddress;
  return { symbol: short, name: "Token" };
}

function chainLabel(chainId: EVMChainId): string {
  return (
    DEMO_CHAINS.find((chain) => chain.chainId === chainId)?.label ??
    String(chainId)
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
  assetAddress: EVMAccountAddress;
  /** When omitted, uses the session active chain. */
  chainId?: EVMChainId;
}

/**
 * Shared focused-asset / asset-detail shell.
 * Layout only for now — balances and actions are static mock data.
 */
export function AssetDetails({ assetAddress, chainId: chainIdProp }: IAssetDetailsProps) {
  const sessionChainId = useWalletSessionStore((state) => state.chainId);
  const chainId = chainIdProp ?? sessionChainId;
  const meta = resolveAssetMeta(String(assetAddress));
  const network = chainLabel(chainId);

  return (
    <div className="flex flex-col gap-5" aria-label={`${meta.symbol} details`}>
      <header className="flex flex-col items-center gap-2 pt-2 text-center">
        <div
          className="bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-full"
          aria-hidden
        >
          <span className="text-lg font-semibold tracking-tight">$</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-foreground text-lg font-semibold tracking-tight">
            {meta.symbol}
          </h2>
          <p className="text-muted-foreground text-xs">{network}</p>
        </div>
        <p className="text-primary text-3xl font-semibold tracking-tight">
          $123.00
        </p>
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
                {item.amount} {meta.symbol}
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
