import { useEffect, useRef, type RefObject } from "react";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import { useModalStore } from "./modalStore";
import { useWalletSessionStore } from "./sessionStore";

/** Matches default host flyout max height (`DEFAULT_WALLET_SIZE_Y`). */
const MAX_PANEL_HEIGHT_PX = 600;
const RESIZE_DEBOUNCE_MS = 50;
export const WALLET_SHELL_ID = "wallet-shell";

function measureShellHeight(element: HTMLElement): number {
  return element.scrollHeight;
}

/**
 * Report branding shell height to the host flyout while embedded.
 * Modals expand to the configured max panel height; shell views shrink to fit.
 */
export function useWalletFrameResize(
  walletRef: RefObject<OWSWallet | null>,
): void {
  const embedded = useWalletSessionStore((state) => state.embedded);
  const ready = useWalletSessionStore((state) => state.ready);
  const activeModal = useModalStore((state) => state.activeModal);
  const lastHeightRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!embedded || !ready) {
      return;
    }

    const wallet = walletRef.current;
    const shell = document.getElementById(WALLET_SHELL_ID);
    if (!wallet || !shell) {
      return;
    }

    const emitResize = (height: number) => {
      if (lastHeightRef.current === height) {
        return;
      }
      lastHeightRef.current = height;
      wallet.requestResize({ height });
    };

    const scheduleResize = (height: number) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        emitResize(height);
      }, RESIZE_DEBOUNCE_MS);
    };

    const applyResize = () => {
      if (activeModal) {
        scheduleResize(MAX_PANEL_HEIGHT_PX);
        return;
      }
      scheduleResize(measureShellHeight(shell));
    };

    applyResize();

    const observer = new ResizeObserver(() => {
      applyResize();
    });
    observer.observe(shell);

    const handleFocus = () => {
      lastHeightRef.current = null;
      applyResize();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      observer.disconnect();
      window.removeEventListener("focus", handleFocus);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [activeModal, embedded, ready, walletRef]);
}
