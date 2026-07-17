import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { copyText } from "@/lib/clipboard";
import { useWallet } from "../wallet/WalletProvider";
import { useWalletSessionStore } from "../wallet/sessionStore";
import {
  resolveActiveAddress,
  shortenAddress,
} from "../wallet/activeAddress";
import { useStyle } from "../style";
import { CredentialsTab } from "./credentials/CredentialsTab";

type CopyState = "idle" | "copied" | "failed";

/**
 * Main unlocked shell: chain + active address, then content tabs.
 */
export function MainPanel() {
  const { style } = useStyle();
  const { chains, switchChain } = useWallet();
  const { evmAddress, solanaAddress, chainId } = useWalletSessionStore(
    useShallow((state) => ({
      evmAddress: state.evmAddress,
      solanaAddress: state.solanaAddress,
      chainId: state.chainId,
    })),
  );
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = resolveActiveAddress({
    chainId,
    evmAddress,
    solanaAddress,
  });
  const canCopy = Boolean(active.address && active.address !== "—");

  useEffect(() => {
    return () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    };
  }, []);

  const copyAddress = () => {
    if (!canCopy) return;
    void copyText(active.address).then((ok) => {
      setCopyState(ok ? "copied" : "failed");
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
      copyResetRef.current = setTimeout(() => setCopyState("idle"), 1500);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3" aria-label="Account">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="wallet-chain"
            className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
          >
            Network
          </label>
          <Select
            value={chainId}
            onValueChange={(value) => {
              if (value) void switchChain(value);
            }}
          >
            <SelectTrigger id="wallet-chain" className="w-full">
              <SelectValue placeholder="Select chain" />
            </SelectTrigger>
            <SelectContent>
              {chains.map((chain) => (
                <SelectItem key={chain.chainId} value={chain.chainId}>
                  {chain.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {active.label} address
          </span>
          <div className="border-border bg-muted/40 flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2">
            <code
              className="min-w-0 flex-1 truncate font-mono text-[0.8rem]"
              title={active.address}
            >
              {shortenAddress(active.address, 8, 6)}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={
                copyState === "copied"
                  ? "Address copied"
                  : copyState === "failed"
                    ? "Copy failed"
                    : "Copy address"
              }
              title={
                copyState === "copied"
                  ? "Copied"
                  : copyState === "failed"
                    ? "Copy failed"
                    : "Copy address"
              }
              disabled={!canCopy}
              onClick={copyAddress}
            >
              {copyState === "copied" ? (
                <CheckIcon className="size-3.5" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
            </Button>
          </div>
        </div>
      </section>

      <Tabs defaultValue="credentials" className="gap-3">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="credentials">
            {style.copy.credentials.tabLabel}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="credentials">
          <CredentialsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
