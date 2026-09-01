import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatUnits, parseUnits, erc20Abi } from "viem";
import {
  DomainString,
  EVMChainId,
  OwsUserRejectedError,
  type EVMChainId as EVMChainIdType,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import {
  isCctpBridgeParamsComplete,
  type ICctpBridgeOpenRequest,
} from "../../circle/cctpBridgeTypes";
import type {
  ICctpBridgeQuote,
  ICctpBridgeResult,
} from "../../lib/interfaces/business/IBridgeService";
import type { IPaymentQuote } from "../../lib/interfaces/business";
import type { ICctpInFlightBurn } from "../../lib/interfaces/data/ICircleRepository";
import type { KnownAsset } from "../../lib/types/domain/KnownAsset";
import type { SupportedChain } from "../../lib/types/domain/SupportedChain";
import { ECctpTransferSpeed } from "../../lib/types/enum/ECctpTransferSpeed";
import {
  BridgeCancelledEvent,
  BridgeCompletedEvent,
  BridgeFailedEvent,
  BridgeOpenedEvent,
} from "../../lib/types/events/productEvents";
import { makeTrackedAssetId } from "../../lib/types/primitives";
import {
  usdcAmountFromAtoms,
  usdcAmountFromTokenAmount,
  usdcAmountToAtoms,
} from "../../lib/types/primitives/USDCAmount";
import { analyticsErrorCode } from "../../lib/implementations/utils";
import { useStyle } from "../../style/StyleProvider";
import type { IStyleCopyCctpBridge } from "../../style/types";
import { useWallet } from "../../wallet/WalletProvider";
import { Modal } from "../Modal";
import { ChainSelector } from "../ChainSelector";
import { PaymentFeePicker } from "../PaymentFeePicker";
import { QuoteCountdown } from "../QuoteCountdown";
import { TokenAmountInput } from "../TokenAmountInput";
import { CopyableText } from "../CopyableText";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export interface ICCTPBridgeProps {
  request: ICctpBridgeOpenRequest;
  onResolve: (result: ICctpBridgeResult) => void;
  onReject: (error: unknown) => void;
}

type BridgePhase =
  | "form"
  | "quoting"
  | "quoted"
  | "submitting"
  | "polling"
  | "success"
  | "timeout";

function amountValidationError(
  raw: string,
  decimals: number,
  copy: { invalidAmountError: string },
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = parseUnits(trimmed, decimals);
    if (parsed <= 0n) {
      return copy.invalidAmountError;
    }
  } catch {
    return copy.invalidAmountError;
  }
  return null;
}

function initialPhase(request: ICctpBridgeOpenRequest): BridgePhase {
  if (request.resume) return "polling";
  if (isCctpBridgeParamsComplete(request)) return "quoting";
  return "form";
}

/**
 * Gasless CCTP USDC bridge. Setup → quote → confirm → relayer burn → Iris mint.
 */
export function CCTPBridge({
  request,
  onResolve,
  onReject,
}: ICCTPBridgeProps) {
  const { style } = useStyle();
  const copy = style.copy.cctpBridge;
  const {
    bridgeService,
    knownAssetRepository,
    blockchainProvider,
    resolveChain,
    requestBalanceRefresh,
    switchChain,
    eventBus,
    configProvider,
  } = useWallet();

  const hostInitiated = Boolean(request.hostInitiated);
  const openedAtRef = useRef(Date.now());
  const settledRef = useRef(false);
  const autoQuoteStartedRef = useRef(false);
  /** Stable promise so settle/open analytics can await hostDomain even if settle races the first getConfig. */
  const [hostDomainPromise] = useState(() =>
    configProvider.getConfig().then(({ hostDomain }) => hostDomain),
  );

  const [sourceUsdc, setSourceUsdc] = useState<KnownAsset | null>(null);
  const [destinations, setDestinations] = useState<SupportedChain[]>([]);
  const [amount, setAmount] = useState(() =>
    request.amountAtoms !== undefined && request.amountAtoms > 0n
      ? formatUnits(request.amountAtoms, 6)
      : "",
  );
  const [destChainId, setDestChainId] = useState<string>(
    request.destinationChainId ? String(request.destinationChainId) : "",
  );
  const [speed, setSpeed] = useState<ECctpTransferSpeed>(
    request.speed ?? ECctpTransferSpeed.Fast,
  );
  const [balance, setBalance] = useState<bigint | null>(
    request.balance ?? null,
  );
  const [irisQuote, setIrisQuote] = useState<ICctpBridgeQuote | null>(null);
  const [paymentQuote, setPaymentQuote] = useState<IPaymentQuote | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [phase, setPhase] = useState<BridgePhase>(() => initialPhase(request));
  const [error, setError] = useState<string | null>(null);
  const [burnTxHash, setBurnTxHash] = useState<EVMTransactionHash | null>(
    request.resume?.burnTxHash ?? null,
  );
  const [forwardTxHash, setForwardTxHash] = useState<EVMTransactionHash | null>(
    null,
  );
  const [inFlight, setInFlight] = useState<ICctpInFlightBurn | null>(
    request.resume ?? null,
  );

  const sourceChain = resolveChain(request.sourceChainId);
  const destLocked = Boolean(request.destinationChainId);
  const decimals = sourceUsdc?.decimals ?? 6;
  const amountError = useMemo(
    () => amountValidationError(amount, decimals, copy),
    [amount, decimals, copy],
  );

  const resolvedDestChainId = useMemo((): EVMChainIdType | null => {
    if (!destChainId) return null;
    try {
      return EVMChainId(destChainId as `0x${string}`);
    } catch {
      return null;
    }
  }, [destChainId]);

  const durationMs = () => Date.now() - openedAtRef.current;

  function emitOpened(hostDomain: DomainString): void {
    eventBus.emitAnalytics(
      new BridgeOpenedEvent(
        hostDomain,
        request.ownerAddress,
        request.sourceChainId,
        request.destinationChainId ?? null,
      ),
    );
  }

  function emitCancelled(hostDomain: DomainString): void {
    eventBus.emitAnalytics(
      new BridgeCancelledEvent(
        hostDomain,
        request.ownerAddress,
        request.sourceChainId,
        durationMs(),
        resolvedDestChainId,
      ),
    );
  }

  function emitFailed(hostDomain: DomainString, err: unknown): void {
    eventBus.emitAnalytics(
      new BridgeFailedEvent(
        hostDomain,
        request.ownerAddress,
        request.sourceChainId,
        analyticsErrorCode(err),
        durationMs(),
        resolvedDestChainId,
      ),
    );
  }

  function emitCompleted(
    hostDomain: DomainString,
    hash: EVMTransactionHash,
  ): void {
    eventBus.emitAnalytics(
      new BridgeCompletedEvent(
        hostDomain,
        request.ownerAddress,
        request.sourceChainId,
        resolvedDestChainId,
        hash,
        durationMs(),
      ),
    );
  }

  async function settleResolve(result: ICctpBridgeResult): Promise<void> {
    if (settledRef.current) return;
    settledRef.current = true;
    try {
      const hostDomain = await hostDomainPromise;
      emitCompleted(hostDomain, result.burnTxHash);
    } catch {
      // Analytics is best-effort; still settle the modal.
    }
    onResolve(result);
  }

  async function settleReject(error: unknown): Promise<void> {
    if (settledRef.current) return;
    settledRef.current = true;
    try {
      const hostDomain = await hostDomainPromise;
      if (error instanceof OwsUserRejectedError) {
        emitCancelled(hostDomain);
      } else {
        emitFailed(hostDomain, error);
      }
    } catch {
      // Analytics is best-effort; still settle the modal.
    }
    onReject(error);
  }

  useEffect(() => {
    let cancelled = false;
    void hostDomainPromise.then((hostDomain) => {
      if (cancelled) return;
      emitOpened(hostDomain);
    });
    return () => {
      cancelled = true;
    };
    // Fire BridgeOpened once when hostDomain is ready for this open request.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open analytics once
  }, [hostDomainPromise]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [asset, dests] = await Promise.all([
        knownAssetRepository.getCctpBridgeAsset(request.sourceChainId),
        bridgeService.listDestinations(request.sourceChainId),
      ]);
      if (cancelled) return;
      setSourceUsdc(asset);
      setDestinations(dests);
      if (asset && request.balance === undefined) {
        try {
          const client = blockchainProvider.getPublicClient(
            request.sourceChainId,
          );
          const live = await client.readContract({
            address: asset.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [request.ownerAddress],
          });
          if (!cancelled) setBalance(live);
        } catch {
          if (!cancelled) setBalance(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    blockchainProvider,
    bridgeService,
    knownAssetRepository,
    request.balance,
    request.ownerAddress,
    request.sourceChainId,
  ]);

  useEffect(() => {
    if (!request.resume) return;
    let cancelled = false;
    setPhase("polling");
    void bridgeService
      .pollUntilForwarded(request.resume, (progress) => {
        if (cancelled) return;
        setBurnTxHash(progress.burnTxHash);
        if (progress.forwardTxHash) {
          setForwardTxHash(progress.forwardTxHash);
        }
      })
      .then((hash) => {
        if (cancelled) return;
        setForwardTxHash(hash);
        setPhase("success");
        void requestBalanceRefresh();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : copy.timeoutError);
        setPhase("timeout");
      });
    return () => {
      cancelled = true;
    };
  }, [bridgeService, copy.timeoutError, request, requestBalanceRefresh]);

  const fetchQuote = useCallback(
    async (opts: {
      amountRaw: string;
      dest: string;
      transferSpeed: ECctpTransferSpeed;
      /** When true, stay on confirm (auto-refresh); otherwise setup Get Quote flow. */
      silent?: boolean;
    }) => {
      if (!opts.silent) {
        setError(null);
        setPhase("quoting");
      }
      try {
        const parsed = parseUnits(opts.amountRaw.trim(), decimals);
        const next = await bridgeService.quote({
          sourceChainId: request.sourceChainId,
          destChainId: EVMChainId(opts.dest as `0x${string}`),
          amountAtoms: parsed,
          speed: opts.transferSpeed,
          owner: request.ownerAddress,
        });
        setIrisQuote(next);
        if (!opts.silent) {
          setPhase("quoted");
        }
        return next;
      } catch (err: unknown) {
        if (opts.silent) {
          throw err;
        }
        setError(err instanceof Error ? err.message : copy.quoteFailedError);
        setPhase("form");
        return null;
      }
    },
    [
      bridgeService,
      copy.quoteFailedError,
      decimals,
      request.ownerAddress,
      request.sourceChainId,
    ],
  );

  const refreshIrisQuote = useCallback(async (): Promise<string> => {
    if (!destChainId) {
      throw new Error(copy.noDestinationError);
    }
    const next = await fetchQuote({
      amountRaw: amount,
      dest: destChainId,
      transferSpeed: speed,
      silent: true,
    });
    if (!next) {
      throw new Error(copy.quoteFailedError);
    }
    return `${formatUnits(next.netReceivedAtoms, next.sourceUsdc.decimals)} USDC`;
  }, [
    amount,
    copy.noDestinationError,
    copy.quoteFailedError,
    destChainId,
    fetchQuote,
    speed,
  ]);

  useEffect(() => {
    if (request.resume) return;
    if (!isCctpBridgeParamsComplete(request)) return;
    if (autoQuoteStartedRef.current) return;
    if (!sourceUsdc) return;
    autoQuoteStartedRef.current = true;
    void fetchQuote({
      amountRaw: formatUnits(request.amountAtoms!, decimals),
      dest: String(request.destinationChainId!),
      transferSpeed: request.speed!,
    });
  }, [decimals, fetchQuote, request, sourceUsdc]);

  const onPaymentQuoteChange = useCallback(
    (next: IPaymentQuote | null, quoteError: string | null) => {
      setPaymentQuote(next);
      setPaymentError(quoteError);
    },
    [],
  );

  const requiredUsdc = useMemo(() => {
    if (!irisQuote || !paymentQuote || !sourceUsdc) return null;
    const burn = usdcAmountFromAtoms(irisQuote.totalBurn);
    const same =
      String(paymentQuote.selectedToken).toLowerCase() ===
      String(sourceUsdc.address).toLowerCase();
    if (!same) {
      return burn;
    }
    const fee = usdcAmountFromTokenAmount(
      paymentQuote.feeAtoms,
      sourceUsdc.decimals,
    );
    return usdcAmountFromAtoms(usdcAmountToAtoms(burn) + usdcAmountToAtoms(fee));
  }, [irisQuote, paymentQuote, sourceUsdc]);

  const insufficient =
    requiredUsdc !== null &&
    balance !== null &&
    balance < usdcAmountToAtoms(requiredUsdc);

  const isSetupScreen = phase === "form" || phase === "quoting";
  const isConfirmScreen =
    phase === "quoted" ||
    phase === "submitting" ||
    phase === "polling" ||
    phase === "timeout";

  const canQuote =
    Boolean(amount.trim()) &&
    !amountError &&
    Boolean(destChainId) &&
    phase === "form";

  const canConfirm =
    phase === "quoted" &&
    irisQuote !== null &&
    paymentQuote !== null &&
    !paymentError &&
    !insufficient;

  function clearQuoteToSetup(): void {
    setIrisQuote(null);
    setPaymentQuote(null);
    setPaymentError(null);
    setPhase("form");
  }

  async function handleGetQuote(): Promise<void> {
    if (!canQuote || !destChainId) return;
    await fetchQuote({
      amountRaw: amount,
      dest: destChainId,
      transferSpeed: speed,
    });
  }

  async function pollInFlight(record: ICctpInFlightBurn): Promise<void> {
    setPhase("polling");
    setError(null);
    try {
      const hash = await bridgeService.pollUntilForwarded(record, (progress) => {
        setBurnTxHash(progress.burnTxHash);
        if (progress.forwardTxHash) {
          setForwardTxHash(progress.forwardTxHash);
        }
      });
      setForwardTxHash(hash);
      setPhase("success");
      if (sourceUsdc) {
        void requestBalanceRefresh(
          makeTrackedAssetId(request.sourceChainId, sourceUsdc.address),
        );
      } else {
        void requestBalanceRefresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : copy.timeoutError);
      setPhase("timeout");
    }
  }

  async function handleConfirm(): Promise<void> {
    if (!canConfirm || !irisQuote || !paymentQuote) return;
    setError(null);
    setPhase("submitting");
    try {
      await switchChain(request.sourceChainId);
      const result = await bridgeService.execute(
        irisQuote,
        {
          paymentToken: paymentQuote.selectedToken,
          feeAtoms: paymentQuote.feeAtoms,
        },
        (progress) => {
          setBurnTxHash(progress.burnTxHash);
          setPhase("polling");
          if (progress.forwardTxHash) {
            setForwardTxHash(progress.forwardTxHash);
          }
        },
      );
      setBurnTxHash(result.burnTxHash);
      if (result.forwardTxHash) {
        setForwardTxHash(result.forwardTxHash);
        setPhase("success");
        if (sourceUsdc) {
          void requestBalanceRefresh(
            makeTrackedAssetId(request.sourceChainId, sourceUsdc.address),
          );
        } else {
          void requestBalanceRefresh();
        }
        return;
      }
      const stored = await bridgeService.resume(request.ownerAddress);
      setInFlight(stored);
      if (stored) {
        await pollInFlight(stored);
      } else {
        setPhase("timeout");
        setError(copy.timeoutError);
      }
    } catch (err: unknown) {
      const stored = await bridgeService.resume(request.ownerAddress);
      if (stored) {
        setInFlight(stored);
        setBurnTxHash(stored.burnTxHash);
        setError(err instanceof Error ? err.message : copy.timeoutError);
        setPhase("timeout");
        return;
      }
      // Keep confirm open so the user can retry or cancel; do not settle the
      // host promise until success or explicit cancel.
      const failure =
        err instanceof Error ? err : new Error(copy.submitFailedError);
      setError(failure.message);
      setPhase("quoted");
      void hostDomainPromise
        .then((hostDomain) => {
          emitFailed(hostDomain, failure);
        })
        .catch(() => {
          // Analytics is best-effort.
        });
    }
  }

  function handleCancel(): void {
    if (burnTxHash) {
      void settleResolve({
        burnTxHash,
        ...(forwardTxHash ? { forwardTxHash } : {}),
      });
      return;
    }
    void settleReject(new OwsUserRejectedError("User closed bridge"));
  }

  const busy =
    phase === "quoting" || phase === "submitting" || phase === "polling";

  function handleBack(): void {
    if (hostInitiated || busy) return;
    setError(null);
    clearQuoteToSetup();
  }

  function handleDone(): void {
    if (!burnTxHash) {
      void settleReject(new OwsUserRejectedError("User closed bridge"));
      return;
    }
    void settleResolve({
      burnTxHash,
      ...(forwardTxHash ? { forwardTxHash } : {}),
    });
  }
  const destChain = destChainId
    ? destinations.find(
        (chain) =>
          String(chain.chainId).toLowerCase() === destChainId.toLowerCase(),
      )
    : undefined;

  if (phase === "success" && burnTxHash) {
    const destExplorer =
      destChain && forwardTxHash
        ? destChain.txExplorerUrl(forwardTxHash)
        : undefined;
    const sourceExplorer = sourceChain?.txExplorerUrl(burnTxHash);
    return (
      <Modal
        title={copy.successTitle}
        onBackdropDismiss={handleDone}
        actions={[
          {
            label: copy.doneLabel,
            variant: "primary",
            autoFocus: true,
            onClick: handleDone,
          },
        ]}
      >
        <p className="text-muted-foreground m-0">{copy.successBody}</p>
        <div className="mt-4 flex flex-col gap-3">
          <HashRow
            label={copy.sourceHashLabel}
            hash={burnTxHash}
            explorerUrl={sourceExplorer}
            viewLabel={copy.viewOnExplorerLabel}
          />
          {forwardTxHash ? (
            <HashRow
              label={copy.destHashLabel}
              hash={forwardTxHash}
              explorerUrl={destExplorer}
              viewLabel={copy.viewOnExplorerLabel}
            />
          ) : null}
        </div>
      </Modal>
    );
  }

  const secondaryAction =
    isConfirmScreen && !hostInitiated && phase === "quoted"
      ? {
          label: copy.backLabel,
          variant: "secondary" as const,
          disabled: busy,
          onClick: handleBack,
        }
      : {
          label: copy.cancelLabel,
          variant: "secondary" as const,
          disabled: busy,
          onClick: handleCancel,
        };

  const primaryAction =
    phase === "timeout"
      ? {
          label: copy.retryLabel,
          variant: "primary" as const,
          disabled: !inFlight && !request.resume,
          onClick: () => {
            const record = inFlight ?? request.resume;
            if (record) void pollInFlight(record);
          },
        }
      : isConfirmScreen
        ? {
            label:
              phase === "submitting"
                ? copy.submittingLabel
                : phase === "polling"
                  ? copy.pollingLabel
                  : copy.confirmLabel,
            variant: "primary" as const,
            autoFocus: true,
            disabled: phase !== "quoted" || !canConfirm,
            onClick: () => void handleConfirm(),
          }
        : {
            label: phase === "quoting" ? copy.quotingLabel : copy.getQuoteLabel,
            variant: "primary" as const,
            autoFocus: true,
            disabled: !canQuote || busy,
            onClick: () => void handleGetQuote(),
          };

  return (
    <Modal
      title={isConfirmScreen ? copy.confirmTitle : copy.title}
      onBackdropDismiss={busy ? undefined : handleCancel}
      actions={[secondaryAction, primaryAction]}
    >
      <p className="text-muted-foreground m-0">
        {isConfirmScreen ? copy.confirmBody : copy.body}
      </p>
      <div className="mt-4 flex flex-col gap-4">
        {isSetupScreen ? (
          <>
            <TokenAmountInput
              label={copy.amountLabel}
              placeholder={copy.amountPlaceholder}
              symbol={sourceUsdc?.symbol ?? "USDC"}
              value={amount}
              onChange={(next) => {
                setAmount(next);
                setError(null);
              }}
              error={amountError}
              disabled={busy}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs font-medium">
                {copy.destinationLabel}
              </span>
              <ChainSelector
                ariaLabel={copy.destinationLabel}
                value={destChainId}
                chains={destinations}
                disabled={busy || destLocked}
                placeholder={copy.destinationPlaceholder}
                contentClassName="z-[10001]"
                onValueChange={(value) => {
                  setDestChainId(value);
                  setError(null);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs font-medium">
                {copy.speedLabel}
              </span>
              <Select
                value={speed}
                disabled={busy}
                onValueChange={(value) => {
                  setSpeed(value as ECctpTransferSpeed);
                  setError(null);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[10001]">
                  <SelectItem value={ECctpTransferSpeed.Fast}>
                    {copy.speedFastLabel}
                  </SelectItem>
                  <SelectItem value={ECctpTransferSpeed.Slow}>
                    {copy.speedSlowLabel}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs font-medium">
                {copy.recipientLabel}
              </span>
              <CopyableText text={String(request.ownerAddress)} truncate />
              <p className="text-muted-foreground m-0 text-xs">
                {copy.recipientHint}
              </p>
            </div>
          </>
        ) : null}

        {isConfirmScreen && irisQuote ? (
          <ConfirmSummary
            quote={irisQuote}
            payment={paymentQuote}
            sourceLabel={sourceChain?.label ?? String(request.sourceChainId)}
            destLabel={destChain?.label ?? destChainId}
            speedLabel={
              speed === ECctpTransferSpeed.Fast
                ? copy.speedFastLabel
                : copy.speedSlowLabel
            }
            copy={copy}
            getIrisQuote={refreshIrisQuote}
            paused={
              phase === "submitting" ||
              phase === "polling" ||
              phase === "timeout"
            }
          />
        ) : null}

        {isConfirmScreen && irisQuote && request.ownerAddress ? (
          <PaymentFeePicker
            chainId={request.sourceChainId}
            ownerAddress={request.ownerAddress}
            quote={paymentQuote}
            error={paymentError}
            loading={false}
            paused={
              phase === "submitting" ||
              phase === "polling" ||
              phase === "timeout"
            }
            onQuoteChange={onPaymentQuoteChange}
          />
        ) : null}

        {phase === "submitting" ? (
          <p className="text-muted-foreground text-sm">{copy.submittingLabel}</p>
        ) : null}
        {phase === "polling" ? (
          <p className="text-muted-foreground text-sm">{copy.pollingLabel}</p>
        ) : null}
        {burnTxHash && (phase === "polling" || phase === "timeout") ? (
          <HashRow
            label={copy.sourceHashLabel}
            hash={burnTxHash}
            explorerUrl={sourceChain?.txExplorerUrl(burnTxHash)}
            viewLabel={copy.viewOnExplorerLabel}
          />
        ) : null}
        {insufficient && isConfirmScreen ? (
          <p className="text-destructive text-xs" role="alert">
            {copy.insufficientBalanceError}
          </p>
        ) : null}
        {error ? (
          <p className="text-destructive text-xs" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

function ConfirmSummary({
  quote,
  payment,
  sourceLabel,
  destLabel,
  speedLabel,
  copy,
  getIrisQuote,
  paused,
}: {
  quote: ICctpBridgeQuote;
  payment: IPaymentQuote | null;
  sourceLabel: string;
  destLabel: string;
  speedLabel: string;
  copy: IStyleCopyCctpBridge;
  getIrisQuote: () => Promise<string>;
  paused: boolean;
}) {
  const decimals = quote.sourceUsdc.decimals;
  return (
    <dl className="bg-muted/50 flex flex-col gap-1.5 rounded-md p-3 text-sm">
      <div className="flex justify-between gap-3">
        <dt className="text-muted-foreground">{copy.sourceChainLabel}</dt>
        <dd>{sourceLabel}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted-foreground">{copy.destinationLabel}</dt>
        <dd>{destLabel}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted-foreground">{copy.speedLabel}</dt>
        <dd>{speedLabel}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted-foreground">{copy.transferAmountLabel}</dt>
        <dd>{formatUnits(quote.amountAtoms, decimals)} USDC</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted-foreground">{copy.cctpFeeLabel}</dt>
        <dd>{formatUnits(quote.maxFee, decimals)} USDC</dd>
      </div>
      {payment ? (
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{copy.relayerFeeLabel}</dt>
          <dd>
            {payment.feeFormatted}{" "}
            {payment.tokens.find(
              (token) =>
                String(token.address).toLowerCase() ===
                String(payment.selectedToken).toLowerCase(),
            )?.symbol ?? "USDC"}
          </dd>
        </div>
      ) : null}
      <div className="flex justify-between gap-3 font-medium">
        <dt>{copy.netReceivedLabel}</dt>
        <dd>
          <QuoteCountdown getNewQuote={getIrisQuote} paused={paused} />
        </dd>
      </div>
    </dl>
  );
}

function HashRow({
  label,
  hash,
  explorerUrl,
  viewLabel,
}: {
  label: string;
  hash: string;
  explorerUrl?: string;
  viewLabel: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      <CopyableText text={hash} truncate />
      {explorerUrl ? (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary text-xs underline underline-offset-2"
        >
          {viewLabel}
        </a>
      ) : null}
    </div>
  );
}
