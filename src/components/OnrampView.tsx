import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  AppKitOnrampOperations,
  OnrampSession,
  OnrampWidget,
} from "@circle-fin/app-kit";
import {
  ChainUtils,
  EVMAccountAddress,
  type EVMAccountAddress as EVMAccountAddressType,
  type EVMChainId,
} from "@1shotapi/ows-types";
import { zeroAddress } from "viem";
import { Modal, type ModalAction } from "./Modal";
import { useCircle } from "../circle/CircleContext";
import { circleChainLabelFromChainId } from "../circle/circleChains";
import { isCirclePopupPreferred } from "../circle/circlePopup";
import type { IOnrampOpenRequest } from "../circle/onrampTypes";
import { useStyle } from "../style/StyleProvider";
import { useWallet } from "../wallet/WalletProvider";
import { useWalletSessionStore } from "../wallet/sessionStore";
import { AssetIdentityMark } from "./AssetIdentityMark";
import { CopyableText } from "./CopyableText";
import circleLogoStacked from "../assets/images/platforms/circle-logo-stacked.svg";

export type IOnrampViewProps = IOnrampOpenRequest & {
  onClose: () => void;
};

const PLACEHOLDER_TOKEN_ADDRESS = EVMAccountAddress(zeroAddress);

/**
 * Full-screen Circle AppKit onramp inside the Branding Layer shell.
 * Nested in a Host iframe (or `localStorage.circlePopup === "true"`): popup
 * window (session is prefetched; open must be a sync click — Circle requirement).
 * Top-level Branding with no override: inline iframe.
 */
export function OnrampView({
  destinationAddress,
  chainId: chainIdProp,
  amount,
  tokenSymbol: tokenSymbolProp,
  tokenAddress: tokenAddressProp,
  iconUrl: iconUrlProp,
  onClose,
}: IOnrampViewProps) {
  const circle = useCircle();
  const { style } = useStyle();
  const { resolveChain, knownAssetRepository } = useWallet();
  const sessionChainId = useWalletSessionStore((state) => state.chainId);
  const copy = style.copy.onramp;
  const accountCopy = style.copy.account;

  const usePopup = isCirclePopupPreferred();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<OnrampWidget | null>(null);
  const onrampRef = useRef<AppKitOnrampOperations | null>(null);
  const sessionRef = useRef<OnrampSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [popupReady, setPopupReady] = useState(false);
  const [popupOpened, setPopupOpened] = useState(false);
  const [catalogTokenAddress, setCatalogTokenAddress] = useState<
    EVMAccountAddressType | null
  >(null);
  const [catalogIconUrl, setCatalogIconUrl] = useState<string | undefined>();

  const effectiveEvmChainId = resolveEffectiveEvmChainId(
    chainIdProp,
    sessionChainId,
  );
  const tokenSymbol = (tokenSymbolProp?.trim() || "USDC").toUpperCase();
  const chain = effectiveEvmChainId
    ? resolveChain(effectiveEvmChainId)
    : null;
  const networkLabel = chain?.label ?? "your network";
  const body = copy.body
    .replaceAll("{token}", tokenSymbol)
    .replaceAll("{network}", networkLabel);

  const tokenAddress =
    tokenAddressProp ?? catalogTokenAddress ?? PLACEHOLDER_TOKEN_ADDRESS;
  const iconUrl = iconUrlProp ?? catalogIconUrl;

  useEffect(() => {
    if (tokenAddressProp || !effectiveEvmChainId) {
      setCatalogTokenAddress(null);
      setCatalogIconUrl(undefined);
      return;
    }

    let cancelled = false;
    void knownAssetRepository
      .getOnrampAsset(effectiveEvmChainId, tokenSymbol)
      .then((asset) => {
        if (cancelled) return;
        if (asset) {
          setCatalogTokenAddress(asset.address);
          setCatalogIconUrl(asset.iconUrl);
        } else {
          setCatalogTokenAddress(null);
          setCatalogIconUrl(undefined);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCatalogTokenAddress(null);
          setCatalogIconUrl(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    effectiveEvmChainId,
    knownAssetRepository,
    tokenAddressProp,
    tokenSymbol,
  ]);

  useEffect(() => {
    let cancelled = false;
    const body = buildSessionBody({
      destinationAddress,
      chainId: chainIdProp ?? decimalChainIdFromEvm(effectiveEvmChainId),
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
  }, [
    amount,
    chainIdProp,
    circle,
    destinationAddress,
    effectiveEvmChainId,
    tokenSymbol,
    usePopup,
  ]);

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
            const sessionBody = buildSessionBody({
              destinationAddress,
              chainId: chainIdProp ?? decimalChainIdFromEvm(effectiveEvmChainId),
              amount,
              tokenSymbol,
            });
            sessionRef.current = await onramp.fetchSession({
              url,
              body: sessionBody,
            });
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

  const actions: ModalAction[] = [
    { label: copy.closeLabel, onClick: onClose, variant: "secondary" },
  ];
  if (usePopup && popupReady) {
    actions.push({
      label: popupOpened ? copy.reopenLabel : copy.openLabel,
      onClick: openPopup,
      variant: "primary",
      autoFocus: true,
    });
  }

  const statusMessage = (() => {
    if (error) return null;
    if (loading) {
      return usePopup ? copy.preparingLabel : copy.loadingLabel;
    }
    if (usePopup && popupReady && !popupOpened) {
      return copy.popupReadyBody;
    }
    if (usePopup && popupOpened) {
      return copy.popupOpenedBody;
    }
    return null;
  })();

  return (
    <Modal
      title={
        <span className="inline-flex items-center gap-2.5">
          <img
            src={circleLogoStacked}
            alt=""
            className="h-8 w-auto shrink-0"
            aria-hidden
          />
          <span>{copy.title}</span>
        </span>
      }
      onBackdropDismiss={onClose}
      contentClassName="z-50"
      actions={actions}
    >
      <div className="text-foreground flex min-h-0 flex-1 flex-col gap-5">
        <p className="text-muted-foreground m-0 text-sm leading-relaxed text-pretty">
          {renderOnrampBody(body, tokenSymbol)}
        </p>

        {effectiveEvmChainId ? (
          <div className="flex items-center gap-4">
            <AssetIdentityMark
              chainId={effectiveEvmChainId}
              address={tokenAddress}
              symbol={tokenSymbol}
              iconUrl={iconUrl}
              chainLogoUrl={chain?.logoUrl}
            />
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-xl font-semibold tracking-tight">
                {amount ? `${amount} ` : ""}
                {tokenSymbol}
              </span>
              {chain ? (
                <span className="bg-muted text-muted-foreground w-fit rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide">
                  {chain.label}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {copy.destinationLabel}
          </span>
          <CopyableText
            text={String(destinationAddress)}
            truncate
            copyLabel={accountCopy.copyAddressLabel}
            copiedLabel={accountCopy.addressCopiedLabel}
            copyFailedLabel={accountCopy.addressCopyFailedLabel}
          />
        </div>

        {error ? (
          <p className="text-destructive m-0 text-sm" role="alert">
            {error}
          </p>
        ) : null}
        {statusMessage ? (
          <p className="text-muted-foreground m-0 text-sm">{statusMessage}</p>
        ) : null}

        {!usePopup ? (
          <div
            ref={containerRef}
            className="bg-background min-h-[480px] w-full flex-1"
            aria-label="Circle onramp"
          />
        ) : null}
      </div>
    </Modal>
  );
}

function resolveEffectiveEvmChainId(
  chainIdProp: number | undefined,
  sessionChainId: ReturnType<typeof useWalletSessionStore.getState>["chainId"],
): EVMChainId | null {
  if (chainIdProp != null && Number.isFinite(chainIdProp)) {
    return ChainUtils.asEVMChainId(chainIdProp);
  }
  if (ChainUtils.isEVMChainId(sessionChainId)) {
    return sessionChainId;
  }
  return null;
}

function decimalChainIdFromEvm(chainId: EVMChainId | null): number | undefined {
  if (!chainId) {
    return undefined;
  }
  return Number(BigInt(chainId));
}

/** Keep “{token} 1-to-1” on one line even when hosts customize `copy.onramp.body`. */
function renderOnrampBody(text: string, tokenSymbol: string): ReactNode {
  const oneToOne = "1[\u2011-]to[\u2011-]1";
  const tokenUnit = `${escapeRegExp(tokenSymbol)}\\s+${oneToOne}`;
  const pattern = new RegExp(`(${tokenUnit}|${oneToOne})`, "gi");
  const isNoBreakPart = new RegExp(`^(${tokenUnit}|${oneToOne})$`, "i");
  const parts = text.split(pattern);
  if (parts.length === 1) {
    return text;
  }
  return parts.map((part, index) =>
    isNoBreakPart.test(part) ? (
      <span key={index} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    appUserId: address,
    destinationAddress: address,
    ...(assets ? { assets } : {}),
    ...(request.amount ? { amount: request.amount } : {}),
  };
}
