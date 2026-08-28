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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { SignMode } from "@/constants/signDemo";
import { EnableArcMainnet } from "@/features";
import {
  HOST_CHAINS,
  hostChainMeta,
  type UsdcMode,
} from "./hostChains";

export type { UsdcMode } from "./hostChains";
export type { SignMode } from "@/constants/signDemo";

export interface IWalletActionsProps {
  ready: boolean;
  busy: boolean;
  account: string | null;
  chainId: string;
  message: string;
  signMode: SignMode;
  typedDataJson: string;
  usdcMode: UsdcMode;
  usdcDestination: string;
  usdcAmount: string;
  status: string;
  statusIsError: boolean;
  signature: string | null;
  usdcOutput: string | null;
  txHash: string | null;
  txExplorerUrl: string | null;
  onConnect: () => void;
  onChainChange: (chainId: string) => void;
  onRefreshChain: () => void;
  onMessageChange: (message: string) => void;
  onSignModeChange: (mode: SignMode) => void;
  onTypedDataJsonChange: (json: string) => void;
  onUsdcModeChange: (mode: UsdcMode) => void;
  onUsdcDestinationChange: (address: string) => void;
  onUsdcAmountChange: (amount: string) => void;
  onSign: () => void;
  onLoadSiwe: () => void;
  walletVisible: boolean;
  onToggleWallet: () => void;
  onUsdcAction: () => void;
  onFocusUsdcArc: () => void;
  onFocusUsdtBase: () => void;
  onUnfocusWallet: () => void;
  onAddUsdcArc: () => void;
  onAddUsdtBase: () => void;
  onOnramp: () => void;
  onBridge: () => void;
  /** In-memory grants from this session (`wallet_requestExecutionPermissions`). */
  sessionGrants: ReadonlyArray<{
    id: string;
    summary: string;
    json: string;
  }>;
  delegationsOutput: string | null;
  onRequestDelegation: () => void;
  onCancelDelegation: (id: string) => void;
  onGetSupportedPermissions: () => void;
  onGetGrantedPermissions: () => void;
}

export function WalletActions({
  ready,
  busy,
  account,
  chainId,
  message,
  signMode,
  typedDataJson,
  usdcMode,
  usdcDestination,
  usdcAmount,
  status,
  statusIsError,
  signature,
  usdcOutput,
  txHash,
  txExplorerUrl,
  onConnect,
  onChainChange,
  onRefreshChain,
  onMessageChange,
  onSignModeChange,
  onTypedDataJsonChange,
  onUsdcModeChange,
  onUsdcDestinationChange,
  onUsdcAmountChange,
  onSign,
  onLoadSiwe,
  walletVisible,
  onToggleWallet,
  onUsdcAction,
  onFocusUsdcArc,
  onFocusUsdtBase,
  onUnfocusWallet,
  onAddUsdcArc,
  onAddUsdtBase,
  onOnramp,
  onBridge,
  sessionGrants,
  delegationsOutput,
  onRequestDelegation,
  onCancelDelegation,
  onGetSupportedPermissions,
  onGetGrantedPermissions,
}: IWalletActionsProps) {
  const meta = hostChainMeta(chainId);
  const tokenSymbol = meta?.tokenSymbol ?? "USDC";
  const accountLabel = account
    ? `${account.slice(0, 6)}…${account.slice(-4)}`
    : ready
      ? "Not connected"
      : "Connecting…";

  return (
    <section className="flex flex-col gap-3" aria-label="Wallet actions">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium">Account</p>
          <p className="text-foreground font-mono text-sm">{accountLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={!ready || busy} onClick={onConnect}>
            Connect
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
      </div>

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
        <Tabs
          value={signMode}
          onValueChange={(value) => {
            if (value === "message" || value === "typedData") {
              onSignModeChange(value);
            }
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="message" className="flex-1">
              Message
            </TabsTrigger>
            <TabsTrigger value="typedData" className="flex-1">
              Typed Data (EIP-712)
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {signMode === "message" ? (
          <>
            <Label htmlFor="message-input">Message to sign</Label>
            <Textarea
              id="message-input"
              rows={3}
              value={message}
              disabled={!ready}
              onChange={(event) => onMessageChange(event.target.value)}
            />
          </>
        ) : (
          <>
            <Label htmlFor="typed-data-input">Typed Data JSON</Label>
            <Textarea
              id="typed-data-input"
              rows={3}
              className="field-sizing-fixed resize-y overflow-auto font-mono text-xs"
              spellCheck={false}
              value={typedDataJson}
              disabled={!ready}
              onChange={(event) => onTypedDataJsonChange(event.target.value)}
            />
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!ready || busy} onClick={onSign}>
          Sign
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!ready || busy}
          onClick={onLoadSiwe}
        >
          SIWE
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
            <SelectItem value="send">Send {tokenSymbol}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground font-mono text-xs break-all">
          {meta ? `${tokenSymbol}: ${meta.usdc}` : "Token: unsupported chain"}
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
          {usdcMode === "send" ? `Send ${tokenSymbol}` : "Check Balance"}
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
        <Label>{EnableArcMainnet ? "Onramp / Bridge" : "Bridge"}</Label>
        <p className="text-muted-foreground text-xs">
          {EnableArcMainnet ? (
            <>
              Open Circle fiat onramp via <code>onramp</code>, or gasless CCTP
              USDC bridge via <code>bridge</code>.
            </>
          ) : (
            <>
              Open gasless CCTP USDC bridge via <code>bridge</code>.
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {EnableArcMainnet ? (
            <Button
              type="button"
              variant="outline"
              disabled={!ready || busy}
              onClick={onOnramp}
            >
              Onramp
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={!ready || busy}
            onClick={onBridge}
          >
            Bridge
          </Button>
        </div>
      </div>

      <hr className="border-border my-1" />

      <div className="flex flex-col gap-1.5">
        <Label>Delegations (EIP-7715)</Label>
        <p className="text-muted-foreground text-xs">
          Request a periodic USDC spending permission for the current chain
          (session key held in memory only). Relayer-enabled chains only.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!ready || busy}
            onClick={onRequestDelegation}
          >
            Request permission
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!ready || busy}
            onClick={onGetSupportedPermissions}
          >
            Get supported
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!ready || busy}
            onClick={onGetGrantedPermissions}
          >
            Get granted
          </Button>
        </div>

        {sessionGrants.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {sessionGrants.map((grant) => (
              <li
                key={grant.id}
                className="border-border flex flex-col gap-2 rounded-md border p-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-foreground m-0 text-xs font-medium">
                    {grant.summary}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!ready || busy}
                    onClick={() => onCancelDelegation(grant.id)}
                  >
                    Cancel
                  </Button>
                </div>
                <pre className="border-border bg-muted/40 m-0 max-h-40 overflow-auto rounded-md border p-2 font-mono text-[0.65rem] break-all whitespace-pre-wrap">
                  {grant.json}
                </pre>
              </li>
            ))}
          </ul>
        ) : null}

        {delegationsOutput ? (
          <pre className="border-border bg-muted/40 overflow-x-auto rounded-md border p-3 font-mono text-xs break-all whitespace-pre-wrap">
            {delegationsOutput}
          </pre>
        ) : null}
      </div>
    </section>
  );
}
