import { useState } from "react";
import type {
  ICancelDelegationConfirmRequest,
  IRelayerConfirmSendResult,
} from "../../wallet/modalTypes";
import type { IRelayerSendUiCallbacks } from "../../lib/types/domain/RelayerSendUi";
import {
  OwsUserRejectedError,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import { useStyle } from "../../style/StyleProvider";
import { Modal } from "../Modal";
import { RelayerConfirmModalChrome } from "../RelayerConfirmModalChrome";
import { useRelayerConfirmSubmit } from "../useRelayerConfirmSubmit";

/**
 * On-chain cancel / revoke confirm — collects relayer fee then runs execute.
 * Optional “Skip onchain cancellation” removes the vault row only.
 */
export function CancelDelegationModal({
  request,
  execute,
  executeLocal,
  onRegisterAwaitingConfirmation,
  onResolve,
  onReject,
}: {
  request: ICancelDelegationConfirmRequest;
  execute: (
    payment: IRelayerConfirmSendResult,
    ui: IRelayerSendUiCallbacks,
  ) => Promise<EVMTransactionHash>;
  executeLocal: () => Promise<void>;
  onRegisterAwaitingConfirmation?: (notify: () => void) => void;
  onResolve: (hash: EVMTransactionHash | null) => void;
  onReject: (error: unknown) => void;
}) {
  const { style } = useStyle();
  const copy = style.copy.cancelDelegation;
  const relayerCopy = style.copy.relayerSubmit;
  const [skipOnchain, setSkipOnchain] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const rejectMessage = "User rejected canceling the permission";

  const submit = useRelayerConfirmSubmit({
    execute,
    onRegisterAwaitingConfirmation,
    onResolve,
    onReject,
    rejectMessage,
    retainDisplayDuringSubmit: true,
    signingMessage: relayerCopy.signingMessage,
    waitingMessage: relayerCopy.waitingMessage,
    finalFeeNotice: relayerCopy.finalFeeNotice,
  });

  const body = copy.body
    .replace("{domain}", request.domain)
    .replace("{chainName}", request.chainName);

  const showConfirmActions =
    skipOnchain ||
    submit.phase === "confirm" ||
    submit.phase === "finalFee";

  const canConfirm = skipOnchain
    ? !localBusy
    : submit.canConfirm;

  const onConfirm = () => {
    if (skipOnchain) {
      setLocalError(null);
      setLocalBusy(true);
      void executeLocal()
        .then(() => onResolve(null))
        .catch((error: unknown) => {
          setLocalBusy(false);
          setLocalError(
            error instanceof Error ? error.message : String(error),
          );
        });
      return;
    }
    if (submit.phase === "finalFee") {
      submit.confirmFinalFee();
    } else {
      submit.startSubmit();
    }
  };

  const onCancel = () => {
    if (skipOnchain) {
      onReject(new OwsUserRejectedError(rejectMessage));
      return;
    }
    submit.cancel();
  };

  return (
    <Modal
      title={copy.title}
      onBackdropDismiss={
        skipOnchain
          ? localBusy
            ? undefined
            : onCancel
          : submit.phase === "confirm" || submit.phase === "finalFee"
            ? submit.cancel
            : undefined
      }
      actions={
        showConfirmActions
          ? [
              {
                label: copy.rejectLabel,
                variant: "secondary",
                onClick: onCancel,
                disabled: skipOnchain ? localBusy : undefined,
              },
              {
                label: copy.confirmLabel,
                variant: "primary",
                autoFocus: true,
                disabled: !canConfirm,
                onClick: onConfirm,
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
      {!skipOnchain ? (
        <RelayerConfirmModalChrome
          chainId={request.chainId}
          ownerAddress={request.ownerAddress}
          work={request.work}
          submit={submit}
        />
      ) : null}
      {request.allowSkipOnchain ? (
        <div className="mt-4">
          <label className="flex cursor-pointer items-start gap-2.5 text-left">
            <input
              type="checkbox"
              className="border-input bg-background text-primary mt-0.5 size-4 shrink-0 rounded border accent-[var(--primary)]"
              checked={skipOnchain}
              disabled={localBusy || submit.phase !== "confirm"}
              onChange={(event) => {
                setSkipOnchain(event.target.checked);
                setLocalError(null);
              }}
            />
            <span className="text-muted-foreground text-[0.85rem] leading-snug">
              {copy.skipOnchainLabel}
            </span>
          </label>
          {skipOnchain ? (
            <p className="text-destructive m-0 mt-2 text-[0.85rem] leading-snug">
              {copy.skipOnchainAcknowledgement}
            </p>
          ) : null}
          {localError ? (
            <p className="text-destructive m-0 mt-2 text-[0.85rem]" role="alert">
              {localError}
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
