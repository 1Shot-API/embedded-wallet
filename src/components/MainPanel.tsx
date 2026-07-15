import { useWallet } from "../wallet/WalletProvider";
import { styleController, useStyle } from "../style";

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
      <h1 className="mb-1 text-xl font-semibold">{style.copy.productName}</h1>
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
        <div className="grid grid-cols-[7rem_1fr] items-baseline gap-2">
          <label className="font-medium" htmlFor="chain-select">
            Chain
          </label>
          <select
            id="chain-select"
            aria-label="Active chain"
            className="border-border bg-background text-foreground max-w-64 rounded-md border px-2 py-1.5 text-[0.9rem]"
            value={chainId}
            onChange={(event) => {
              void switchChain(event.target.value);
            }}
          >
            {chains.map((chain) => (
              <option key={chain.chainId} value={chain.chainId}>
                {chain.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-[7rem_1fr] items-baseline gap-2">
          <span className="font-medium">Credentials</span>
          <span className="font-mono text-[0.85rem]">{credentialCount}</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {unlocked ? (
            <button
              type="button"
              className="border-border hover:bg-muted cursor-pointer rounded-md border bg-transparent px-3.5 py-2 text-[0.9rem]"
              onClick={() => {
                void openCreateBackup().catch((error: unknown) => {
                  console.error("[create-backup] failed", error);
                });
              }}
            >
              Create backup
            </button>
          ) : null}
          {!unlocked ? (
            <button
              type="button"
              className="border-border hover:bg-muted cursor-pointer rounded-md border bg-transparent px-3.5 py-2 text-[0.9rem]"
              onClick={() => {
                void openRestoreBackup().catch((error: unknown) => {
                  console.error("[restore-backup] failed", error);
                });
              }}
            >
              Restore backup
            </button>
          ) : null}
          <button
            type="button"
            className="border-border hover:bg-muted cursor-pointer rounded-md border bg-transparent px-3.5 py-2 text-[0.9rem]"
            onClick={() => {
              void openCredentialList().catch((error: unknown) => {
                console.error("[credential-list] failed", error);
              });
            }}
          >
            My credentials
          </button>
          {import.meta.env.DEV ? (
            <button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-primary/80 cursor-pointer rounded-md border border-transparent px-3.5 py-2 text-[0.9rem]"
              onClick={() => {
                styleController.merge({
                  theme: {
                    primary: "oklch(0.45 0.18 250)",
                    primaryForeground: "oklch(0.99 0 0)",
                  },
                  copy: {
                    productName: "Styled Demo Wallet",
                    tagline: "setStyle smoke test (dev only)",
                  },
                });
              }}
            >
              Debug: setStyle
            </button>
          ) : null}
        </div>
      </section>
    </>
  );
}
