import type {
  ICancelDelegationConfirmRequest,
  IRelayerConfirmSendResult,
} from "../../wallet/modalTypes";
import type { IRelayerSendUiCallbacks } from "../../lib/types/domain/RelayerSendUi";
import type { EVMTransactionHash } from "@1shotapi/ows-types";
import { useStyle } from "../../style/StyleProvider";
import { Modal } from "../Modal";
import { RelayerConfirmModalChrome } from "../RelayerConfirmModalChrome";
import { useRelayerConfirmSubmit } from "../useRelayerConfirmSubmit";

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
  execute: (
    payment: IRelayerConfirmSendResult,
    ui: IRelayerSendUiCallbacks,
  ) => Promise<EVMTransactionHash>;
  onRegisterAwaitingConfirmation?: (notify: () => void) => void;
  onResolve: (hash: EVMTransactionHash) => void;
  onReject: (error: unknown) => void;
}) {
  const { style } = useStyle();
  const copy = style.copy.cancelDelegation;
  const relayerCopy = style.copy.relayerSubmit;

  const submit = useRelayerConfirmSubmit({
    execute,
    onRegisterAwaitingConfirmation,
    onResolve,
    onReject,
    rejectMessage: "User rejected canceling the permission",
    retainDisplayDuringSubmit: true,
    signingMessage: relayerCopy.signingMessage,
    waitingMessage: relayerCopy.waitingMessage,
    finalFeeNotice: relayerCopy.finalFeeNotice,
  });

  const body = copy.body
    .replace("{domain}", request.domain)
    .replace("{chainName}", request.chainName);

  return (
    <Modal
      title={copy.title}
      onBackdropDismiss={
        submit.phase === "confirm" || submit.phase === "finalFee"
          ? submit.cancel
          : undefined
      }
      actions={
        submit.phase === "confirm" || submit.phase === "finalFee"
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
                disabled: !submit.canConfirm,
                onClick:
                  submit.phase === "finalFee"
                    ? submit.confirmFinalFee
                    : submit.startSubmit,
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
      <RelayerConfirmModalChrome
        chainId={request.chainId}
        ownerAddress={request.ownerAddress}
        submit={submit}
      />
    </Modal>
  );
}
