import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWallet } from "../wallet/WalletProvider";
import { useStyle } from "../style";

export function MainPanel() {
  const {
    unlocked,
    walletCreated,
    evmAddress,
    solanaAddress,
    chainId,
    chains,
    credentialCount,
    switchChain,
    openCreateBackup,
    openRestoreBackup,
    openCredentialList,
  } = useWallet();
  const { style } = useStyle();

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
          {unlocked ? (
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
          {!unlocked ? (
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
