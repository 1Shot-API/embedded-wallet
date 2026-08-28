import { useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits, erc20Abi } from "viem";
import {
  EVMChainId,
  OwsUserRejectedError,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import type { ICctpBridgeOpenRequest } from "../../circle/cctpBridgeTypes";
import type {
  ICctpBridgeQuote,
  ICctpBridgeResult,
} from "../../lib/interfaces/business/IBridgeService";
import type { IPaymentQuote } from "../../lib/interfaces/business";
import type { ICctpInFlightBurn } from "../../lib/interfaces/data/ICircleRepository";
import type { KnownAsset } from "../../lib/types/domain/KnownAsset";
import type { SupportedChain } from "../../lib/types/domain/SupportedChain";
import { ECctpTransferSpeed } from "../../lib/types/enum/ECctpTransferSpeed";
import { makeTrackedAssetId } from "../../lib/types/primitives";
import { useStyle } from "../../style/StyleProvider";
import { useWallet } from "../../wallet/WalletProvider";
import { Modal } from "../Modal";
import { PaymentFeePicker } from "../PaymentFeePicker";
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

/**
 * Gasless CCTP USDC bridge. Quote → relayer approve/burn → Iris dest mint.
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
  } = useWallet();

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
    ECctpTransferSpeed.Fast,
  );
  const [balance, setBalance] = useState<bigint | null>(
    request.balance ?? null,
  );
  const [irisQuote, setIrisQuote] = useState<ICctpBridgeQuote | null>(null);
  const [paymentQuote, setPaymentQuote] = useState<IPaymentQuote | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [phase, setPhase] = useState<BridgePhase>(
    request.resume ? "polling" : "form",
  );
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

  const onPaymentQuoteChange = useCallback(
    (next: IPaymentQuote | null, quoteError: string | null) => {
      setPaymentQuote(next);
      setPaymentError(quoteError);
    },
    [],
  );

  const requiredUsdc = useMemo(() => {
    if (!irisQuote || !paymentQuote || !sourceUsdc) return null;
    const same =
      String(paymentQuote.selectedToken).toLowerCase() ===
      String(sourceUsdc.address).toLowerCase();
    return same
      ? irisQuote.totalBurn + paymentQuote.feeAtoms
      : irisQuote.totalBurn;
  }, [irisQuote, paymentQuote, sourceUsdc]);

  const insufficient =
    requiredUsdc !== null &&
    balance !== null &&
    balance < requiredUsdc;

  const canQuote =
    Boolean(amount.trim()) &&
    !amountError &&
    Boolean(destChainId) &&
    phase !== "quoting" &&
    phase !== "submitting" &&
    phase !== "polling";

  const canConfirm =
    phase === "quoted" &&
    irisQuote !== null &&
    paymentQuote !== null &&
    !paymentError &&
    !insufficient;

  function clearQuote(): void {
    setIrisQuote(null);
    if (phase === "quoted" || phase === "quoting") {
      setPhase("form");
    }
  }

  async function handleGetQuote(): Promise<void> {
    if (!canQuote || !destChainId) return;
    setError(null);
    setPhase("quoting");
    try {
      const parsed = parseUnits(amount.trim(), decimals);
      const next = await bridgeService.quote({
        sourceChainId: request.sourceChainId,
        destChainId: EVMChainId(destChainId as `0x${string}`),
        amountAtoms: parsed,
        speed,
        owner: request.ownerAddress,
      });
      setIrisQuote(next);
      setPhase("quoted");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : copy.quoteFailedError);
      setPhase("form");
    }
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
      setError(err instanceof Error ? err.message : copy.submitFailedError);
      setPhase("quoted");
    }
  }

  function handleCancel(): void {
    if (burnTxHash) {
      onResolve({
        burnTxHash,
        ...(forwardTxHash ? { forwardTxHash } : {}),
      });
      return;
    }
    onReject(new OwsUserRejectedError("User closed bridge"));
  }

  function handleDone(): void {
    if (!burnTxHash) {
      onReject(new OwsUserRejectedError("User closed bridge"));
      return;
    }
    onResolve({
      burnTxHash,
      ...(forwardTxHash ? { forwardTxHash } : {}),
    });
  }

  const busy =
    phase === "quoting" ||
    phase === "submitting" ||
    phase === "polling";
  const destChain = destChainId
    ? destinations.find(
        (chain) =>
          String(chain.chainId).toLowerCase() === destChainId.toLowerCase(),
      )
    : undefined;

  if (phase === "success" && burnTxHash) {
    const destExplorer = destChain && forwardTxHash
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
      : phase === "quoted"
        ? {
            label: copy.confirmLabel,
            variant: "primary" as const,
            autoFocus: true,
            disabled: !canConfirm,
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
      title={copy.title}
      onBackdropDismiss={busy ? undefined : handleCancel}
      actions={[
        {
          label: copy.cancelLabel,
          variant: "secondary",
          disabled: busy,
          onClick: handleCancel,
        },
        primaryAction,
      ]}
    >
      <p className="text-muted-foreground m-0">{copy.body}</p>
      <div className="mt-4 flex flex-col gap-4">
        <TokenAmountInput
          label={copy.amountLabel}
          placeholder={copy.amountPlaceholder}
          symbol={sourceUsdc?.symbol ?? "USDC"}
          value={amount}
          onChange={(next) => {
            setAmount(next);
            setError(null);
            clearQuote();
          }}
          error={amountError}
          disabled={busy || Boolean(request.resume)}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">
            {copy.destinationLabel}
          </span>
          <Select
            value={destChainId || undefined}
            disabled={busy || destLocked || Boolean(request.resume)}
            onValueChange={(value) => {
              setDestChainId(value);
              setError(null);
              clearQuote();
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={copy.destinationPlaceholder} />
            </SelectTrigger>
            <SelectContent className="z-[10001]">
              {destinations.map((chain) => (
                <SelectItem
                  key={String(chain.chainId)}
                  value={String(chain.chainId)}
                >
                  {chain.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">
            {copy.speedLabel}
          </span>
          <Select
            value={speed}
            disabled={busy || Boolean(request.resume)}
            onValueChange={(value) => {
              setSpeed(value as ECctpTransferSpeed);
              setError(null);
              clearQuote();
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
          <p className="text-muted-foreground m-0 text-xs">{copy.recipientHint}</p>
        </div>
        {irisQuote &&
        (phase === "quoted" ||
          phase === "submitting" ||
          phase === "polling") ? (
          <QuoteBreakdown quote={irisQuote} payment={paymentQuote} copy={copy} />
        ) : null}
        {irisQuote && request.ownerAddress ? (
          <PaymentFeePicker
            chainId={request.sourceChainId}
            ownerAddress={request.ownerAddress}
            quote={paymentQuote}
            error={paymentError}
            loading={false}
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
        {insufficient ? (
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

function QuoteBreakdown({
  quote,
  payment,
  copy,
}: {
  quote: ICctpBridgeQuote;
  payment: IPaymentQuote | null;
  copy: {
    transferAmountLabel: string;
    cctpFeeLabel: string;
    relayerFeeLabel: string;
    netReceivedLabel: string;
  };
}) {
  const decimals = quote.sourceUsdc.decimals;
  return (
    <dl className="bg-muted/50 flex flex-col gap-1.5 rounded-md p-3 text-sm">
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
        <dd>{formatUnits(quote.netReceivedAtoms, decimals)} USDC</dd>
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
