import type {
  PersonalSignApprovalRequest,
  SendTransactionApprovalRequest,
  SignTypedDataApprovalRequest,
} from "@1shotapi/ows-signer-utils";
import {
  ConversionUtils,
  EVMChainId,
  HexString,
  OwsUserRejectedError,
  type EVMSignatureHex,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import { useRef, useState } from "react";
import type { TypedDataDefinition } from "viem";
import type { IPaymentQuote } from "../../lib/interfaces/business";
import type { ISiweFields } from "../../lib/types/domain/SiweFields";
import type {
  IConfirmSendPayment,
  IConfirmTransferRequest,
} from "../../wallet/modalTypes";
import { useStyle } from "../../style/StyleProvider";
import { useWallet } from "../../wallet/WalletProvider";
import { Modal } from "../Modal";
import { AssetIdentityMark } from "../AssetIdentityMark";
import { CopyableText } from "../CopyableText";
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
  const { personalSign, account: accountCopy } = style.copy;
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
      <div className="mb-3">
        <CopyableText
          text={String(request.address)}
          truncate
          copyLabel={accountCopy.copyAddressLabel}
          copiedLabel={accountCopy.addressCopiedLabel}
          copyFailedLabel={accountCopy.addressCopyFailedLabel}
        />
      </div>
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

export function SiweModal({
  source,
  request,
  fields,
  onResolve,
  onReject,
}: {
  source: "typedData" | "personalSign";
  request: SignTypedDataApprovalRequest | PersonalSignApprovalRequest;
  fields: ISiweFields;
  onResolve: (signature: EVMSignatureHex) => void;
  onReject: (error: unknown) => void;
}) {
  const { getSigner, resolveChain } = useWallet();
  const { style } = useStyle();
  const { siwe, account: accountCopy } = style.copy;
  const [phase, setPhase] = useState<"confirm" | "signing">("confirm");
  const signGenerationRef = useRef(0);

  const accountAddress =
    fields.address?.trim() || String(request.address);
  const networkLabel = resolveSiweNetworkLabel(fields.chainId, resolveChain);

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
      let signature: EVMSignatureHex;
      if (source === "typedData") {
        const typed = (request as SignTypedDataApprovalRequest).typedData;
        const [sig] = await signer.evm.signTypedData([
          typed as unknown as TypedDataDefinition,
        ]);
        signature = sig!;
      } else {
        const message = (request as PersonalSignApprovalRequest).message;
        const [sig] = await signer.evm.signMessage([message]);
        signature = sig!;
      }
      if (signGenerationRef.current !== generation) return;
      onResolve(signature);
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
      title={siwe.title}
      onBackdropDismiss={phase === "confirm" ? cancel : undefined}
      actions={
        phase === "confirm"
          ? [
              {
                label: siwe.rejectLabel,
                variant: "secondary",
                onClick: cancel,
              },
              {
                label: siwe.signLabel,
                variant: "primary",
                autoFocus: true,
                onClick: startSign,
              },
            ]
          : undefined
      }
    >
      <p className="text-muted-foreground mb-4 m-0 text-[0.9rem]">{siwe.body}</p>

      <div className="border-border mb-4 rounded-md border px-3 py-2">
        <p className="text-muted-foreground m-0 text-[0.8rem] font-medium">
          {siwe.estimatedChangesLabel}
        </p>
        <p className="m-0 mt-1 text-[0.9rem]">{siwe.noChangesLabel}</p>
      </div>

      <SiweDetailRow label={siwe.networkLabel} value={networkLabel} />
      <SiweDetailRow label={siwe.requestFromLabel} value={fields.domain} />
      <div className="mb-4">
        <FieldLabel>{siwe.signingInWithLabel}</FieldLabel>
        <CopyableText
          text={accountAddress}
          truncate
          copyLabel={accountCopy.copyAddressLabel}
          copiedLabel={accountCopy.addressCopiedLabel}
          copyFailedLabel={accountCopy.addressCopyFailedLabel}
        />
      </div>

      <div className="border-border mb-1 rounded-md border px-3 py-3">
        <FieldLabel>{siwe.messageLabel}</FieldLabel>
        <p className="m-0 mb-3 whitespace-pre-wrap text-[0.9rem]">
          {fields.statement?.trim() || siwe.body}
        </p>
        {fields.uri ? (
          <>
            <FieldLabel>{siwe.uriLabel}</FieldLabel>
            <p className="m-0 break-all font-mono text-[0.8rem]">{fields.uri}</p>
          </>
        ) : null}
      </div>

      {phase === "signing" ? (
        <p className="text-muted-foreground mt-4 m-0 text-[0.9rem]">
          {siwe.signingHint}
        </p>
      ) : null}
    </Modal>
  );
}

function SiweDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3">
      <FieldLabel>{label}</FieldLabel>
      <p className="m-0 break-all text-[0.9rem]">{value}</p>
    </div>
  );
}

function resolveSiweNetworkLabel(
  chainIdRaw: string,
  resolveChain: (
    chainId: EVMChainId,
  ) => { label: string } | null,
): string {
  const normalized = normalizeChainIdHex(chainIdRaw);
  if (normalized) {
    const match = resolveChain(EVMChainId(normalized as `0x${string}`));
    if (match) return match.label;
  }
  return chainIdRaw.trim() || "Unknown network";
}

function normalizeChainIdHex(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    return `0x${BigInt(trimmed).toString(16)}`;
  }
  if (/^\d+$/.test(trimmed)) {
    return `0x${BigInt(trimmed).toString(16)}`;
  }
  return null;
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
  const { resolveChain } = useWallet();
  const { confirmTransfer: copy, account: accountCopy } = style.copy;
  const [quote, setQuote] = useState<IPaymentQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"confirm" | "signing">("confirm");
  const [error, setError] = useState<string | null>(null);
  const abortedRef = useRef(false);
  const body = copy.body.replace("{domain}", request.domain);
  const chain = resolveChain(request.chainId);

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
      <div className="text-foreground flex flex-col gap-5">
        <p className="text-muted-foreground m-0 text-sm leading-relaxed">
          {body}
        </p>

        <div className="flex items-center gap-4">
          <AssetIdentityMark
            chainId={request.chainId}
            address={request.tokenAddress}
            symbol={request.tokenSymbol}
            chainLogoUrl={chain?.logoUrl}
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xl font-semibold tracking-tight">
              {request.amount} {request.tokenSymbol}
            </span>
            <span className="bg-muted text-muted-foreground w-fit rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide">
              {request.chainName}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {copy.receiverLabel}
          </span>
          <CopyableText
            text={request.receiver}
            truncate
            copyLabel={accountCopy.copyAddressLabel}
            copiedLabel={accountCopy.addressCopiedLabel}
            copyFailedLabel={accountCopy.addressCopyFailedLabel}
          />
        </div>
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
  let codePoints = 0;
  for (const char of text) {
    codePoints++;
    const code = char.codePointAt(0) ?? 0;
    if (code >= 32 && code !== 127) printable++;
  }
  return codePoints > 0 && printable / codePoints >= 0.85;
}
