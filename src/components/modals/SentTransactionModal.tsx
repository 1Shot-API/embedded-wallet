import type { EVMChainId, EVMTransactionHash } from "@1shotapi/ows-types";
import { demoTxExplorerUrl } from "../../ows/demoChains";
import { useStyle } from "../../style";
import { CopyableText } from "../CopyableText";
import { Modal } from "../Modal";

export interface ISentTransactionModalProps {
  chainId: EVMChainId;
  transactionHash: EVMTransactionHash;
  onClose: () => void;
}

/**
 * Confirmation after an in-wallet send. Host EIP-1193 sends do not use this —
 * they surface the hash in the host app instead.
 */
export function SentTransactionModal({
  chainId,
  transactionHash,
  onClose,
}: ISentTransactionModalProps) {
  const { style } = useStyle();
  const copy = style.copy.transferTokens;
  const explorerUrl = demoTxExplorerUrl(chainId, transactionHash);

  return (
    <Modal
      title={copy.sentTitle}
      onBackdropDismiss={onClose}
      actions={[
        {
          label: copy.doneLabel,
          variant: "primary",
          autoFocus: true,
          onClick: onClose,
        },
      ]}
    >
      <p className="text-muted-foreground m-0">{copy.sentBody}</p>
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {copy.hashLabel}
          </span>
          <CopyableText
            text={transactionHash}
            truncate
            copyLabel={copy.copyHashLabel}
            copiedLabel={copy.hashCopiedLabel}
            copyFailedLabel={copy.hashCopyFailedLabel}
          />
        </div>
        {explorerUrl ? (
          <p className="text-muted-foreground m-0 text-sm">
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              {copy.viewOnExplorerLabel}
            </a>
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
