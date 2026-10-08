import { useShallow } from "zustand/react/shallow";

import { CreateHostPlaceholder } from "./components/CreateHostPlaceholder";
import { MainPanel } from "./components/MainPanel";
import { ModalHost } from "./components/ModalHost";
import { PasskeyPromptModal } from "./components/modals/PasskeyPromptModal";
import { OnboardingPanel } from "./components/OnboardingPanel";
import { SignerCeremonyScrim } from "./components/SignerCeremonyScrim";
import { SignerHost } from "./components/SignerHost";
import { WalletChrome } from "./components/WalletChrome";
import { useStyle } from "./style/StyleProvider";
import { isCreateHostEmbed } from "./wallet/createHostEmbed";
import { useWalletSessionStore } from "./wallet/sessionStore";
import { useSwipeDownToDismiss } from "./wallet/useSwipeDownToDismiss";
import { useWallet } from "./wallet/WalletProvider";

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
  const { requestHide } = useWallet();
  const { style } = useStyle();

  // Returning sessions with a complete address cache skip Login.
  // Incomplete `ows-wallet-created` (no evm/solana cache) is cleared on hydrate.
  const createHost = isCreateHostEmbed();
  const showOnboarding = !unlocked && !walletCreated;
  const showCreateHostShell = createHost && showOnboarding;
  const swipeDismissEnabled =
    embedded && !style.features.hideCloseBox;
  const swipeHandlers = useSwipeDownToDismiss(swipeDismissEnabled, () => {
    void requestHide();
  });

  return (
    <div
      className="bg-background text-foreground flex h-full min-h-full flex-col"
      {...swipeHandlers}
    >
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
        ) : !ready && createHost ? (
          <CreateHostPlaceholder />
        ) : !ready ? (
          <p className="text-muted-foreground px-5 py-4 font-mono text-sm">
            Loading…
          </p>
        ) : showCreateHostShell ? (
          <CreateHostPlaceholder />
        ) : showOnboarding ? (
          <OnboardingPanel />
        ) : (
          <MainPanel />
        )}
      </div>

      <SignerCeremonyScrim />
      <SignerHost />
      <ModalHost />
      <PasskeyPromptModal />
    </div>
  );
}
