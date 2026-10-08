import { useEffect, useRef } from "react";
import { formatUnits } from "viem";
import { type EVMTransactionHash } from "@1shotapi/ows-types";
import type {
  IActivateOfflinePermissionsRequest,
  IRelayerConfirmSendResult,
} from "../../wallet/modalTypes";
import type { IRelayerSendUiCallbacks } from "../../lib/types/domain/RelayerSendUi";
import { useStyle } from "../../style/StyleProvider";
import { useWallet } from "../../wallet/WalletProvider";
import { Modal } from "../Modal";
import { QuoteCountdown } from "../QuoteCountdown";
import { useRelayerConfirmSubmit } from "../useRelayerConfirmSubmit";

/**
 * One-time EIP-7702 activation before EIP-7715 grant consent.
 * Quotes a combined USDC fee, then runs {@link ITransactionService.activateDelegations}.
 */
export function ActivateOfflinePermissionsModal({
  request,
  execute,
  onResolve,
  onReject,
}: {
  request: IActivateOfflinePermissionsRequest;
  execute: (
    payment: IRelayerConfirmSendResult,
    ui: IRelayerSendUiCallbacks,
  ) => Promise<EVMTransactionHash>;
  onResolve: (hash: EVMTransactionHash) => void;
  onReject: (error: unknown) => void;
}) {
  const { style } = useStyle();
  const { transactionService } = useWallet();
  const copy = style.copy.activateOfflinePermissions;
  const relayerCopy = style.copy.relayerSubmit;
  const rejectMessage = "User rejected offline permission activation";

  const upgradeChainIds = request.upgradeChains.map((c) => c.chainId);
  const upgradeKey = upgradeChainIds.map(String).join(",");

  const submit = useRelayerConfirmSubmit({
    execute,
    onResolve,
    onReject,
    rejectMessage,
    // Stay open through activation poll so grant consent can follow without
    // collapsing the flyout between submit and confirmation.
    retainDisplayDuringSubmit: true,
    signingMessage: relayerCopy.signingMessage,
    waitingMessage: relayerCopy.waitingMessage,
    finalFeeNotice: relayerCopy.finalFeeNotice,
  });

  const onQuoteChangeRef = useRef(submit.setQuote);
  const onQuoteErrorRef = useRef(submit.setQuoteError);
  useEffect(() => {
    onQuoteChangeRef.current = submit.setQuote;
    onQuoteErrorRef.current = submit.setQuoteError;
  }, [submit.setQuote, submit.setQuoteError]);

  const getNewQuote = async (): Promise<string> => {
    try {
      const next = await transactionService.quoteActivation(
        request.ownerAddress,
        upgradeChainIds,
        request.payment,
      );
      onQuoteChangeRef.current(next);
      onQuoteErrorRef.current(null);
      return next.feeFormatted;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to quote activation fee";
      onQuoteChangeRef.current(null);
      onQuoteErrorRef.current(message);
      throw err;
    }
  };

  const insufficientBalance =
    submit.quote !== null &&
    submit.quote.feeAtoms > request.payment.balance;

  const balanceError = insufficientBalance
    ? copy.insufficientBalanceError.replace(
        "{chainName}",
        request.payment.paymentChainName,
      )
    : null;

  const canConfirm =
    submit.canConfirm && !insufficientBalance && balanceError === null;

  const showActions =
    submit.phase === "confirm" || submit.phase === "finalFee";

  return (
    <Modal
      title={copy.title}
      onBackdropDismiss={
        submit.phase === "confirm" || submit.phase === "finalFee"
          ? submit.cancel
          : undefined
      }
      actions={
        showActions
          ? [
              {
                label: copy.rejectLabel,
                variant: "secondary",
                onClick: submit.cancel,
              },
              {
                label: copy.confirmLabel,
                variant: "primary",
                autoFocus: true,
                disabled: !canConfirm,
                onClick:
                  submit.phase === "finalFee"
                    ? submit.confirmFinalFee
                    : submit.startSubmit,
              },
            ]
          : undefined
      }
    >
      <div className="text-foreground flex flex-col gap-4">
        <p className="text-muted-foreground m-0 text-sm leading-relaxed">
          {copy.body}
        </p>

        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            {copy.chainsLabel}
          </span>
          <ul className="m-0 list-disc pl-5 text-sm">
            {request.upgradeChains.map((chain) => (
              <li key={String(chain.chainId)}>{chain.chainName}</li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            {copy.payFromLabel}
          </span>
          <p className="m-0 text-sm">
            {request.payment.paymentChainName} ({request.payment.symbol})
          </p>
          <p className="text-muted-foreground m-0 text-xs">
            Balance:{" "}
            {formatUnits(
              request.payment.balance,
              request.payment.decimals,
            )}{" "}
            {request.payment.symbol}
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t pt-3">
          <span className="text-muted-foreground text-[0.8rem] font-medium">
            {copy.feeLabel}
          </span>
          {submit.phase === "finalFee" ? (
            <p className="text-muted-foreground m-0 text-sm">
              {submit.finalFeeNotice}
            </p>
          ) : null}
          {submit.quoteError || balanceError ? (
            <p className="text-destructive m-0 text-sm" role="alert">
              {balanceError ?? submit.quoteError}
            </p>
          ) : null}
          <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
            <span>
              {submit.phase === "finalFee" ? "Final fee:" : "Est. fee:"}
            </span>
            {submit.phase === "finalFee" && submit.finalFee ? (
              <span>
                {submit.finalFee.feeFormatted} {request.payment.symbol}
              </span>
            ) : (
              <>
                <QuoteCountdown
                  key={upgradeKey}
                  getNewQuote={getNewQuote}
                  paused={submit.feePickerPaused}
                />
                <span className="text-muted-foreground">
                  {request.payment.symbol}
                </span>
              </>
            )}
          </p>
        </div>

        {submit.statusMessage ? (
          <p className="text-muted-foreground m-0 text-[0.9rem]">
            {submit.statusMessage}
          </p>
        ) : null}
        {submit.error ? (
          <p className="text-destructive m-0 text-[0.9rem]">{submit.error}</p>
        ) : null}
      </div>
    </Modal>
  );
}
