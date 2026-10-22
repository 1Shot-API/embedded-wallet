import {
  ChainUtils,
  EVMAccountAddress,
  OwsUserRejectedError,
  type EVMChainId,
  type SolanaAccountAddress,
  type TransactionHash,
} from "@1shotapi/ows-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatUnits, getAddress, parseUnits } from "viem";
import { useShallow } from "zustand/react/shallow";

import {
  isSolanaBridgeParamsComplete,
  type ISolanaBridgeOpenRequest,
} from "../../circle/solanaBridgeTypes";
import type {
  ICctpBridgeResult,
  ICctpPollProgress,
} from "../../lib/interfaces/business/IBridgeService";
import type { ISolanaCctpBridgeQuote } from "../../lib/interfaces/business/ISolanaBridgeService";
import type { ICctpInFlightBurn } from "../../lib/interfaces/data/ICircleRepository";
import type { SupportedChain } from "../../lib/types/domain/SupportedChain";
import { ECctpTransferSpeed } from "../../lib/types/enum/ECctpTransferSpeed";
import { useStyle } from "../../style/StyleProvider";
import type { IStyleCopySolanaBridge } from "../../style/types";
import { useWalletSessionStore } from "../../wallet/sessionStore";
import { useWallet } from "../../wallet/WalletProvider";
import { ChainSelector } from "../ChainSelector";
import { CopyableText } from "../CopyableText";
import { Modal } from "../Modal";
import { QuoteCountdown } from "../QuoteCountdown";
import { TokenAmountInput } from "../TokenAmountInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export interface ISolanaBridgeProps {
  request: ISolanaBridgeOpenRequest;
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

function parseEvmRecipient(
  raw: string,
  invalidError: string,
): EVMAccountAddress {
  try {
    return EVMAccountAddress(getAddress(raw.trim()) as `0x${string}`);
  } catch {
    throw new Error(invalidError);
  }
}

function initialPhase(request: ISolanaBridgeOpenRequest): BridgePhase {
  if (request.resume) return "polling";
  if (isSolanaBridgeParamsComplete(request)) return "quoting";
  return "form";
}

/**
 * Solana → EVM CCTP USDC bridge. Burn via Alchemy/Kit (user pays SOL);
 * Circle Forwarding mints on the destination — no EIP-7710 relayer fee UI.
 */
export function SolanaBridge({
  request,
  onResolve,
  onReject,
}: ISolanaBridgeProps) {
  const { style } = useStyle();
  const copy = style.copy.solanaBridge;
  const { solanaBridgeService, resolveChain, listTrackedAssets } = useWallet();

  const sessionEvm = useWalletSessionStore(
    useShallow((state) => state.evmAddress),
  );

  const [phase, setPhase] = useState<BridgePhase>(() => initialPhase(request));
  const [amount, setAmount] = useState(() =>
    request.amountAtoms !== undefined
      ? formatUnits(request.amountAtoms, 6)
      : "",
  );
  const [destChainId, setDestChainId] = useState(
    request.destinationChainId ? String(request.destinationChainId) : "",
  );
  const [speed, setSpeed] = useState<ECctpTransferSpeed>(
    request.speed ?? ECctpTransferSpeed.Fast,
  );
  const [destinations, setDestinations] = useState<SupportedChain[]>([]);
  const [balance, setBalance] = useState<bigint | null>(
    request.balance ?? null,
  );
  const [irisQuote, setIrisQuote] = useState<ISolanaCctpBridgeQuote | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [burnTxHash, setBurnTxHash] = useState<TransactionHash | null>(
    request.resume?.burnTxHash ?? null,
  );
  const [forwardTxHash, setForwardTxHash] = useState<TransactionHash | null>(
    null,
  );
  const [inFlight, setInFlight] = useState<ICctpInFlightBurn | null>(
    request.resume ?? null,
  );
  const [evmRecipient, setEvmRecipient] = useState(() =>
    request.evmRecipient
      ? String(request.evmRecipient)
      : sessionEvm && String(sessionEvm).toLowerCase() !== "0x0"
        ? String(sessionEvm)
        : "",
  );

  const settledRef = useRef(false);
  const autoQuoteStartedRef = useRef(false);

  const sourceChain = resolveChain(request.sourceChainId);
  const destLocked = Boolean(request.destinationChainId);
  const decimals = 6;
  const amountError = useMemo(
    () => amountValidationError(amount, decimals, copy),
    [amount, copy],
  );

  const resolvedDestChainId = useMemo((): EVMChainId | null => {
    if (!destChainId.trim()) return null;
    try {
      return ChainUtils.asEVMChainId(destChainId);
    } catch {
      return null;
    }
  }, [destChainId]);

  const destChain = resolvedDestChainId
    ? resolveChain(resolvedDestChainId)
    : null;

  async function settleResolve(result: ICctpBridgeResult): Promise<void> {
    if (settledRef.current) return;
    settledRef.current = true;
    onResolve(result);
  }

  async function settleReject(error: unknown): Promise<void> {
    if (settledRef.current) return;
    settledRef.current = true;
    onReject(error);
  }

  function handleCancel(): void {
    void settleReject(new OwsUserRejectedError("User closed bridge"));
  }

  useEffect(() => {
    let cancelled = false;
    void solanaBridgeService
      .listDestinations(request.sourceChainId)
      .then((chains) => {
        if (!cancelled) setDestinations(chains);
      })
      .catch(() => {
        if (!cancelled) setDestinations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [request.sourceChainId, solanaBridgeService]);

  useEffect(() => {
    if (request.balance !== undefined && request.balance !== null) {
      setBalance(request.balance);
      return;
    }
    let cancelled = false;
    void listTrackedAssets().then((assets) => {
      if (cancelled) return;
      const match = assets.find(
        (a) =>
          a.chainId === request.sourceChainId &&
          String(a.address).toLowerCase() ===
            String(request.mint).toLowerCase(),
      );
      setBalance(match?.balance ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [
    listTrackedAssets,
    request.balance,
    request.mint,
    request.sourceChainId,
  ]);

  useEffect(() => {
    if (!request.resume) return;
    let cancelled = false;
    setPhase("polling");
    void solanaBridgeService
      .pollUntilForwarded(request.resume, (progress: ICctpPollProgress) => {
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
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : copy.timeoutError);
        setPhase("timeout");
      });
    return () => {
      cancelled = true;
    };
  }, [copy.timeoutError, request.resume, solanaBridgeService]);

  const fetchQuote = useCallback(
    async (opts: {
      amountRaw: string;
      dest: string;
      transferSpeed: ECctpTransferSpeed;
      silent?: boolean;
    }) => {
      if (!opts.silent) {
        setError(null);
        setPhase("quoting");
      }
      try {
        const parsed = parseUnits(opts.amountRaw.trim(), decimals);
        const destId = ChainUtils.asEVMChainId(opts.dest);
        const recipient = parseEvmRecipient(
          evmRecipient,
          copy.invalidEvmRecipientError,
        );
        const next = await solanaBridgeService.quote({
          sourceChainId: request.sourceChainId,
          destChainId: destId,
          amountAtoms: parsed,
          speed: opts.transferSpeed,
          owner: request.ownerAddress,
          mintRecipient: recipient,
          mint: request.mint,
          burnAta: request.burnAta,
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
      copy.invalidEvmRecipientError,
      copy.quoteFailedError,
      decimals,
      evmRecipient,
      request.burnAta,
      request.mint,
      request.ownerAddress,
      request.sourceChainId,
      solanaBridgeService,
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
    if (!isSolanaBridgeParamsComplete(request)) return;
    if (autoQuoteStartedRef.current) return;
    autoQuoteStartedRef.current = true;
    void fetchQuote({
      amountRaw: formatUnits(request.amountAtoms!, decimals),
      dest: String(request.destinationChainId!),
      transferSpeed: request.speed!,
    });
  }, [decimals, fetchQuote, request]);

  const insufficient =
    irisQuote !== null &&
    balance !== null &&
    balance < irisQuote.totalBurn;

  const isSetupScreen = phase === "form" || phase === "quoting";
  const isConfirmScreen =
    phase === "quoted" ||
    phase === "submitting" ||
    phase === "polling" ||
    phase === "timeout";

  const canQuote =
    Boolean(amount.trim()) &&
    !amountError &&
    Boolean(destChainId.trim()) &&
    Boolean(evmRecipient.trim()) &&
    phase === "form";

  const canConfirm =
    phase === "quoted" && irisQuote !== null && !insufficient;

  const busy =
    phase === "quoting" || phase === "submitting" || phase === "polling";

  function clearQuoteToSetup(): void {
    setIrisQuote(null);
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
      const hash = await solanaBridgeService.pollUntilForwarded(
        record,
        (progress) => {
          setBurnTxHash(progress.burnTxHash);
          if (progress.forwardTxHash) {
            setForwardTxHash(progress.forwardTxHash);
          }
        },
      );
      setForwardTxHash(hash);
      setPhase("success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : copy.timeoutError);
      setPhase("timeout");
    }
  }

  async function handleConfirm(): Promise<void> {
    if (!canConfirm || !irisQuote) return;
    setPhase("submitting");
    setError(null);
    try {
      const result = await solanaBridgeService.execute(
        irisQuote,
        (progress) => {
          setBurnTxHash(progress.burnTxHash);
          if (progress.forwardTxHash) {
            setForwardTxHash(progress.forwardTxHash);
          }
          if (progress.burnTxHash && !progress.forwardTxHash) {
            setPhase("polling");
          }
        },
      );
      setBurnTxHash(result.burnTxHash);
      if (result.forwardTxHash) {
        setForwardTxHash(result.forwardTxHash);
      }
      setPhase("success");
      setInFlight(null);
    } catch (err: unknown) {
      const stored = await solanaBridgeService.resume(
        request.ownerAddress as SolanaAccountAddress,
      );
      if (stored) {
        setInFlight(stored);
        setBurnTxHash(stored.burnTxHash);
        setPhase("timeout");
        setError(err instanceof Error ? err.message : copy.submitFailedError);
      } else {
        setError(err instanceof Error ? err.message : copy.submitFailedError);
        setPhase("quoted");
      }
    }
  }

  if (phase === "success" && burnTxHash) {
    const destExplorer =
      destChain && forwardTxHash
        ? destChain.txExplorerUrl(forwardTxHash)
        : undefined;
    const sourceExplorer = sourceChain?.txExplorerUrl(burnTxHash);
    return (
      <Modal
        title={copy.successTitle}
        onBackdropDismiss={() => {
          void settleResolve({
            burnTxHash,
            ...(forwardTxHash ? { forwardTxHash } : {}),
          });
        }}
        actions={[
          {
            label: copy.doneLabel,
            variant: "primary",
            autoFocus: true,
            onClick: () => {
              void settleResolve({
                burnTxHash,
                ...(forwardTxHash ? { forwardTxHash } : {}),
              });
            },
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

  const secondaryAction = isConfirmScreen
    ? {
        label: copy.backLabel,
        variant: "secondary" as const,
        disabled: busy,
        onClick: () => {
          if (request.hostInitiated && isSolanaBridgeParamsComplete(request)) {
            handleCancel();
            return;
          }
          clearQuoteToSetup();
        },
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
              symbol="USDC"
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
              <input
                type="text"
                className="border-border bg-background text-foreground focus:ring-primary w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
                value={evmRecipient}
                disabled={busy}
                placeholder={copy.evmRecipientPlaceholder}
                onChange={(e) => {
                  setEvmRecipient(e.target.value);
                  setError(null);
                }}
                spellCheck={false}
                autoComplete="off"
              />
              <p className="text-muted-foreground m-0 text-xs">
                {copy.recipientHint}
              </p>
            </div>
          </>
        ) : null}

        {isConfirmScreen && irisQuote ? (
          <ConfirmSummary
            quote={irisQuote}
            sourceLabel={sourceChain?.label ?? String(request.sourceChainId)}
            destLabel={destChain?.label ?? destChainId ?? ""}
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

        {isConfirmScreen ? (
          <p className="text-muted-foreground m-0 text-xs">
            {copy.solNetworkFeeHint}
          </p>
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
  sourceLabel,
  destLabel,
  speedLabel,
  copy,
  getIrisQuote,
  paused,
}: {
  quote: ISolanaCctpBridgeQuote;
  sourceLabel: string;
  destLabel: string;
  speedLabel: string;
  copy: IStyleCopySolanaBridge;
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
        <dt className="text-muted-foreground">{copy.forwardFeeLabel}</dt>
        <dd>{formatUnits(quote.forwardFee, decimals)} USDC</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted-foreground">{copy.protocolFeeLabel}</dt>
        <dd>{formatUnits(quote.protocolFee, decimals)} USDC</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted-foreground">{copy.totalBurnLabel}</dt>
        <dd>{formatUnits(quote.totalBurn, decimals)} USDC</dd>
      </div>
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
