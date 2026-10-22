import type { SendTransactionApprovalRequest } from "@1shotapi/ows-signer-utils";
import {
  OwsUserRejectedError,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import { useRef, useState } from "react";

import type { IRelayerSendUiCallbacks } from "../../lib/types/domain/RelayerSendUi";
import { isSignCeremonyDenied } from "../../lib/utils/isSignCeremonyDenied";
import { useStyle } from "../../style/StyleProvider";
import type { IConfirmSendPayment } from "../../wallet/modalTypes";
import { Modal } from "../Modal";
import { RelayerConfirmModalChrome } from "../RelayerConfirmModalChrome";
import { useRelayerConfirmSubmit } from "../useRelayerConfirmSubmit";

import { FieldLabel } from "./FieldLabel";
import { LabeledBlock } from "./LabeledBlock";

/** Host EIP-1193 `eth_sendTransaction` consent (generic / non-transfer). */
export function EVMSendTransactionModal({
  request,
  execute,
  onResolve,
  onReject,
}: {
  request: SendTransactionApprovalRequest & { useRelayer?: boolean };
  execute: (
    payment: IConfirmSendPayment,
    ui?: IRelayerSendUiCallbacks,
  ) => Promise<EVMTransactionHash>;
  onResolve: (hash: EVMTransactionHash) => void;
  onReject: (error: unknown) => void;
}) {
  const { style } = useStyle();
  const { sendTransaction: copy } = style.copy;
  const relayerCopy = style.copy.relayerSubmit;

  const relayerSubmit = useRelayerConfirmSubmit({
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

  const [legacyPhase, setLegacyPhase] = useState<"confirm" | "signing">(
    "confirm",
  );
  const [legacyError, setLegacyError] = useState<string | null>(null);
  const abortedRef = useRef(false);

  const useRelayer = request.useRelayer === true;

  const phase = useRelayer ? relayerSubmit.phase : legacyPhase;

  const canConfirm = useRelayer ? relayerSubmit.canConfirm : true;

  const cancel = () => {
    abortedRef.current = true;
    if (useRelayer) {
      relayerSubmit.cancel();
      return;
    }
    onReject(new OwsUserRejectedError("User rejected the transaction request"));
  };

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

  const showActions = useRelayer
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
                label: copy.rejectLabel,
                variant: "secondary",
                onClick: cancel,
              },
              {
                label: copy.signLabel,
                variant: "primary",
                autoFocus: true,
                disabled: useRelayer ? !canConfirm : false,
                onClick: useRelayer
                  ? phase === "finalFee"
                    ? relayerSubmit.confirmFinalFee
                    : relayerSubmit.startSubmit
                  : startLegacySend,
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
      {useRelayer ? (
        <RelayerConfirmModalChrome
          chainId={request.chainId}
          ownerAddress={request.address}
          work={{
            to: request.to!,
            data: request.data,
            value:
              request.value &&
              String(request.value) !== "0x0" &&
              String(request.value) !== "0x"
                ? BigInt(String(request.value))
                : undefined,
          }}
          submit={relayerSubmit}
        />
      ) : legacyPhase === "signing" ? (
        <p className="text-muted-foreground mt-4 m-0 text-[0.9rem]">
          {relayerCopy.signingMessage}
        </p>
      ) : null}
      {!useRelayer && legacyError ? (
        <p className="text-destructive mt-3 m-0 text-[0.9rem]">{legacyError}</p>
      ) : null}
    </Modal>
  );
}
