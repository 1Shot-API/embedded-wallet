import { useShallow } from "zustand/react/shallow";
import { useWalletSessionStore } from "./wallet/sessionStore";
import { WalletChrome } from "./components/WalletChrome";
import { OnboardingPanel } from "./components/OnboardingPanel";
import { MainPanel } from "./components/MainPanel";
import { SignerHost } from "./components/SignerHost";
import { ModalHost } from "./components/ModalHost";
import { PasskeyPromptModal } from "./components/modals/PasskeyPromptModal";

export function App() {
  const { bootError, ready, unlocked, walletCreated, embedded } =
    useWalletSessionStore(
      useShallow((state) => ({
        bootError: state.bootError,
        ready: state.ready,
        unlocked: state.unlocked,
        walletCreated: state.walletCreated,
        embedded: state.embedded,
      })),
    );

  // Returning sessions with a complete address cache skip Login.
  // Incomplete `ows-wallet-created` (no evm/solana cache) is cleared on hydrate.
  const showOnboarding = !unlocked && !walletCreated;

  return (
    <div className="bg-background text-foreground flex h-full min-h-full flex-col">
      {embedded && !showOnboarding ? <WalletChrome /> : null}

      <div
        className={
          showOnboarding
            ? "flex min-h-0 flex-1 flex-col"
            : "flex min-h-0 flex-1 flex-col px-5 py-4"
        }
      >
        {bootError ? (
          <p className="text-destructive px-5 py-4 text-sm">
            Failed to start: {bootError}
          </p>
        ) : !ready ? (
          <p className="text-muted-foreground px-5 py-4 font-mono text-sm">
            Loading…
          </p>
        ) : showOnboarding ? (
          <OnboardingPanel />
        ) : (
          <MainPanel />
        )}
      </div>

      <SignerHost />
      <ModalHost />
      <PasskeyPromptModal />
    </div>
  );
}
