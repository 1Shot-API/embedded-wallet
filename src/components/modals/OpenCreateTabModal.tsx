import { Modal } from "../Modal";

/**
 * Shown when window.open is blocked — user must click to open /create.
 */
export function OpenCreateTabModal({
  createUrl,
  onResolve,
}: {
  createUrl: string;
  onResolve: (opened: boolean) => void;
}) {
  return (
    <Modal
      title="Create account"
      presentation="overlay"
      onBackdropDismiss={() => onResolve(false)}
      actions={[
        {
          label: "Cancel",
          variant: "secondary",
          onClick: () => onResolve(false),
        },
        {
          label: "Open create page",
          variant: "primary",
          autoFocus: true,
          onClick: () => onResolve(true),
        },
      ]}
    >
      <p className="text-muted-foreground m-0 text-[0.9rem]">
        Your browser blocked the account creation page. Allow pop-ups for this
        site, then open the create page to continue.
      </p>
      <p className="text-muted-foreground mt-3 m-0 break-all font-mono text-[0.75rem]">
        {createUrl}
      </p>
    </Modal>
  );
}
