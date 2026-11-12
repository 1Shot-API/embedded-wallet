import { useStyle } from "../../style/StyleProvider";
import type { IShowCallsStatusRequest } from "../../wallet/modalTypes";
import { Modal } from "../Modal";

import { FieldLabel } from "./FieldLabel";
import { LabeledBlock } from "./LabeledBlock";

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

function statusLabel(
  status: IShowCallsStatusRequest["status"],
  copy: {
    pendingLabel: string;
    confirmedLabel: string;
    failedLabel: string;
    revertedLabel: string;
  },
): string {
  if (status === 200) return copy.confirmedLabel;
  if (status === 400) return copy.failedLabel;
  if (status === 500) return copy.revertedLabel;
  return copy.pendingLabel;
}

/** Read-only EIP-5792 `wallet_showCallsStatus` modal. */
export function ShowCallsStatusModal({
  request,
  onResolve,
}: {
  request: IShowCallsStatusRequest;
  onResolve: (value: null) => void;
}) {
  const { style } = useStyle();
  const copy = style.copy.showCallsStatus;
  const txCopy = style.copy.sendTransaction;
  const close = () => onResolve(null);

  return (
    <Modal
      title={copy.title}
      onBackdropDismiss={close}
      actions={[
        {
          label: copy.closeLabel,
          variant: "primary",
          autoFocus: true,
          onClick: close,
        },
      ]}
    >
      <LabeledBlock
        label={txCopy.chainLabel}
        content={request.chainName}
      />
      <LabeledBlock
        label="Status"
        content={statusLabel(request.status, copy)}
      />
      {request.transactionHash ? (
        <LabeledBlock label="Transaction" content={request.transactionHash} />
      ) : null}
      <ul className="m-0 list-none p-0">
        {request.calls.map((call, index) => (
          <li key={`${call.to}-${index}`} className="mt-3">
            <FieldLabel>
              {fill(copy.callLabel, { index: String(index + 1) })}
            </FieldLabel>
            <p className="m-0 break-all font-mono text-[0.8rem]">{call.to}</p>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
