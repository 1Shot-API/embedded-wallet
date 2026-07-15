import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { hasBackup } from "../storage";
import { useStyle } from "../style";
import { useWallet } from "../wallet/WalletProvider";
import { useWalletSessionStore } from "../wallet/sessionStore";

export function MainPanel() {
  const {
    chains,
    switchChain,
    openCreateBackup,
    openRestoreBackup,
    openCredentialList,
  } = useWallet();
  const {
    unlocked,
    walletCreated,
    evmAddress,
    solanaAddress,
    chainId,
    credentialCount,
  } = useWalletSessionStore(
    useShallow((state) => ({
      unlocked: state.unlocked,
      walletCreated: state.walletCreated,
      evmAddress: state.evmAddress,
      solanaAddress: state.solanaAddress,
      chainId: state.chainId,
      credentialCount: state.credentialCount,
    })),
  );
  const { style } = useStyle();
  const canRestore = hasBackup();

  const status = unlocked
    ? "Unlocked"
    : walletCreated
      ? "Created (locked)"
      : "Not created";

  return (
    <>
      <h1 className="text-foreground mb-1 text-xl font-semibold tracking-tight">
        {style.copy.productName}
      </h1>
      <p className="text-muted-foreground mb-4 text-[0.9rem]">
        {style.copy.tagline}
      </p>

      <section className="grid max-w-xl gap-2" aria-label="Wallet status">
        <div className="grid grid-cols-[7rem_1fr] items-baseline gap-2">
          <span className="font-medium">Status</span>
          <span className="font-mono text-[0.85rem] break-all">{status}</span>
        </div>
        <div className="grid grid-cols-[7rem_1fr] items-baseline gap-2">
          <span className="font-medium">EVM</span>
          <span className="font-mono text-[0.85rem] break-all">{evmAddress}</span>
        </div>
        <div className="grid grid-cols-[7rem_1fr] items-baseline gap-2">
          <span className="font-medium">Solana</span>
          <span className="font-mono text-[0.85rem] break-all">
            {solanaAddress}
          </span>
        </div>
        <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
          <span className="font-medium" id="chain-label">
            Chain
          </span>
          <Select
            value={chainId}
            onValueChange={(value) => {
              if (value) void switchChain(value);
            }}
          >
            <SelectTrigger
              className="max-w-64"
              size="default"
              aria-labelledby="chain-label"
            >
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
        <div className="grid grid-cols-[7rem_1fr] items-baseline gap-2">
          <span className="font-medium">Credentials</span>
          <span className="font-mono text-[0.85rem]">{credentialCount}</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {/*
            Create when unlocked, or when locked with no stored backup (openCreateBackup
            → ensureReady will unlock / run setup). Restore only when locked + backup.
          */}
          {unlocked || !canRestore ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void openCreateBackup().catch((error: unknown) => {
                  console.error("[create-backup] failed", error);
                });
              }}
            >
              Create backup
            </Button>
          ) : null}
          {!unlocked && canRestore ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void openRestoreBackup().catch((error: unknown) => {
                  console.error("[restore-backup] failed", error);
                });
              }}
            >
              Restore backup
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void openCredentialList().catch((error: unknown) => {
                console.error("[credential-list] failed", error);
              });
            }}
          >
            My credentials
          </Button>
        </div>
      </section>
    </>
  );
}
