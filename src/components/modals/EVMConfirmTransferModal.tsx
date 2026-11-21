import {
  OwsUserRejectedError,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import { useRef, useState } from "react";
import { formatUnits } from "viem";

import type { IRelayerSendUiCallbacks } from "../../lib/types/domain/RelayerSendUi";
import { isSignCeremonyDenied } from "../../lib/utils/isSignCeremonyDenied";
import { useStyle } from "../../style/StyleProvider";
import type {
  IConfirmSendPayment,
  IConfirmTransferRequest,
} from "../../wallet/modalTypes";
import { useWallet } from "../../wallet/WalletProvider";
import { AssetIdentityMark } from "../AssetIdentityMark";
import { CopyableText } from "../CopyableText";
import { Modal } from "../Modal";
import { RelayerConfirmModalChrome } from "../RelayerConfirmModalChrome";
import { SafeAssetImage } from "../SafeAssetImage";
import { useRelayerConfirmSubmit } from "../useRelayerConfirmSubmit";

import { RequestingHostBadge } from "./RequestingHostBadge";

/** Host transfer consent (decoded ERC-20, or a native send). */
export function EVMConfirmTransferModal({
  request,
  execute,
  onResolve,
  onReject,
}: {
  request: IConfirmTransferRequest;
  execute: (
    payment: IConfirmSendPayment,
    ui?: IRelayerSendUiCallbacks,
  ) => Promise<EVMTransactionHash>;
  onResolve: (hash: EVMTransactionHash) => void;
  onReject: (error: unknown) => void;
}) {
  const { style } = useStyle();
  const { resolveChain } = useWallet();
  const {
    confirmTransfer,
    confirmApprove,
    clearSigning: clearCopy,
    account: accountCopy,
  } = style.copy;
  const approving = request.purpose === "approve";
  const copy = approving ? confirmApprove : confirmTransfer;
  const relayerCopy = style.copy.relayerSubmit;
  const body = copy.body.replace("{domain}", request.domain);
  const counterpartyLabel = approving
    ? confirmApprove.spenderLabel
    : confirmTransfer.receiverLabel;
  const chain = resolveChain(request.chainId);
  const attachedValue =
    approving && request.work.value != null && request.work.value > 0n
      ? request.work.value
      : null;
  const native = chain?.nativeCurrency ?? { symbol: "ETH", decimals: 18 };

  const submit = useRelayerConfirmSubmit({
    execute: (payment, ui) =>
      execute(
        {
          paymentToken: payment.paymentToken,
          feeAtoms: payment.feeAtoms,
          paymentChainId: payment.paymentChainId,
        },
        ui,
      ),
    onResolve,
    onReject,
    rejectMessage: "User rejected the transaction request",
    signingMessage: relayerCopy.signingMessage,
    waitingMessage: relayerCopy.waitingMessage,
    finalFeeNotice: relayerCopy.finalFeeNotice,
  });

  const canConfirm = !request.useRelayer || submit.canConfirm;

  const cancel = () => {
    if (request.useRelayer) {
      submit.cancel();
      return;
    }
    onReject(new OwsUserRejectedError("User rejected the transaction request"));
  };

  const [legacyPhase, setLegacyPhase] = useState<"confirm" | "signing">(
    "confirm",
  );
  const [legacyError, setLegacyError] = useState<string | null>(null);
  const abortedRef = useRef(false);

  const startLegacySend = () => {
    abortedRef.current = false;
    setLegacyError(null);
    setLegacyPhase("signing");
    void execute({})
      .then((hash) => {
        if (abortedRef.current) return;
        onResolve(hash);
      })
      .catch((err: unknown) => {
        if (abortedRef.current) return;
        if (isSignCeremonyDenied(err)) {
          setLegacyPhase("confirm");
          return;
        }
        setLegacyError(err instanceof Error ? err.message : String(err));
        setLegacyPhase("confirm");
      });
  };

  const phase = request.useRelayer ? submit.phase : legacyPhase;
  const showActions = request.useRelayer
    ? phase === "confirm" || phase === "finalFee"
    : legacyPhase === "confirm";

  return (
    <Modal
      title={copy.title}
      onBackdropDismiss={
        phase === "confirm" || phase === "finalFee" ? cancel : undefined
      }
      actions={
        showActions
          ? [
              {
                label: confirmTransfer.rejectLabel,
                variant: "secondary",
                onClick: cancel,
              },
              {
                label: confirmTransfer.confirmLabel,
                variant: "primary",
                autoFocus: true,
                disabled: request.useRelayer ? !canConfirm : false,
                onClick: request.useRelayer
                  ? phase === "finalFee"
                    ? submit.confirmFinalFee
                    : submit.startSubmit
                  : startLegacySend,
              },
            ]
          : undefined
      }
    >
      <div className="text-foreground flex flex-col gap-5">
        <p className="text-muted-foreground m-0 text-sm leading-relaxed">
          {body}
        </p>

        <RequestingHostBadge domain={request.domain} />

        <div className="flex items-center gap-4">
          {request.tokenAddress ? (
            <AssetIdentityMark
              chainId={request.chainId}
              address={request.tokenAddress}
              symbol={request.tokenSymbol}
              chainLogoUrl={chain?.logoUrl}
            />
          ) : (
            <SafeAssetImage
              src={chain?.logoUrl}
              alt={request.tokenSymbol}
              className="size-16 shrink-0 rounded-full object-cover"
              fallback={
                <div className="bg-muted text-foreground flex size-16 items-center justify-center rounded-full text-2xl font-semibold">
                  {(request.tokenSymbol.trim()[0] ?? "?").toUpperCase()}
                </div>
              }
            />
          )}
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
            {counterpartyLabel}
          </span>
          <CopyableText
            text={request.receiver}
            truncate
            copyLabel={accountCopy.copyAddressLabel}
            copiedLabel={accountCopy.addressCopiedLabel}
            copyFailedLabel={accountCopy.addressCopyFailedLabel}
          />
        </div>
        {attachedValue != null ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {clearCopy.nativeValueLabel}
            </span>
            <span className="text-sm font-medium">
              {formatUnits(attachedValue, native.decimals)} {native.symbol}
            </span>
          </div>
        ) : null}
      </div>
      {request.useRelayer ? (
        <RelayerConfirmModalChrome
          chainId={request.chainId}
          ownerAddress={request.ownerAddress}
          work={request.work}
          submit={submit}
        />
      ) : legacyPhase === "signing" ? (
        <p className="text-muted-foreground mt-4 m-0 text-[0.9rem]">
          {relayerCopy.signingMessage}
        </p>
      ) : null}
      {!request.useRelayer && legacyError ? (
        <p className="text-destructive mt-3 m-0 text-[0.9rem]">{legacyError}</p>
      ) : null}
    </Modal>
  );
}
