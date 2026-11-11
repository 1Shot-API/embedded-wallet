import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import { useEffect, useState } from "react";

import type { IRelayerSendUiCallbacks } from "../../lib/types/domain/RelayerSendUi";
import { useStyle } from "../../style/StyleProvider";
import type {
  IRelayerConfirmSendResult,
  ISendCallsModalRequest,
} from "../../wallet/modalTypes";
import { useWallet } from "../../wallet/WalletProvider";
import { Modal } from "../Modal";
import { RelayerConfirmModalChrome } from "../RelayerConfirmModalChrome";
import { useRelayerConfirmSubmit } from "../useRelayerConfirmSubmit";

import { FieldLabel } from "./FieldLabel";
import { LabeledBlock } from "./LabeledBlock";
import { RequestingHostBadge } from "./RequestingHostBadge";

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

/** Native value worth showing. Empty, `0x`, and zero quantities stay hidden. */
function hasNativeValue(value: string): boolean {
  const raw = value.trim().toLowerCase();
  if (!raw || raw === "0x" || raw === "0x0") return false;
  try {
    return BigInt(raw) !== 0n;
  } catch {
    return true;
  }
}

/** EIP-5792 `wallet_sendCalls` consent. Resolves the relayer task id. */
export function EVMSendCallsModal({
  request,
  execute,
  onResolve,
  onReject,
}: {
  request: ISendCallsModalRequest;
  execute: (
    payment: IRelayerConfirmSendResult,
    ui?: IRelayerSendUiCallbacks,
  ) => Promise<string>;
  onResolve: (bundleId: string) => void;
  onReject: (error: unknown) => void;
}) {
  const { style } = useStyle();
  const { configProvider } = useWallet();
  const { sendCalls: copy, sendTransaction: txCopy } = style.copy;
  const relayerCopy = style.copy.relayerSubmit;
  const [hostDomain, setHostDomain] = useState(request.domain);

  useEffect(() => {
    void configProvider.getConfig().then((config) => {
      setHostDomain(String(config.hostDomain));
    });
  }, [configProvider]);

  const submit = useRelayerConfirmSubmit<string>({
    execute,
    onResolve,
    onReject,
    rejectMessage: "User rejected the request",
    signingMessage: relayerCopy.signingMessage,
    waitingMessage: relayerCopy.waitingMessage,
    finalFeeNotice: relayerCopy.finalFeeNotice,
  });

  const showActions = submit.phase === "confirm" || submit.phase === "finalFee";

  return (
    <Modal
      title={copy.title}
      onBackdropDismiss={showActions ? submit.cancel : undefined}
      actions={
        showActions
          ? [
              {
                label: copy.rejectLabel,
                variant: "secondary",
                onClick: submit.cancel,
              },
              {
                label: copy.signLabel,
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
      <div className="mb-3 flex">
        <RequestingHostBadge domain={hostDomain} />
      </div>
      <p className="text-muted-foreground mb-3 m-0 text-sm">
        {fill(copy.body, { domain: hostDomain })}
      </p>
      <FieldLabel>{txCopy.accountLabel}</FieldLabel>
      <p className="mb-3 break-all font-mono text-[0.8rem]">
        {request.account}
      </p>
      <LabeledBlock label={txCopy.chainLabel} content={request.chainName} />
      <ul className="m-0 list-none p-0">
        {request.calls.map((call, index) => (
          <li key={`${call.to}-${index}`} className="mt-3">
            <FieldLabel>
              {fill(copy.callLabel, { index: String(index + 1) })}
            </FieldLabel>
            {call.summary ? (
              <p className="m-0 text-sm">{call.summary}</p>
            ) : null}
            <LabeledBlock label={txCopy.contractLabel} content={call.to} />
            {hasNativeValue(call.value) ? (
              <LabeledBlock label={txCopy.valueLabel} content={call.value} />
            ) : null}
            {call.summary ? null : (
              <LabeledBlock label={txCopy.dataLabel} content={call.data} />
            )}
          </li>
        ))}
      </ul>
      <RelayerConfirmModalChrome
        chainId={request.chainId as EVMChainId}
        ownerAddress={request.account as EVMAccountAddress}
        work={request.work}
        submit={submit}
      />
    </Modal>
  );
}
