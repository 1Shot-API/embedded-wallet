import { OwsUserRejectedError } from "@1shotapi/ows-types";

import { Modal } from "../Modal";

/** Confirm a WalletConnect Bitcoin signature before the passkey ceremony. */
export function BitcoinHostSignModal({
  title,
  body,
  network,
  outputs,
  fee,
  signerAddress,
  onResolve,
  onReject,
}: {
  title: string;
  body: string;
  network?: { name: string; testnet: boolean };
  outputs?: Array<{ address: string; amount?: string; label?: string }>;
  fee?: string;
  signerAddress?: string;
  onResolve: () => void;
  onReject: (error: unknown) => void;
}) {
  const cancel = () => {
    onReject(new OwsUserRejectedError("User rejected the signing request"));
  };
  return (
    <Modal
      title={title}
      onBackdropDismiss={cancel}
      actions={[
        { label: "Cancel", onClick: cancel, variant: "secondary" },
        { label: "Confirm", onClick: onResolve, variant: "primary", autoFocus: true },
      ]}
    >
      {network ? (
        <p
          className={
            network.testnet
              ? "inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900"
              : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-800"
          }
        >
          {network.name}
        </p>
      ) : null}
      {signerAddress ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Address
          </p>
          <p className="break-all text-xs text-muted-foreground">{signerAddress}</p>
        </div>
      ) : null}
      {body ? (
        <p className="mt-4 max-h-64 overflow-y-auto whitespace-pre-wrap break-all text-sm text-muted-foreground">
          {body}
        </p>
      ) : null}
      {outputs && outputs.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {outputs.map((output, index) => (
            <li key={`${output.label ?? "to"}-${output.address}-${index}`}>
              {output.amount ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Amount
                  </p>
                  <p className="text-sm font-medium">{output.amount}</p>
                </>
              ) : null}
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {output.label ?? "To"}
              </p>
              <p className="break-all text-xs text-muted-foreground">{output.address}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {fee ? (
        <p className="mt-4 text-sm text-muted-foreground">Fee {fee}</p>
      ) : null}
    </Modal>
  );
}
