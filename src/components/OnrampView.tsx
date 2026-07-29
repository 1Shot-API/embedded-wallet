import { useEffect, useRef, useState } from "react";
import type {
  AppKitOnrampOperations,
  OnrampSession,
  OnrampWidget,
} from "@crcl-main/app-kit";
import type { EVMAccountAddress } from "@1shotapi/ows-types";
import { Modal, type ModalAction } from "./Modal";
import { useCircle } from "../circle/CircleContext";
import { circleChainLabelFromChainId } from "../circle/circleChains";
import { isCirclePopupPreferred } from "../circle/circlePopup";
import type { IOnrampOpenRequest } from "../circle/onrampTypes";

export type IOnrampViewProps = IOnrampOpenRequest & {
  onClose: () => void;
};

/**
 * Full-screen Circle AppKit onramp inside the Branding Layer shell.
 * Default: inline iframe. With `localStorage.circlePopup === "true"`: popup
 * window (session is prefetched; open must be a sync click — Circle requirement).
 */
export function OnrampView({
  destinationAddress,
  chainId,
  amount,
  tokenSymbol,
  onClose,
}: IOnrampViewProps) {
  const circle = useCircle();
  const usePopup = isCirclePopupPreferred();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<OnrampWidget | null>(null);
  const onrampRef = useRef<AppKitOnrampOperations | null>(null);
  const sessionRef = useRef<OnrampSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [popupReady, setPopupReady] = useState(false);
  const [popupOpened, setPopupOpened] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const body = buildSessionBody({
      destinationAddress,
      chainId,
      amount,
      tokenSymbol,
    });

    if (usePopup) {
      void (async () => {
        try {
          const [onramp, url] = await Promise.all([
            circle.getOnramp(),
            circle.getSessionUrl(),
          ]);
          if (cancelled) return;
          onrampRef.current = onramp;
          sessionRef.current = await onramp.fetchSession({ url, body });
          if (cancelled) return;
          setLoading(false);
          setPopupReady(true);
          setError(null);
        } catch (err: unknown) {
          if (!cancelled) {
            setLoading(false);
            setPopupReady(false);
            setError(
              err instanceof Error ? err.message : "Failed to prepare onramp",
            );
          }
        }
      })();

      return () => {
        cancelled = true;
        widgetRef.current?.close();
        widgetRef.current = null;
        onrampRef.current = null;
        sessionRef.current = null;
      };
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    void (async () => {
      try {
        const [onramp, url] = await Promise.all([
          circle.getOnramp(),
          circle.getSessionUrl(),
        ]);
        if (cancelled) return;

        const mount = async () => {
          const session = await onramp.fetchSession({ url, body });
          if (cancelled) return;
          widgetRef.current?.close();
          widgetRef.current = onramp.mountIframe({
            session,
            container,
            onSessionExpired: () => {
              void mount().catch((err: unknown) => {
                if (!cancelled) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Failed to refresh onramp session",
                  );
                }
              });
            },
          });
          if (!cancelled) {
            setLoading(false);
            setError(null);
          }
        };

        await mount();
      } catch (err: unknown) {
        if (!cancelled) {
          setLoading(false);
          setError(
            err instanceof Error ? err.message : "Failed to open onramp",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      widgetRef.current?.close();
      widgetRef.current = null;
    };
  }, [amount, chainId, circle, destinationAddress, tokenSymbol, usePopup]);

  const openPopup = () => {
    const onramp = onrampRef.current;
    const session = sessionRef.current;
    if (!onramp || !session) {
      return;
    }

    const result = onramp.openWindow({
      session,
      onSessionExpired: () => {
        setPopupOpened(false);
        setPopupReady(false);
        setLoading(true);
        setError(null);
        void (async () => {
          try {
            const url = await circle.getSessionUrl();
            const body = buildSessionBody({
              destinationAddress,
              chainId,
              amount,
              tokenSymbol,
            });
            sessionRef.current = await onramp.fetchSession({ url, body });
            setLoading(false);
            setPopupReady(true);
          } catch (err: unknown) {
            setLoading(false);
            setError(
              err instanceof Error
                ? err.message
                : "Failed to refresh onramp session",
            );
          }
        })();
      },
    });

    if (result.status === "blocked") {
      setError(result.errorMessage);
      setPopupOpened(false);
      return;
    }

    widgetRef.current?.close();
    widgetRef.current = result.widget;
    setError(null);
    setPopupOpened(true);
  };

  const actions: ModalAction[] = [];
  if (usePopup && popupReady) {
    actions.push({
      label: popupOpened ? "Reopen onramp" : "Open onramp",
      onClick: openPopup,
      variant: "primary",
    });
  }
  actions.push({ label: "Close", onClick: onClose, variant: "secondary" });

  return (
    <Modal
      title="Buy"
      onBackdropDismiss={onClose}
      contentClassName="z-50"
      actions={actions}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {error ? (
          <p className="text-destructive m-0 text-sm" role="alert">
            {error}
          </p>
        ) : null}
        {loading && !error ? (
          <p className="text-muted-foreground m-0 text-sm">
            {usePopup ? "Preparing onramp…" : "Loading onramp…"}
          </p>
        ) : null}
        {usePopup && popupReady && !popupOpened && !error ? (
          <p className="text-muted-foreground m-0 text-sm">
            Circle opens in a popup (local/ngrok CSP bypass). Click Open onramp
            — browsers block popups after an async delay.
          </p>
        ) : null}
        {usePopup && popupOpened && !error ? (
          <p className="text-muted-foreground m-0 text-sm">
            Onramp opened in a popup. Complete the purchase there, then close
            this dialog.
          </p>
        ) : null}
        {!usePopup ? (
          <div
            ref={containerRef}
            className="bg-background min-h-[720px] w-full flex-1"
            aria-label="Circle onramp"
          />
        ) : null}
      </div>
    </Modal>
  );
}

function buildSessionBody(request: {
  destinationAddress: EVMAccountAddress;
  chainId?: number;
  amount?: string;
  tokenSymbol?: string;
}) {
  const address = String(request.destinationAddress).toLowerCase();
  const chains: string[] = [];
  const chainLabel =
    request.chainId != null
      ? circleChainLabelFromChainId(request.chainId)
      : null;
  if (chainLabel) {
    chains.push(chainLabel);
  }

  const tokens =
    request.tokenSymbol && request.tokenSymbol.trim()
      ? [request.tokenSymbol.trim().toUpperCase()]
      : undefined;

  const assets =
    chains.length > 0 || (tokens && tokens.length > 0)
      ? {
          ...(chains.length > 0 ? { chains } : {}),
          ...(tokens && tokens.length > 0 ? { tokens } : {}),
        }
      : undefined;

  return {
    userId: address,
    destinationAddress: address,
    ...(assets ? { assets } : {}),
    ...(request.amount ? { amount: request.amount } : {}),
  };
}
