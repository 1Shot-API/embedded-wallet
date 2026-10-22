import { useStyle } from "../../style/StyleProvider";
import { Modal } from "../Modal";

export function ConnectModal({
  onResolve,
}: {
  onResolve: (approved: boolean) => void;
}) {
  const { style } = useStyle();
  const { connect } = style.copy;

  return (
    <Modal
      title={connect.title}
      onBackdropDismiss={() => onResolve(false)}
      actions={[
        {
          label: connect.rejectLabel,
          variant: "secondary",
          onClick: () => onResolve(false),
        },
        {
          label: connect.continueLabel,
          variant: "primary",
          autoFocus: true,
          onClick: () => onResolve(true),
        },
      ]}
    >
      <p className="text-muted-foreground m-0">{connect.body}</p>
    </Modal>
  );
}
