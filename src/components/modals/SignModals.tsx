import type {
  PersonalSignApprovalRequest,
  SendTransactionApprovalRequest,
  SignTypedDataApprovalRequest,
} from "@1shotapi/ows-signer-utils";
import { ConversionUtils, HexString } from "@1shotapi/ows-types";
import { useState } from "react";
import type { IPaymentQuote } from "../../lib/interfaces/business";
import type {
  IConfirmSendResult,
  IConfirmTransferRequest,
} from "../../wallet/modalTypes";
import { useStyle } from "../../style";
import { Modal } from "../Modal";
import { PaymentFeePicker } from "../PaymentFeePicker";

export function PersonalSignModal({
  request,
  onResolve,
}: {
  request: PersonalSignApprovalRequest;
  onResolve: (approved: boolean) => void;
}) {
  const { style } = useStyle();
  const { personalSign } = style.copy;

  return (
    <Modal
      title={personalSign.title}
      onBackdropDismiss={() => onResolve(false)}
      actions={[
        {
          label: personalSign.rejectLabel,
          variant: "secondary",
          onClick: () => onResolve(false),
        },
        {
          label: personalSign.signLabel,
          variant: "primary",
          autoFocus: true,
          onClick: () => onResolve(true),
        },
      ]}
    >
      <FieldLabel>{personalSign.accountLabel}</FieldLabel>
      <p className="mb-3 break-all font-mono text-[0.8rem]">{request.address}</p>
      <FieldLabel>{personalSign.messageLabel}</FieldLabel>
      <DetailBlock content={formatMessageForDisplay(request.message)} />
    </Modal>
  );
}

export function TypedDataModal({
  request,
  onResolve,
}: {
  request: SignTypedDataApprovalRequest;
  onResolve: (approved: boolean) => void;
}) {
  const { style } = useStyle();
  const { typedData: copy } = style.copy;
  const { typedData } = request;

  return (
    <Modal
      title={copy.title}
      onBackdropDismiss={() => onResolve(false)}
      actions={[
        {
          label: copy.rejectLabel,
          variant: "secondary",
          onClick: () => onResolve(false),
        },
        {
          label: copy.signLabel,
          variant: "primary",
          autoFocus: true,
          onClick: () => onResolve(true),
        },
      ]}
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
    </Modal>
  );
}

export function SendTransactionModal({
  request,
  onResolve,
}: {
  request: SendTransactionApprovalRequest & { useRelayer?: boolean };
  onResolve: (result: IConfirmSendResult) => void;
}) {
  const { style } = useStyle();
  const { sendTransaction: copy } = style.copy;
  const [quote, setQuote] = useState<IPaymentQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const canConfirm =
    !request.useRelayer || (quote !== null && quoteError === null);

  return (
    <Modal
      title={copy.title}
      onBackdropDismiss={() => onResolve(false)}
      actions={[
        {
          label: copy.rejectLabel,
          variant: "secondary",
          onClick: () => onResolve(false),
        },
        {
          label: copy.signLabel,
          variant: "primary",
          autoFocus: true,
          disabled: !canConfirm,
          onClick: () => {
            if (request.useRelayer && quote) {
              onResolve({
                paymentToken: quote.selectedToken,
                feeAtoms: quote.feeAtoms,
              });
            } else {
              onResolve({});
            }
          },
        },
      ]}
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
    </Modal>
  );
}

export function ConfirmTransferModal({
  request,
  onResolve,
}: {
  request: IConfirmTransferRequest;
  onResolve: (result: IConfirmSendResult) => void;
}) {
  const { style } = useStyle();
  const { confirmTransfer: copy } = style.copy;
  const [quote, setQuote] = useState<IPaymentQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const body = copy.body
    .replace("{domain}", request.domain)
    .replace("{amount}", request.amount)
    .replace("{tokenName}", request.tokenName)
    .replace("{tokenSymbol}", request.tokenSymbol)
    .replace("{receiver}", request.receiver)
    .replace("{chainName}", request.chainName);

  const canConfirm =
    !request.useRelayer || (quote !== null && quoteError === null);

  return (
    <Modal
      title={copy.title}
      onBackdropDismiss={() => onResolve(false)}
      actions={[
        {
          label: copy.rejectLabel,
          variant: "secondary",
          onClick: () => onResolve(false),
        },
        {
          label: copy.confirmLabel,
          variant: "primary",
          autoFocus: true,
          disabled: !canConfirm,
          onClick: () => {
            if (request.useRelayer && quote) {
              onResolve({
                paymentToken: quote.selectedToken,
                feeAtoms: quote.feeAtoms,
              });
            } else {
              onResolve({});
            }
          },
        },
      ]}
    >
      <p className="text-muted-foreground m-0">{body}</p>
      <div className="mt-4 flex flex-col gap-3">
        <LabeledBlock label={copy.amountLabel} content={`${request.amount} ${request.tokenSymbol}`} />
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
