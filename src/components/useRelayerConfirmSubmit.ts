import { useCallback, useEffect, useRef, useState } from "react";
import { OwsUserRejectedError, type EVMTransactionHash } from "@1shotapi/ows-types";
import type { IPaymentQuote } from "../lib/interfaces/business";
import type { IFinalRelayerFee, IRelayerSendUiCallbacks } from "../lib/types/domain/RelayerSendUi";
import type { IRelayerConfirmSendResult } from "../wallet/modalTypes";

export type RelayerConfirmPhase =
  | "confirm"
  | "signing"
  | "finalFee"
  | "submitting";

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

export type IUseRelayerConfirmSubmitOptions = {
  execute: (
    payment: IRelayerConfirmSendResult,
    ui: IRelayerSendUiCallbacks,
  ) => Promise<EVMTransactionHash>;
  onRegisterAwaitingConfirmation?: (notify: () => void) => void;
  onResolve: (hash: EVMTransactionHash) => void;
  onReject: (error: unknown) => void;
  rejectMessage: string;
  retainDisplayDuringSubmit?: boolean;
  signingMessage: string;
  waitingMessage: string;
  finalFeeNotice: string;
};

/**
 * Shared relayer confirm flow: estimated fee → sign → optional final-fee
 * re-confirm → submit.
 */
export function useRelayerConfirmSubmit({
  execute,
  onRegisterAwaitingConfirmation,
  onResolve,
  onReject,
  rejectMessage,
  retainDisplayDuringSubmit = false,
  signingMessage,
  waitingMessage,
  finalFeeNotice,
}: IUseRelayerConfirmSubmitOptions) {
  const [quote, setQuote] = useState<IPaymentQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [phase, setPhase] = useState<RelayerConfirmPhase>("confirm");
  const [finalFee, setFinalFee] = useState<IFinalRelayerFee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortedRef = useRef(false);
  const finalFeeGateRef = useRef<{
    resolve: () => void;
    reject: (error: Error) => void;
  } | null>(null);
  const showedFinalFeeRef = useRef(false);

  useEffect(() => {
    onRegisterAwaitingConfirmation?.(() => setPhase("submitting"));
  }, [onRegisterAwaitingConfirmation]);

  useEffect(() => {
    return () => {
      finalFeeGateRef.current?.reject(
        new OwsUserRejectedError(rejectMessage),
      );
    };
  }, [rejectMessage]);

  const canConfirm =
    phase === "confirm"
      ? quote !== null && quoteError === null
      : phase === "finalFee" && finalFee !== null;

  const cancel = useCallback(() => {
    abortedRef.current = true;
    finalFeeGateRef.current?.reject(new OwsUserRejectedError(rejectMessage));
    finalFeeGateRef.current = null;
    onReject(new OwsUserRejectedError(rejectMessage));
  }, [onReject, rejectMessage]);

  const runExecute = useCallback(
    (payment: IRelayerConfirmSendResult) => {
      abortedRef.current = false;
      setError(null);
      setPhase("signing");

      void execute(payment, {
        retainDisplayDuringSubmit,
        onAwaitingConfirmation: () => setPhase("submitting"),
        onFinalFeeRequired: (fee) =>
          new Promise<void>((resolve, reject) => {
            showedFinalFeeRef.current = true;
            setFinalFee(fee);
            setPhase("finalFee");
            finalFeeGateRef.current = { resolve, reject };
          }),
      })
        .then((hash) => {
          if (abortedRef.current) return;
          onResolve(hash);
        })
        .catch((err: unknown) => {
          if (abortedRef.current) return;
          finalFeeGateRef.current = null;
          if (isSignDenied(err)) {
            setPhase(showedFinalFeeRef.current ? "finalFee" : "confirm");
            return;
          }
          setError(err instanceof Error ? err.message : String(err));
          setPhase(showedFinalFeeRef.current ? "finalFee" : "confirm");
        });
    },
    [execute, onResolve, retainDisplayDuringSubmit],
  );

  const startSubmit = useCallback(() => {
    if (!quote) return;
    runExecute({
      paymentToken: quote.selectedToken,
      feeAtoms: quote.feeAtoms,
    });
  }, [quote, runExecute]);

  const confirmFinalFee = useCallback(() => {
    if (!finalFeeGateRef.current) return;
    setError(null);
    setPhase("signing");
    finalFeeGateRef.current.resolve();
    finalFeeGateRef.current = null;
  }, []);

  const statusMessage =
    phase === "signing"
      ? signingMessage
      : phase === "submitting"
        ? waitingMessage
        : null;

  return {
    quote,
    quoteError,
    setQuote,
    setQuoteError,
    phase,
    finalFee,
    error,
    canConfirm,
    cancel,
    startSubmit,
    confirmFinalFee,
    statusMessage,
    finalFeeNotice,
    feePickerPaused: phase !== "confirm" && phase !== "finalFee",
    feePickerMode: phase === "finalFee" ? ("final" as const) : ("estimate" as const),
  };
}

export { isSignDenied };
