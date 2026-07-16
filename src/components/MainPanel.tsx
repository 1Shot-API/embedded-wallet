import { CopyIcon } from "lucide-react";
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
import { useWallet } from "../wallet/WalletProvider";
import { useWalletSessionStore } from "../wallet/sessionStore";
import {
  resolveActiveAddress,
  shortenAddress,
} from "../wallet/activeAddress";

/**
 * Main unlocked shell: chain + active address, then content tabs.
 * Credentials tab is a stub until credential management is rebuilt.
 */
export function MainPanel() {
  const { chains, switchChain, openCredentialList } = useWallet();
  const { unlocked, evmAddress, solanaAddress, chainId, credentialCount } =
    useWalletSessionStore(
      useShallow((state) => ({
        unlocked: state.unlocked,
        evmAddress: state.evmAddress,
        solanaAddress: state.solanaAddress,
        chainId: state.chainId,
        credentialCount: state.credentialCount,
      })),
    );

  const active = resolveActiveAddress({
    chainId,
    evmAddress,
    solanaAddress,
  });

  const copyAddress = () => {
    if (!active.address || active.address === "—") return;
    void navigator.clipboard.writeText(active.address).catch((error: unknown) => {
      console.warn("[wallet] copy address failed", error);
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
          <div className="border-border bg-muted/40 flex items-center gap-2 rounded-lg border px-3 py-2">
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
              aria-label="Copy address"
              disabled={!unlocked || active.address === "—"}
              onClick={copyAddress}
            >
              <CopyIcon className="size-3.5" />
            </Button>
          </div>
        </div>
      </section>

      <Tabs defaultValue="credentials" className="gap-3">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
        </TabsList>
        <TabsContent value="credentials" className="flex flex-col gap-3 pt-1">
          <p className="text-muted-foreground text-sm">
            {credentialCount === 0
              ? "No credentials stored yet."
              : `${credentialCount} credential${credentialCount === 1 ? "" : "s"} stored.`}
          </p>
          <p className="text-muted-foreground text-xs">
            Credential management UI is next — use the list for now.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={() => {
              void openCredentialList().catch((error: unknown) => {
                console.error("[credential-list] failed", error);
              });
            }}
          >
            Open credential list
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
