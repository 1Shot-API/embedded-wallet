import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "../wallet/WalletProvider";
import { useWalletSessionStore } from "../wallet/sessionStore";
import { formatWalletSetupError } from "../wallet/formatWalletSetupError";
import { useStyle } from "../style/StyleProvider";
import { BrandLogo } from "./BrandLogo";
import { CloseWalletButton } from "./CloseWalletButton";

function taglineLines(tagline: string): string[] {
  return tagline
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function OnboardingPanel() {
  const { loginWithPasskey, createNewWalletFromUi, openImportPrivateKey } =
    useWallet();
  const signerReady = useWalletSessionStore((state) => state.signerReady);
  const { style } = useStyle();
  const { productName, tagline, logoUrl, walletSetup, advancedOptions } =
    style.copy;
  const lines = taglineLines(tagline);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionsDisabled = busy || !signerReady;

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showSetupError = (err: unknown) => {
    const message = formatWalletSetupError(err, walletSetup);
    setError(message);
    setToast(message);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4_500);
  };

  const runSetup = async (action: () => Promise<void>, label: string) => {
    if (actionsDisabled) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err: unknown) {
      console.error(`[wallet-setup] ${label} failed`, err);
      showSetupError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <div className="absolute top-2.5 right-2.5 z-10">
        <CloseWalletButton />
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-8 text-center">
        <BrandLogo
          logoUrl={logoUrl}
          className="mb-6 size-[4.5rem]"
        />

        <h1 className="text-foreground m-0 text-[1.35rem] font-bold tracking-tight">
          {productName}
        </h1>

        <div className="text-muted-foreground mt-3 mb-8 max-w-[17rem] space-y-1 text-[0.95rem] leading-snug">
          {lines.map((line) => (
            <p key={line} className="m-0">
              {line}
            </p>
          ))}
        </div>

        <div className="flex w-full max-w-[17rem] flex-col gap-3">
          <Button
            type="button"
            size="lg"
            className="h-11 w-full text-[0.95rem] font-semibold"
            disabled={actionsDisabled}
            onClick={() => {
              void runSetup(loginWithPasskey, "embedded login");
            }}
          >
            {walletSetup.loginLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 w-full text-[0.95rem] font-semibold"
            disabled={actionsDisabled}
            onClick={() => {
              void runSetup(createNewWalletFromUi, "embedded create");
            }}
          >
            {walletSetup.createLabel}
          </Button>

          {error ? (
            <p
              role="alert"
              className="text-destructive m-0 text-left text-[0.8rem] leading-snug"
            >
              {error}
            </p>
          ) : null}

          {!showAdvanced ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground mt-1 text-[0.8rem] underline-offset-2 hover:underline"
              disabled={actionsDisabled}
              onClick={() => setShowAdvanced(true)}
            >
              {advancedOptions.onboardingLabel}
            </button>
          ) : (
            <div className="border-border mt-2 flex flex-col gap-2 border-t pt-4 text-left">
              <p className="text-muted-foreground m-0 text-[0.8rem] leading-snug">
                {advancedOptions.body}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-full justify-start text-[0.85rem] font-medium"
                disabled={actionsDisabled}
                onClick={() => {
                  void openImportPrivateKey().catch((err: unknown) => {
                    console.error("[import-private-key] failed", err);
                    showSetupError(err);
                  });
                }}
              >
                {advancedOptions.importLabel}
              </Button>
            </div>
          )}
        </div>
      </div>

      <footer className="border-border shrink-0 border-t px-6 py-3.5 text-center">
        <p className="text-muted-foreground m-0 text-[0.62rem] font-medium tracking-[0.18em] uppercase">
          Powered by 1Shot
        </p>
      </footer>

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="bg-foreground text-background pointer-events-none absolute inset-x-3 bottom-[4.25rem] z-20 rounded-md px-3 py-2.5 text-center text-[0.8rem] leading-snug shadow-md"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
