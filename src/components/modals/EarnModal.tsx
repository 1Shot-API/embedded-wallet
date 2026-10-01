import { useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import {
  OwsUserRejectedError,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import type { IEarnOpenRequest, EEarnMode } from "../../circle/earnTypes";
import type {
  IEarnQuote,
  IEarnResult,
} from "../../lib/interfaces/business/IEarnService";
import type { IPaymentQuote } from "../../lib/interfaces/business";
import { makeTrackedAssetId } from "../../lib/types/primitives";
import { useStyle } from "../../style/StyleProvider";
import { useWallet } from "../../wallet/WalletProvider";
import { Modal } from "../Modal";
import { PaymentFeePicker } from "../PaymentFeePicker";
import { TokenAmountInput } from "../TokenAmountInput";
import { CopyableText } from "../CopyableText";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";

export interface IEarnModalProps {
  request: IEarnOpenRequest;
  onResolve: (result: IEarnResult) => void;
  onReject: (error: unknown) => void;
}

type EarnPhase = "form" | "quoting" | "quoted" | "submitting" | "success";

function amountValidationError(
  raw: string,
  decimals: number,
  invalidAmountError: string,
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = parseUnits(trimmed, decimals);
    if (parsed <= 0n) return invalidAmountError;
  } catch {
    return invalidAmountError;
  }
  return null;
}

/**
 * Arc USDC Earn — deposit into / withdraw from a pinned Morpho vault via
 * the EIP-7710 relayer (same fee UX as CCTP Bridge).
 */
export function EarnModal({
  request,
  onResolve,
  onReject,
}: IEarnModalProps) {
  const { style } = useStyle();
  const copy = style.copy.earn;
  const {
    earnService,
    requestBalanceRefresh,
    switchChain,
    resolveChain,
  } = useWallet();

  const [mode, setMode] = useState<EEarnMode>(request.mode ?? "deposit");
  const [amount, setAmount] = useState("");
  const [availableAtoms, setAvailableAtoms] = useState<bigint | null>(
    request.availableAtoms ?? null,
  );
  const [earningAtoms, setEarningAtoms] = useState<bigint | null>(null);
  const [vaultName, setVaultName] = useState<string>("");
  const [apy, setApy] = useState<number | null>(null);
  const [quote, setQuote] = useState<IEarnQuote | null>(null);
  const [paymentQuote, setPaymentQuote] = useState<IPaymentQuote | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [phase, setPhase] = useState<EarnPhase>("form");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<EVMTransactionHash | null>(null);

  const decimals = 6;
  const amountError = amountValidationError(
    amount,
    decimals,
    copy.invalidAmountError,
  );
  const canQuote = Boolean(amount.trim()) && !amountError;
  const isQuoting = phase === "quoting";
  const isConfirm = phase === "quoted" || phase === "submitting";
  const isSuccess = phase === "success";
  const isSetup = phase === "form" || phase === "quoting";

  const chain = resolveChain(request.chainId);
  const explorerUrl = useMemo(() => {
    if (!txHash || !chain?.blockExplorerUrl) return null;
    return `${chain.blockExplorerUrl.replace(/\/$/, "")}/tx/${txHash}`;
  }, [chain?.blockExplorerUrl, txHash]);

  const refreshPosition = useCallback(async () => {
    try {
      const position = await earnService.getPosition(
        request.chainId,
        request.ownerAddress,
      );
      setEarningAtoms(position.assets);
      setVaultName(position.vaultName);
      setApy(position.currentApy);
    } catch (err: unknown) {
      console.warn("[earn] position load failed", err);
      setEarningAtoms(0n);
    }
  }, [earnService, request.chainId, request.ownerAddress]);

  useEffect(() => {
    void refreshPosition();
  }, [refreshPosition]);

  useEffect(() => {
    if (request.availableAtoms !== undefined && request.availableAtoms !== null) {
      setAvailableAtoms(request.availableAtoms);
    }
  }, [request.availableAtoms]);

  const maxAtoms =
    mode === "deposit" ? availableAtoms : earningAtoms;

  const applyMax = () => {
    if (maxAtoms === null) return;
    setAmount(formatUnits(maxAtoms, decimals));
    setQuote(null);
    setPaymentQuote(null);
    setPhase("form");
  };

  const close = (error?: unknown) => {
    if (error) {
      onReject(error);
      return;
    }
    onReject(new OwsUserRejectedError("User cancelled Earn"));
  };

  const runQuote = async () => {
    if (amountError || !amount.trim()) return;
    setPhase("quoting");
    setError(null);
    setPaymentError(null);
    try {
      const amountAtoms = parseUnits(amount.trim(), decimals);
      const next =
        mode === "deposit"
          ? await earnService.quoteDeposit({
              chainId: request.chainId,
              owner: request.ownerAddress,
              amountAtoms,
            })
          : await earnService.quoteWithdraw({
              chainId: request.chainId,
              owner: request.ownerAddress,
              amountAtoms,
            });
      setQuote(next);
      setPaymentQuote(next.paymentQuote);
      setPhase("quoted");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : copy.quoteFailedError,
      );
      setPhase("form");
    }
  };

  const runSubmit = async () => {
    if (!quote || !paymentQuote) return;
    setPhase("submitting");
    setError(null);
    try {
      await switchChain(request.chainId);
      const payment = {
        paymentToken: paymentQuote.selectedToken,
        feeAtoms: paymentQuote.feeAtoms,
        ...(paymentQuote.paymentChainId
          ? { paymentChainId: paymentQuote.paymentChainId }
          : {}),
      };
      const result =
        mode === "deposit"
          ? await earnService.deposit(quote, payment)
          : await earnService.withdraw(quote, payment);
      setTxHash(result.transactionHash);
      setPhase("success");
      void requestBalanceRefresh(
        makeTrackedAssetId(request.chainId, quote.usdc.address),
      );
      void refreshPosition();
    } catch (err: unknown) {
      if (err instanceof OwsUserRejectedError) {
        onReject(err);
        return;
      }
      setError(
        err instanceof Error ? err.message : copy.submitFailedError,
      );
      setPhase("quoted");
    }
  };

  const apyLabel =
    apy !== null && Number.isFinite(apy)
      ? `${(apy * 100).toFixed(2)}%`
      : null;

  return (
    <Modal
      title={
        isSuccess
          ? copy.successTitle
          : isConfirm
            ? copy.confirmTitle
            : copy.title
      }
      onBackdropDismiss={
        phase === "submitting"
          ? undefined
          : () => {
              if (isSuccess) {
                onResolve({
                  transactionHash: txHash!,
                });
                return;
              }
              close();
            }
      }
      actions={
        isSuccess
          ? [
              {
                label: copy.doneLabel,
                variant: "primary",
                autoFocus: true,
                onClick: () =>
                  onResolve({
                    transactionHash: txHash!,
                  }),
              },
            ]
          : isSetup
            ? [
                {
                  label: copy.cancelLabel,
                  variant: "secondary",
                  onClick: () => close(),
                },
                {
                  label: isQuoting ? copy.quotingLabel : copy.getQuoteLabel,
                  variant: "primary",
                  autoFocus: true,
                  disabled: !canQuote || isQuoting,
                  onClick: () => void runQuote(),
                },
              ]
            : [
                {
                  label: copy.backLabel,
                  variant: "secondary",
                  disabled: phase === "submitting",
                  onClick: () => {
                    setPhase("form");
                    setQuote(null);
                    setPaymentQuote(null);
                    setError(null);
                  },
                },
                {
                  label:
                    phase === "submitting"
                      ? copy.submittingLabel
                      : copy.confirmLabel,
                  variant: "primary",
                  autoFocus: true,
                  disabled:
                    phase === "submitting" || !paymentQuote || !!paymentError,
                  onClick: () => void runSubmit(),
                },
              ]
      }
    >
      <div className="flex flex-col gap-4">
        {isSuccess ? (
          <>
            <p className="text-muted-foreground m-0 text-sm">{copy.successBody}</p>
            {txHash ? (
              <div className="flex flex-col gap-1">
                <p className="text-muted-foreground text-xs font-medium">
                  {copy.hashLabel}
                </p>
                <CopyableText text={txHash} />
                {explorerUrl ? (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary text-sm underline"
                  >
                    {copy.viewOnExplorerLabel}
                  </a>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-muted-foreground m-0 text-sm">
              {isConfirm ? copy.confirmBody : copy.body}
            </p>

            {isSetup ? (
              <>
                <Tabs
                  value={mode}
                  onValueChange={(value) => {
                    if (value === "deposit" || value === "withdraw") {
                      setMode(value);
                      setQuote(null);
                      setPaymentQuote(null);
                      setError(null);
                    }
                  }}
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="deposit" className="flex-1">
                      {copy.depositTabLabel}
                    </TabsTrigger>
                    <TabsTrigger value="withdraw" className="flex-1">
                      {copy.withdrawTabLabel}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="bg-muted/40 flex flex-col gap-1 rounded-md px-3 py-2 text-sm">
                  {vaultName ? (
                    <p>
                      <span className="text-muted-foreground">
                        {copy.vaultLabel}:{" "}
                      </span>
                      {vaultName}
                    </p>
                  ) : null}
                  {apyLabel ? (
                    <p>
                      <span className="text-muted-foreground">
                        {copy.apyLabel}:{" "}
                      </span>
                      {apyLabel}
                    </p>
                  ) : null}
                  <p>
                    <span className="text-muted-foreground">
                      {copy.availableLabel}:{" "}
                    </span>
                    {availableAtoms === null
                      ? "…"
                      : `${formatUnits(availableAtoms, decimals)} USDC`}
                  </p>
                  <p>
                    <span className="text-muted-foreground">
                      {copy.earningLabel}:{" "}
                    </span>
                    {earningAtoms === null
                      ? "…"
                      : `${formatUnits(earningAtoms, decimals)} USDC`}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <TokenAmountInput
                    label={copy.amountLabel}
                    placeholder={copy.amountPlaceholder}
                    symbol="USDC"
                    value={amount}
                    onChange={(next) => {
                      setAmount(next);
                      setQuote(null);
                      setPaymentQuote(null);
                      setError(null);
                    }}
                    error={amountError}
                    disabled={isQuoting}
                  />
                  {maxAtoms !== null && maxAtoms > 0n ? (
                    <button
                      type="button"
                      className="text-primary self-end text-xs font-medium underline"
                      onClick={applyMax}
                    >
                      {copy.maxLabel}
                    </button>
                  ) : null}
                </div>

                {error ? (
                  <p className="text-destructive text-sm" role="alert">
                    {error}
                  </p>
                ) : null}
              </>
            ) : null}

            {isConfirm ? (
              <>
                <dl className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">
                      {mode === "deposit"
                        ? copy.depositAmountLabel
                        : copy.withdrawAmountLabel}
                    </dt>
                    <dd className="font-medium">
                      {formatUnits(quote!.amountAtoms, decimals)} USDC
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{copy.sharesLabel}</dt>
                    <dd className="font-medium">
                      {formatUnits(quote!.sharesAtoms, decimals)}
                    </dd>
                  </div>
                  {apyLabel ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{copy.apyLabel}</dt>
                      <dd className="font-medium">{apyLabel}</dd>
                    </div>
                  ) : null}
                </dl>

                <PaymentFeePicker
                  chainId={request.chainId}
                  ownerAddress={request.ownerAddress}
                  work={quote!.relayerWork}
                  quote={paymentQuote}
                  error={paymentError}
                  loading={false}
                  paused={phase === "submitting"}
                  onQuoteChange={(next, err) => {
                    setPaymentQuote(next);
                    setPaymentError(err);
                  }}
                />

                {error ? (
                  <p className="text-destructive text-sm" role="alert">
                    {error}
                  </p>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}
