import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { CheckIcon, CopyIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { copyText } from "@/lib/clipboard";
import type { TrackedAsset } from "../lib/types/domain";
import { useWallet } from "../wallet/WalletProvider";
import {
  EWalletMode,
  useWalletSessionStore,
} from "../wallet/sessionStore";
import { resolveActiveAddress } from "../wallet/activeAddress";
import { useStyle } from "../style";
import { AccountMetaChip } from "./AccountMetaChip";
import { AssetDetails } from "./AssetDetails";
import { BalancesTab } from "./balances/BalancesTab";
import { CredentialsTab } from "./credentials/CredentialsTab";
import { SelectNetworkModal } from "./modals/SelectNetworkModal";

const TRUNCATE_CHARS = 5;
const COPY_FEEDBACK_MS = 1500;

type CopyState = "idle" | "copied" | "failed";

function formatTruncated(text: string): string {
  if (text.length <= TRUNCATE_CHARS * 2 + 1) return text;
  return `${text.slice(0, TRUNCATE_CHARS)}…${text.slice(-TRUNCATE_CHARS)}`;
}

function FocusedAssetPanel() {
  const { resolveTrackedAsset } = useWallet();
  const { chainId, focusedAssetAddress } = useWalletSessionStore(
    useShallow((state) => ({
      chainId: state.chainId,
      focusedAssetAddress: state.focusedAssetAddress,
    })),
  );
  const [asset, setAsset] = useState<TrackedAsset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!focusedAssetAddress) return;
    let cancelled = false;
    setError(null);
    void resolveTrackedAsset(chainId, focusedAssetAddress)
      .then((resolved) => {
        if (!cancelled) setAsset(resolved);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setAsset(null);
          setError(err instanceof Error ? err.message : "Failed to load asset");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [chainId, focusedAssetAddress, resolveTrackedAsset]);

  if (error) {
    return <p className="text-destructive m-0 text-sm">{error}</p>;
  }
  if (!asset) {
    return <p className="text-muted-foreground m-0 text-sm">Loading…</p>;
  }
  return <AssetDetails asset={asset} />;
}

/**
 * Main unlocked shell: General (network + tabs) or Focused (single asset).
 */
export function MainPanel() {
  const { style } = useStyle();
  const { account: accountCopy } = style.copy;
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
  const [networkModalOpen, setNetworkModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<TrackedAsset | null>(
    null,
  );
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    };
  }, []);

  useEffect(() => {
    setSelectedAsset(null);
  }, [chainId]);

  if (mode === EWalletMode.Focused && focusedAssetAddress) {
    return <FocusedAssetPanel />;
  }

  if (selectedAsset) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={style.copy.balances.closeLabel}
            onClick={() => setSelectedAsset(null)}
          >
            <XIcon />
          </Button>
        </div>
        <AssetDetails asset={selectedAsset} />
      </div>
    );
  }

  const active = resolveActiveAddress({
    chainId,
    evmAddress,
    solanaAddress,
  });
  const hasAddress = Boolean(active.address && active.address !== "—");
  const selectedChain =
    chains.find(
      (chain) =>
        String(chain.chainId).toLowerCase() === String(chainId).toLowerCase(),
    ) ?? null;
  const networkLabel = selectedChain?.label ?? String(chainId);

  const copyFeedbackLabel =
    copyState === "copied"
      ? accountCopy.addressCopiedLabel
      : copyState === "failed"
        ? accountCopy.addressCopyFailedLabel
        : accountCopy.copyAddressLabel;

  const onCopyAddress = () => {
    if (!hasAddress) return;
    void copyText(active.address).then((ok) => {
      setCopyState(ok ? "copied" : "failed");
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
      copyResetRef.current = setTimeout(
        () => setCopyState("idle"),
        COPY_FEEDBACK_MS,
      );
    });
  };

  const onSelectNetwork = (next: string) => {
    setNetworkModalOpen(false);
    if (
      String(next).toLowerCase() !== String(chainId).toLowerCase()
    ) {
      void switchChain(next);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <section
        className="grid grid-cols-2 gap-2"
        aria-label="Account"
      >
        <AccountMetaChip
          ariaLabel={networkLabel}
          value={networkLabel}
          onClick={() => setNetworkModalOpen(true)}
          icon={
            selectedChain ? (
              <img
                src={selectedChain.logoUrl}
                alt=""
                className="size-7 rounded-full object-cover"
              />
            ) : (
              <span className="bg-muted size-7 rounded-full" aria-hidden />
            )
          }
        />
        <AccountMetaChip
          ariaLabel={copyFeedbackLabel}
          title={hasAddress ? active.address : undefined}
          value={hasAddress ? formatTruncated(active.address) : "—"}
          disabled={!hasAddress}
          onClick={onCopyAddress}
          icon={
            <span className="bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-full">
              {copyState === "copied" ? (
                <CheckIcon className="size-3.5" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
            </span>
          }
        />
      </section>

      <Tabs defaultValue="balances" className="gap-3">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="balances">
            {style.copy.balances.tabLabel}
          </TabsTrigger>
          <TabsTrigger value="credentials">
            {style.copy.credentials.tabLabel}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="balances">
          <BalancesTab onView={setSelectedAsset} />
        </TabsContent>
        <TabsContent value="credentials">
          <CredentialsTab />
        </TabsContent>
      </Tabs>

      {networkModalOpen ? (
        <SelectNetworkModal
          chains={chains}
          selectedChainId={chainId}
          onSelect={onSelectNetwork}
          onClose={() => setNetworkModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
