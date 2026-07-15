import { useWallet } from "./wallet/WalletProvider";
import { WalletChrome } from "./components/WalletChrome";
import { OnboardingPanel } from "./components/OnboardingPanel";
import { MainPanel } from "./components/MainPanel";
import { SignerHost } from "./components/SignerHost";
import { ModalHost } from "./components/ModalHost";

export function App() {
  const { bootError, ready, unlocked, walletCreated, embedded } = useWallet();

  const showOnboarding = embedded && !walletCreated && !unlocked;

  return (
    <div className="bg-background text-foreground flex min-h-full flex-col">
      {embedded ? <WalletChrome /> : null}

      <div className="flex-1 px-5 py-4">
        {bootError ? (
          <p className="text-destructive text-sm">
            Failed to start: {bootError}
          </p>
        ) : !ready ? (
          <p className="text-muted-foreground font-mono text-sm">Loading…</p>
        ) : showOnboarding ? (
          <OnboardingPanel />
        ) : (
          <MainPanel />
        )}
      </div>

      <SignerHost />
      <ModalHost />
    </div>
  );
}
