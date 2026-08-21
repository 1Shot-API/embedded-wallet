import { useEffect, useRef, useState } from "react";
import {
  EWalletPresentationMode,
  OWSProxy,
} from "@1shotapi/ows-provider";
import type { IOWSAnalyticsEvent } from "@1shotapi/ows-types";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import { AppHeader } from "./components/AppHeader";
import { AppSidebar, type HostMode } from "./components/AppSidebar";
import { DesignPanel } from "./components/DesignPanel";
import { InjectedPanel } from "./components/InjectedPanel";
import { TestPanel } from "./components/TestPanel";
import { SidebarInset, SidebarProvider } from "./components/ui/sidebar";
import { TooltipProvider } from "./components/ui/tooltip";
import { useHostTestActions } from "./hooks/useHostTestActions";

/** MetaMask-like branding panel size (also default in ows-provider). */
const WALLET_SIZE_X = 360;
const WALLET_SIZE_Y = 600;
const MAX_ANALYTICS_EVENTS = 50;

export function App() {
  const flyoutContainerRef = useRef<HTMLDivElement | null>(null);
  const proxyRef = useRef<OWSProxy | null>(null);
  /** Last configure payload from Design mode — re-applied after Test recreate. */
  const lastStyleRef = useRef<Record<string, unknown> | null>(null);
  const [previewMount, setPreviewMount] = useState<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<HostMode>("test");
  const [analyticsEvents, setAnalyticsEvents] = useState<IOWSAnalyticsEvent[]>(
    [],
  );

  const {
    ready,
    setReady,
    setWalletVisible,
    reportStatus,
    refreshChainFromWallet,
    walletActionProps,
    handleApplyStyle,
  } = useHostTestActions({ proxyRef, lastStyleRef });

  // Presentation is create-time only. Switching Test ↔ Design destroys and
  // recreates the proxy against the right container (reparenting breaks Postmate).
  // Injected mode intentionally skips OWSProxy — extension provides window.ethereum.
  useEffect(() => {
    if (mode === "injected") {
      setReady(false);
      setWalletVisible(false);
      proxyRef.current?.destroy();
      proxyRef.current = null;
      return;
    }

    if (mode === "design" && !previewMount) {
      return;
    }

    const container =
      mode === "design" ? previewMount : flyoutContainerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;
    setReady(false);
    setWalletVisible(false);
    reportStatus("Connecting to wallet…");

    console.info(
      "[oneshot-wallet-host] creating Branding Layer proxy",
      mode,
      __WALLET_IFRAME_URL__,
    );

    void (async () => {
      proxyRef.current?.destroy();
      proxyRef.current = null;
      container.replaceChildren();

      try {
        const proxy = await OWSProxy.create(container, __WALLET_IFRAME_URL__, {
          walletSizeX: WALLET_SIZE_X,
          walletSizeY: WALLET_SIZE_Y,
          presentationMode:
            mode === "design"
              ? EWalletPresentationMode.Inline
              : EWalletPresentationMode.Flyout,
        });
        if (cancelled) {
          proxy.destroy();
          return;
        }
        proxyRef.current = proxy;

        (
          proxy as OWSProxy & {
            analytics?: {
              on: (handler: (event: IOWSAnalyticsEvent) => void) => void;
            };
          }
        ).analytics?.on((event) => {
          console.info("[oneshot-wallet-host] analytics", event.name, event);
          setAnalyticsEvents((prev) =>
            [event, ...prev].slice(0, MAX_ANALYTICS_EVENTS),
          );
        });

        if (lastStyleRef.current) {
          await proxy.rpc("configure", lastStyleRef.current);
        }

        if (cancelled) {
          proxy.destroy();
          proxyRef.current = null;
          return;
        }

        setReady(true);
        try {
          const connectedChain = await refreshChainFromWallet(proxy);
          reportStatus(
            mode === "design"
              ? `Design preview connected on ${connectedChain}. Apply configure to refresh.`
              : mode === "analytics"
                ? "Live analytics — switch to Test to generate events."
                : `Wallet connected on ${connectedChain}. Enter a message and click Sign.`,
          );
        } catch (error) {
          reportStatus(
            error instanceof Error ? error.message : "Failed to read chain id",
            true,
          );
        }
      } catch (error) {
        if (cancelled) return;
        console.error("[oneshot-wallet-host] failed to start", error);
        reportStatus(
          error instanceof Error
            ? error.message
            : "Failed to connect to wallet",
          true,
        );
      }
    })();

    return () => {
      cancelled = true;
      proxyRef.current?.destroy();
      proxyRef.current = null;
    };
  }, [
    mode,
    previewMount,
    refreshChainFromWallet,
    reportStatus,
    setReady,
    setWalletVisible,
  ]);

  // Keep the Show/Hide label in sync when the wallet closes itself (× / menu).
  useEffect(() => {
    if (mode !== "test") {
      return;
    }
    const container = flyoutContainerRef.current;
    if (!container) {
      return;
    }

    const syncVisibility = () => {
      const width = container.offsetWidth;
      const height = container.offsetHeight;
      // Full flyout ≈ wallet size; hidden is 0×0; RPC passthrough is 1×1.
      setWalletVisible(width > 32 && height > 32);
    };

    syncVisibility();
    const observer = new ResizeObserver(syncVisibility);
    observer.observe(container);
    return () => observer.disconnect();
  }, [mode, ready, setWalletVisible]);

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen>
        <AppSidebar mode={mode} onModeChange={setMode} />
        <SidebarInset className="bg-muted min-h-svh">
          <AppHeader />
          {mode === "test" ? (
            <TestPanel {...walletActionProps} />
          ) : mode === "design" ? (
            <DesignPanel
              ready={ready}
              onApplyStyle={handleApplyStyle}
              previewMountRef={setPreviewMount}
            />
          ) : mode === "injected" ? (
            <InjectedPanel />
          ) : (
            <div className="mx-auto w-full max-w-2xl px-6 pb-6">
              <AnalyticsPanel
                events={analyticsEvents}
                onClear={() => setAnalyticsEvents([])}
              />
            </div>
          )}
        </SidebarInset>
        {/* Flyout create() target — never reparented; Test mode only. */}
        <div ref={flyoutContainerRef} aria-hidden="true" />
      </SidebarProvider>
    </TooltipProvider>
  );
}
