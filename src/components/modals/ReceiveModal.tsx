import { Modal } from "../Modal";
import { QRCode } from "../QRCode";
import { CopyableText } from "../CopyableText";
import { useStyle } from "../../style";

export interface IReceiveModalProps {
  address: string;
  chainLabel: string;
  onClose: () => void;
}

/**
 * Show the wallet address for the current chain as a QR + full copyable text.
 */
export function ReceiveModal({
  address,
  chainLabel,
  onClose,
}: IReceiveModalProps) {
  const { style } = useStyle();
  const { balances: copy } = style.copy;
  const hasAddress = Boolean(address) && address !== "—";

  return (
    <Modal
      title={copy.receiveTitle}
      onBackdropDismiss={onClose}
      actions={[
        {
          label: copy.receiveCloseLabel,
          variant: "primary",
          autoFocus: true,
          onClick: onClose,
        },
      ]}
    >
      <p className="text-muted-foreground m-0">
        {copy.receiveBody.replace("{chainLabel}", chainLabel)}
      </p>
      <div className="mt-4 flex flex-col items-center gap-4">
        <QRCode
          value={hasAddress ? address : ""}
          size={200}
          alt={copy.receiveQrAlt.replace("{chainLabel}", chainLabel)}
        />
        <div className="flex w-full min-w-0 flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {copy.receiveAddressLabel}
          </span>
          <CopyableText
            text={hasAddress ? address : "—"}
            disabled={!hasAddress}
            copyLabel={copy.receiveCopyLabel}
            copiedLabel={copy.receiveCopiedLabel}
            copyFailedLabel={copy.receiveCopyFailedLabel}
          />
        </div>
      </div>
    </Modal>
  );
}
