import type {
  PersonalSignApprovalRequest,
  SendTransactionApprovalRequest,
  SignTypedDataApprovalRequest,
} from "@1shotapi/ows-signer-utils";
import {
  ConversionUtils,
  HexString,
  OwsUserRejectedError,
  type EVMSignatureHex,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import { useRef, useState } from "react";
import type { TypedDataDefinition } from "viem";
import type { IPaymentQuote } from "../../lib/interfaces/business";
import type {
  IConfirmSendPayment,
  IConfirmTransferRequest,
} from "../../wallet/modalTypes";
import { useStyle } from "../../style/StyleProvider";
import { useWallet } from "../../wallet/WalletProvider";
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

export function PersonalSignModal({
  request,
  onResolve,
  onReject,
}: {
  request: PersonalSignApprovalRequest;
  onResolve: (signature: EVMSignatureHex) => void;
  onReject: (error: unknown) => void;
}) {
  const { getSigner } = useWallet();
  const { style } = useStyle();
  const { personalSign } = style.copy;
  const [phase, setPhase] = useState<"confirm" | "signing">("confirm");
  /** Bumped on cancel and each startSign so stale in-flight ops cannot settle. */
  const signGenerationRef = useRef(0);

  const cancel = () => {
    signGenerationRef.current += 1;
    onReject(new OwsUserRejectedError("User rejected the signing request"));
  };

  const startSign = () => {
    const generation = ++signGenerationRef.current;
    setPhase("signing");
    void (async () => {
      const signer = getSigner();
      if (!signer) {
        throw new Error("Signer not ready");
      }
      const [signature] = await signer.evm.signMessage([request.message]);
      if (signGenerationRef.current !== generation) return;
      onResolve(signature!);
    })().catch((error: unknown) => {
      if (signGenerationRef.current !== generation) return;
      if (isSignDenied(error)) {
        setPhase("confirm");
        return;
      }
      onReject(error);
    });
  };

  return (
    <Modal
      title={personalSign.title}
      onBackdropDismiss={phase === "confirm" ? cancel : undefined}
      actions={
        phase === "confirm"
          ? [
              {
                label: personalSign.rejectLabel,
                variant: "secondary",
                onClick: cancel,
              },
              {
                label: personalSign.signLabel,
                variant: "primary",
                autoFocus: true,
                onClick: startSign,
              },
            ]
          : undefined
      }
    >
      <FieldLabel>{personalSign.accountLabel}</FieldLabel>
      <p className="mb-3 break-all font-mono text-[0.8rem]">{request.address}</p>
      <FieldLabel>{personalSign.messageLabel}</FieldLabel>
      <DetailBlock content={formatMessageForDisplay(request.message)} />
      {phase === "signing" ? (
        <p className="text-muted-foreground mt-4 m-0 text-[0.9rem]">
          Confirm in the signing panel…
        </p>
      ) : null}
    </Modal>
  );
}

export function TypedDataModal({
  request,
  onResolve,
  onReject,
}: {
  request: SignTypedDataApprovalRequest;
  onResolve: (signature: EVMSignatureHex) => void;
  onReject: (error: unknown) => void;
}) {
  const { getSigner } = useWallet();
  const { style } = useStyle();
  const { typedData: copy } = style.copy;
  const { typedData } = request;
  const [phase, setPhase] = useState<"confirm" | "signing">("confirm");
  /** Bumped on cancel and each startSign so stale in-flight ops cannot settle. */
  const signGenerationRef = useRef(0);

  const cancel = () => {
    signGenerationRef.current += 1;
    onReject(new OwsUserRejectedError("User rejected the signing request"));
  };

  const startSign = () => {
    const generation = ++signGenerationRef.current;
    setPhase("signing");
    void (async () => {
      const signer = getSigner();
      if (!signer) {
        throw new Error("Signer not ready");
      }
      const [signature] = await signer.evm.signTypedData([
        typedData as unknown as TypedDataDefinition,
      ]);
      if (signGenerationRef.current !== generation) return;
      onResolve(signature!);
    })().catch((error: unknown) => {
      if (signGenerationRef.current !== generation) return;
      if (isSignDenied(error)) {
        setPhase("confirm");
        return;
      }
      onReject(error);
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
                label: copy.signLabel,
                variant: "primary",
                autoFocus: true,
                onClick: startSign,
              },
            ]
          : undefined
      }
    >
      <FieldLabel>{copy.accountLabel}</FieldLabel>
      <p className="mb-3 break-all font-mono text-[0.8rem]">{request.address}</p>
      <LabeledBlock
        label={copy.primaryTypeLabel}
        content={typedData.primaryType}
      />
      <LabeledBlock
        label={copy.domainLabel}
        content={formatJson(typedData.domain)}
      />
      <LabeledBlock
        label={copy.messageLabel}
        content={formatJson(typedData.message)}
      />
      {phase === "signing" ? (
        <p className="text-muted-foreground mt-4 m-0 text-[0.9rem]">
          Confirm in the signing panel…
        </p>
      ) : null}
    </Modal>
  );
}

export function SendTransactionModal({
  request,
  execute,
  onResolve,
  onReject,
}: {
  request: SendTransactionApprovalRequest & { useRelayer?: boolean };
  execute: (payment: IConfirmSendPayment) => Promise<EVMTransactionHash>;
  onResolve: (hash: EVMTransactionHash) => void;
  onReject: (error: unknown) => void;
}) {
  const { style } = useStyle();
  const { sendTransaction: copy } = style.copy;
  const [quote, setQuote] = useState<IPaymentQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"confirm" | "signing">("confirm");
  const [error, setError] = useState<string | null>(null);
  const abortedRef = useRef(false);

  const canConfirm =
    !request.useRelayer || (quote !== null && quoteError === null);

  const cancel = () => {
    abortedRef.current = true;
    onReject(new OwsUserRejectedError("User rejected the transaction request"));
  };

  const startSend = () => {
    abortedRef.current = false;
    setError(null);
    setPhase("signing");
    const payment: IConfirmSendPayment =
      request.useRelayer && quote
        ? { paymentToken: quote.selectedToken, feeAtoms: quote.feeAtoms }
        : {};
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
                label: copy.signLabel,
                variant: "primary",
                autoFocus: true,
                disabled: !canConfirm,
                onClick: startSend,
              },
            ]
          : undefined
      }
    >
      <FieldLabel>{copy.accountLabel}</FieldLabel>
      <p className="mb-3 break-all font-mono text-[0.8rem]">{request.address}</p>
      <LabeledBlock
        label={copy.contractLabel}
        content={request.to ?? copy.contractCreationLabel}
      />
      <LabeledBlock label={copy.valueLabel} content={request.value} />
      <LabeledBlock label={copy.dataLabel} content={request.data} />
      <LabeledBlock label={copy.chainLabel} content={request.chainId} />
      {request.useRelayer ? (
        <PaymentFeePicker
          chainId={request.chainId}
          ownerAddress={request.address}
          quote={quote}
          error={quoteError}
          loading={false}
          onQuoteChange={(next, err) => {
            setQuote(next);
            setQuoteError(err);
          }}
        />
      ) : null}
      {phase === "signing" ? (
        <p className="text-muted-foreground mt-4 m-0 text-[0.9rem]">
          Confirm in the signing panel…
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive mt-3 m-0 text-[0.9rem]">{error}</p>
      ) : null}
    </Modal>
  );
}

export function ConfirmTransferModal({
  request,
  execute,
  onResolve,
  onReject,
}: {
  request: IConfirmTransferRequest;
  execute: (payment: IConfirmSendPayment) => Promise<EVMTransactionHash>;
  onResolve: (hash: EVMTransactionHash) => void;
  onReject: (error: unknown) => void;
}) {
  const { style } = useStyle();
  const { confirmTransfer: copy } = style.copy;
  const [quote, setQuote] = useState<IPaymentQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"confirm" | "signing">("confirm");
  const [error, setError] = useState<string | null>(null);
  const abortedRef = useRef(false);
  const body = copy.body
    .replace("{domain}", request.domain)
    .replace("{amount}", request.amount)
    .replace("{tokenName}", request.tokenName)
    .replace("{tokenSymbol}", request.tokenSymbol)
    .replace("{receiver}", request.receiver)
    .replace("{chainName}", request.chainName);

  const canConfirm =
    !request.useRelayer || (quote !== null && quoteError === null);

  const cancel = () => {
    abortedRef.current = true;
    onReject(new OwsUserRejectedError("User rejected the transaction request"));
  };

  const startSend = () => {
    abortedRef.current = false;
    setError(null);
    setPhase("signing");
    const payment: IConfirmSendPayment =
      request.useRelayer && quote
        ? { paymentToken: quote.selectedToken, feeAtoms: quote.feeAtoms }
        : {};
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
                onClick: startSend,
              },
            ]
          : undefined
      }
    >
      <p className="text-muted-foreground m-0">{body}</p>
      <div className="mt-4 flex flex-col gap-3">
        <LabeledBlock
          label={copy.amountLabel}
          content={`${request.amount} ${request.tokenSymbol}`}
        />
        <LabeledBlock label={copy.tokenLabel} content={request.tokenName} />
        <LabeledBlock label={copy.receiverLabel} content={request.receiver} />
        <LabeledBlock label={copy.chainLabel} content={request.chainName} />
      </div>
      {request.useRelayer ? (
        <PaymentFeePicker
          chainId={request.chainId}
          ownerAddress={request.ownerAddress}
          quote={quote}
          error={quoteError}
          loading={false}
          onQuoteChange={(next, err) => {
            setQuote(next);
            setQuoteError(err);
          }}
        />
      ) : null}
      {phase === "signing" ? (
        <p className="text-muted-foreground mt-4 m-0 text-[0.9rem]">
          Confirm in the signing panel…
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive mt-3 m-0 text-[0.9rem]">{error}</p>
      ) : null}
    </Modal>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <p className="text-muted-foreground mb-1 text-[0.8rem] font-medium">
      {children}
    </p>
  );
}

function DetailBlock({ content }: { content: string }) {
  return <pre className="wallet-detail-block">{content}</pre>;
}

function LabeledBlock({ label, content }: { label: string; content: string }) {
  return (
    <div className="mb-3 min-w-0 last:mb-0">
      <FieldLabel>{label}</FieldLabel>
      <DetailBlock content={content} />
    </div>
  );
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(
      value,
      (_key, v) => (typeof v === "bigint" ? v.toString() : v),
      2,
    );
  } catch {
    return String(value);
  }
}

function formatMessageForDisplay(message: string): string {
  if (message.startsWith("0x") && message.length > 2) {
    try {
      const bytes = ConversionUtils.hexToBytes(
        HexString(message as `0x${string}`),
      );
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      if (isMostlyPrintable(decoded)) {
        return decoded;
      }
    } catch {
      // fall through
    }
  }
  return message;
}

function isMostlyPrintable(text: string): boolean {
  if (!text.trim()) return false;
  let printable = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 32 && code !== 127) printable++;
  }
  return printable / text.length >= 0.85;
}
