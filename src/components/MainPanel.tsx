import { useShallow } from "zustand/react/shallow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWallet } from "../wallet/WalletProvider";
import {
  EWalletMode,
  useWalletSessionStore,
} from "../wallet/sessionStore";
import { resolveActiveAddress } from "../wallet/activeAddress";
import { useStyle } from "../style";
import { AssetDetails } from "./AssetDetails";
import { CopyableText } from "./CopyableText";
import { CredentialsTab } from "./credentials/CredentialsTab";

/**
 * Main unlocked shell: General (network + tabs) or Focused (single asset).
 */
export function MainPanel() {
  const { style } = useStyle();
  const { chains, switchChain } = useWallet();
  const {
    evmAddress,
    solanaAddress,
    chainId,
    mode,
    focusedAssetAddress,
  } = useWalletSessionStore(
    useShallow((state) => ({
      evmAddress: state.evmAddress,
      solanaAddress: state.solanaAddress,
      chainId: state.chainId,
      mode: state.mode,
      focusedAssetAddress: state.focusedAssetAddress,
    })),
  );

  if (mode === EWalletMode.Focused && focusedAssetAddress) {
    return <AssetDetails assetAddress={focusedAssetAddress} />;
  }

  const active = resolveActiveAddress({
    chainId,
    evmAddress,
    solanaAddress,
  });
  const hasAddress = Boolean(active.address && active.address !== "—");

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
          <CopyableText
            text={hasAddress ? active.address : "—"}
            truncate
            disabled={!hasAddress}
            copyLabel="Copy address"
            copiedLabel="Address copied"
            copyFailedLabel="Copy failed"
          />
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
