import { useShallow } from "zustand/react/shallow";
import { useWalletSessionStore } from "./wallet/sessionStore";
import { WalletChrome } from "./components/WalletChrome";
import { OnboardingPanel } from "./components/OnboardingPanel";
import { MainPanel } from "./components/MainPanel";
import { SignerHost } from "./components/SignerHost";
import { ModalHost } from "./components/ModalHost";
import { WALLET_SHELL_ID } from "./wallet/useWalletFrameResize";

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

  const showOnboarding = embedded && !walletCreated && !unlocked;

  return (
    <>
      <div
        id={WALLET_SHELL_ID}
        className="bg-background text-foreground flex h-auto min-h-0 flex-col"
      >
        {embedded ? <WalletChrome /> : null}

        <div className={showOnboarding ? "" : "px-5 py-4"}>
          {bootError ? (
            <p className="text-destructive px-5 py-4 text-sm">
              Failed to start: {bootError}
            </p>
          ) : !ready ? (
            <p className="text-muted-foreground px-5 py-4 font-mono text-sm">
              Loading…
            </p>
          ) : showOnboarding ? (
            <>
              <div className="flex flex-col items-center px-5 pt-6 pb-5">
                <OnboardingPanel />
              </div>
              <footer className="border-border shrink-0 border-t px-5 py-2.5 text-center">
                <p className="text-muted-foreground text-[0.65rem] font-medium tracking-[0.18em] uppercase">
                  Powered by 1Shot
                </p>
              </footer>
            </>
          ) : (
            <MainPanel />
          )}
        </div>
      </div>

      <SignerHost />
      <ModalHost />
    </>
  );
}
