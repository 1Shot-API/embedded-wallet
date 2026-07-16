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

export const HOST_CHAINS = [
  { value: "0xaa36a7", label: "Sepolia" },
  { value: "0x14a34", label: "Base Sepolia" },
  { value: "0x4cef52", label: "Arc Testnet" },
] as const;

export interface IWalletActionsProps {
  ready: boolean;
  busy: boolean;
  chainId: string;
  message: string;
  tokenAddress: string;
  status: string;
  statusIsError: boolean;
  signature: string | null;
  tokenBalance: string | null;
  onChainChange: (chainId: string) => void;
  onRefreshChain: () => void;
  onMessageChange: (message: string) => void;
  onTokenAddressChange: (address: string) => void;
  onSign: () => void;
  walletVisible: boolean;
  onToggleWallet: () => void;
  onCheckBalance: () => void;
}

export function WalletActions({
  ready,
  busy,
  chainId,
  message,
  tokenAddress,
  status,
  statusIsError,
  signature,
  tokenBalance,
  onChainChange,
  onRefreshChain,
  onMessageChange,
  onTokenAddressChange,
  onSign,
  walletVisible,
  onToggleWallet,
  onCheckBalance,
}: IWalletActionsProps) {
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
        <Label htmlFor="token-address-input">ERC-20 contract address</Label>
        <Input
          id="token-address-input"
          className="font-mono text-[0.85rem]"
          spellCheck={false}
          autoComplete="off"
          placeholder="0x…"
          value={tokenAddress}
          disabled={!ready}
          onChange={(event) => onTokenAddressChange(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!ready || busy}
          onClick={onCheckBalance}
        >
          Check Balance
        </Button>
      </div>

      {tokenBalance ? (
        <pre className="border-border bg-muted/40 overflow-x-auto rounded-md border p-3 font-mono text-xs break-all whitespace-pre-wrap">
          {tokenBalance}
        </pre>
      ) : null}
    </section>
  );
}
