import { useEffect, useRef, useState } from "react";
import {
  OwsUserRejectedError,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import type { IPaymentQuote } from "../../lib/interfaces/business";
import type {
  ICancelDelegationConfirmRequest,
  IRelayerConfirmSendResult,
} from "../../wallet/modalTypes";
import { useStyle } from "../../style/StyleProvider";
import { Modal } from "../Modal";
import { PaymentFeePicker } from "../PaymentFeePicker";

function isSignDenied(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "OwsSignDeniedError" ||
    error.message.includes("signDenied") ||
    error.message.includes("SignDenied") ||
    error.message.includes("NotAllowed") ||
    error.message.includes("not allowed")
  );
}

/**
 * On-chain cancel / revoke confirm — collects relayer fee then runs execute.
 */
export function CancelDelegationModal({
  request,
  execute,
  onRegisterAwaitingConfirmation,
  onResolve,
  onReject,
}: {
  request: ICancelDelegationConfirmRequest;
  execute: (payment: IRelayerConfirmSendResult) => Promise<EVMTransactionHash>;
  onRegisterAwaitingConfirmation?: (notify: () => void) => void;
  onResolve: (hash: EVMTransactionHash) => void;
  onReject: (error: unknown) => void;
}) {
  const { style } = useStyle();
  const copy = style.copy.cancelDelegation;
  const [quote, setQuote] = useState<IPaymentQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"confirm" | "signing" | "submitting">(
    "confirm",
  );
  const [error, setError] = useState<string | null>(null);
  const abortedRef = useRef(false);

  useEffect(() => {
    onRegisterAwaitingConfirmation?.(() => setPhase("submitting"));
  }, [onRegisterAwaitingConfirmation]);

  const body = copy.body
    .replace("{domain}", request.domain)
    .replace("{chainName}", request.chainName);

  const canConfirm = quote !== null && quoteError === null;

  const cancel = () => {
    abortedRef.current = true;
    onReject(new OwsUserRejectedError("User rejected canceling the permission"));
  };

  const startCancel = () => {
    if (!quote) return;
    abortedRef.current = false;
    setError(null);
    setPhase("signing");
    const payment: IRelayerConfirmSendResult = {
      paymentToken: quote.selectedToken,
      feeAtoms: quote.feeAtoms,
    };
    void (async () => {
      const hash = await execute(payment);
      if (abortedRef.current) return;
      onResolve(hash);
    })().catch((err: unknown) => {
      if (abortedRef.current) return;
      if (isSignDenied(err)) {
        setPhase("confirm");
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
      setPhase("confirm");
    });
  };

  return (
    <Modal
      title={copy.title}
      onBackdropDismiss={phase === "confirm" ? cancel : undefined}
      actions={
        phase === "confirm"
          ? [
              {
                label: copy.rejectLabel,
                variant: "secondary",
                onClick: cancel,
              },
              {
                label: copy.confirmLabel,
                variant: "primary",
                autoFocus: true,
                disabled: !canConfirm,
                onClick: startCancel,
              },
            ]
          : undefined
      }
    >
      <p className="text-muted-foreground m-0 text-sm">{body}</p>
      <dl className="mt-3 flex flex-col gap-2 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            {copy.hostLabel}
          </dt>
          <dd className="text-foreground m-0">{request.domain}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            {copy.chainLabel}
          </dt>
          <dd className="text-foreground m-0">{request.chainName}</dd>
        </div>
      </dl>
      <PaymentFeePicker
        chainId={request.chainId}
        ownerAddress={request.ownerAddress}
        quote={quote}
        error={quoteError}
        loading={false}
        paused={phase !== "confirm"}
        onQuoteChange={(next, err) => {
          setQuote(next);
          setQuoteError(err);
        }}
      />
      {phase === "signing" || phase === "submitting" ? (
        <p className="text-muted-foreground mt-4 m-0 text-[0.9rem]">
          {phase === "signing"
            ? copy.signingMessage
            : copy.waitingMessage}
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive mt-3 m-0 text-[0.9rem]">{error}</p>
      ) : null}
    </Modal>
  );
}
