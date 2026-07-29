import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  HOST_CHAINS,
  hostChainMeta,
  type UsdcMode,
} from "./hostChains";

export type { UsdcMode } from "./hostChains";

export interface IWalletActionsProps {
  ready: boolean;
  busy: boolean;
  chainId: string;
  message: string;
  usdcMode: UsdcMode;
  usdcDestination: string;
  usdcAmount: string;
  status: string;
  statusIsError: boolean;
  signature: string | null;
  usdcOutput: string | null;
  txHash: string | null;
  txExplorerUrl: string | null;
  onChainChange: (chainId: string) => void;
  onRefreshChain: () => void;
  onMessageChange: (message: string) => void;
  onUsdcModeChange: (mode: UsdcMode) => void;
  onUsdcDestinationChange: (address: string) => void;
  onUsdcAmountChange: (amount: string) => void;
  onSign: () => void;
  walletVisible: boolean;
  onToggleWallet: () => void;
  onUsdcAction: () => void;
  onFocusUsdcArc: () => void;
  onFocusUsdtBase: () => void;
  onUnfocusWallet: () => void;
  onAddUsdcArc: () => void;
  onAddUsdtBase: () => void;
  onOnramp: () => void;
}

export function WalletActions({
  ready,
  busy,
  chainId,
  message,
  usdcMode,
  usdcDestination,
  usdcAmount,
  status,
  statusIsError,
  signature,
  usdcOutput,
  txHash,
  txExplorerUrl,
  onChainChange,
  onRefreshChain,
  onMessageChange,
  onUsdcModeChange,
  onUsdcDestinationChange,
  onUsdcAmountChange,
  onSign,
  walletVisible,
  onToggleWallet,
  onUsdcAction,
  onFocusUsdcArc,
  onFocusUsdtBase,
  onUnfocusWallet,
  onAddUsdcArc,
  onAddUsdtBase,
  onOnramp,
}: IWalletActionsProps) {
  const meta = hostChainMeta(chainId);

  return (
    <section className="flex flex-col gap-3" aria-label="Wallet actions">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="chain-select" className="shrink-0">
          Chain
        </Label>
        <Select
          value={chainId}
          disabled={!ready || busy}
          onValueChange={(value) => {
            if (value) onChainChange(value);
          }}
        >
          <SelectTrigger id="chain-select" className="min-w-40 flex-1">
            <SelectValue placeholder="Select chain" />
          </SelectTrigger>
          <SelectContent>
            {HOST_CHAINS.map((chain) => (
              <SelectItem key={chain.value} value={chain.value}>
                {chain.label}
              </SelectItem>
            ))}
            {!HOST_CHAINS.some((chain) => chain.value === chainId) &&
            chainId ? (
              <SelectItem value={chainId}>{chainId}</SelectItem>
            ) : null}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Refresh chain from wallet"
          title="Refresh chain from wallet"
          disabled={!ready || busy}
          onClick={onRefreshChain}
        >
          <RefreshCwIcon />
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="message-input">Message to sign (EIP-191)</Label>
        <Textarea
          id="message-input"
          rows={3}
          value={message}
          disabled={!ready}
          onChange={(event) => onMessageChange(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!ready || busy} onClick={onSign}>
          Sign
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!ready}
          onClick={onToggleWallet}
        >
          {walletVisible ? "Hide Wallet" : "Show Wallet"}
        </Button>
      </div>

      <p
        className={`min-h-5 text-sm ${statusIsError ? "text-destructive" : "text-muted-foreground"}`}
        aria-live="polite"
      >
        {status}
      </p>

      {signature ? (
        <pre className="border-border bg-muted/40 overflow-x-auto rounded-md border p-3 font-mono text-xs break-all whitespace-pre-wrap">
          {signature}
        </pre>
      ) : null}

      <hr className="border-border my-1" />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="usdc-mode-select">USDC</Label>
        <Select
          value={usdcMode}
          disabled={!ready || busy}
          onValueChange={(value) => {
            if (value === "balance" || value === "send") {
              onUsdcModeChange(value);
            }
          }}
        >
          <SelectTrigger id="usdc-mode-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="balance">Check Balance</SelectItem>
            <SelectItem value="send">Send USDC</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground font-mono text-xs break-all">
          {meta ? `USDC: ${meta.usdc}` : "USDC: unsupported chain"}
        </p>
      </div>

      {usdcMode === "send" ? (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="usdc-destination-input">Destination</Label>
            <Input
              id="usdc-destination-input"
              className="font-mono text-[0.85rem]"
              spellCheck={false}
              autoComplete="off"
              placeholder="0x…"
              value={usdcDestination}
              disabled={!ready}
              onChange={(event) =>
                onUsdcDestinationChange(event.target.value)
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="usdc-amount-input">Amount (USDC)</Label>
            <Input
              id="usdc-amount-input"
              spellCheck={false}
              autoComplete="off"
              inputMode="decimal"
              placeholder="1.0"
              value={usdcAmount}
              disabled={!ready}
              onChange={(event) => onUsdcAmountChange(event.target.value)}
            />
          </div>
        </>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!ready || busy}
          onClick={onUsdcAction}
        >
          {usdcMode === "send" ? "Send USDC" : "Check Balance"}
        </Button>
      </div>

      {usdcOutput ? (
        <pre className="border-border bg-muted/40 overflow-x-auto rounded-md border p-3 font-mono text-xs break-all whitespace-pre-wrap">
          {usdcOutput}
        </pre>
      ) : null}

      {txHash && txExplorerUrl ? (
        <p className="text-muted-foreground text-sm">
          <a
            href={txExplorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            View on explorer
          </a>
        </p>
      ) : null}

      <hr className="border-border my-1" />

      <div className="flex flex-col gap-1.5">
        <Label>Focus mode</Label>
        <p className="text-muted-foreground text-xs">
          Host-controlled shell: lock the wallet to one chain + asset, or restore
          general mode.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!ready || busy}
            onClick={onFocusUsdcArc}
          >
            Focus USDC (Arc)
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!ready || busy}
            onClick={onFocusUsdtBase}
          >
            Focus Tether (Base)
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!ready || busy}
            onClick={onUnfocusWallet}
          >
            Unfocus
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Add asset</Label>
        <p className="text-muted-foreground text-xs">
          Propose a tracked asset via <code>addAsset</code> (user must confirm
          in the wallet).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!ready || busy}
            onClick={onAddUsdcArc}
          >
            Add Arc USDC
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!ready || busy}
            onClick={onAddUsdtBase}
          >
            Add Base USDT
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Onramp</Label>
        <p className="text-muted-foreground text-xs">
          Open Circle fiat onramp via <code>onramp</code> (Buy crypto into the
          unlocked wallet address).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!ready || busy}
            onClick={onOnramp}
          >
            Onramp
          </Button>
        </div>
      </div>
    </section>
  );
}
