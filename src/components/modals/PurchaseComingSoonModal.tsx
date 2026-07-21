import { Modal } from "../Modal";

export interface IPurchaseComingSoonModalProps {
  onClose: () => void;
}

/** Placeholder until an onramp provider is integrated. */
export function PurchaseComingSoonModal({
  onClose,
}: IPurchaseComingSoonModalProps) {
  return (
    <Modal
      title="Purchase"
      onBackdropDismiss={onClose}
      actions={[
        {
          label: "OK",
          variant: "primary",
          autoFocus: true,
          onClick: onClose,
        },
      ]}
    >
      <p className="text-muted-foreground m-0">
        Purchase capabilities coming soon
      </p>
    </Modal>
  );
}
