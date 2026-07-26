import { useStyle } from "../../style/StyleProvider";
import { Modal } from "../Modal";
import type { AdvancedOptionsChoice } from "../../wallet/modalTypes";
import { useWalletSessionStore } from "../../wallet/sessionStore";

/**
 * Chooser for export / import private key (menu + advanced entry points).
 */
export function AdvancedOptionsModal({
  onResolve,
  /** When false, hide Export (e.g. onboarding before unlock). */
  allowExport = true,
}: {
  onResolve: (choice: AdvancedOptionsChoice) => void;
  allowExport?: boolean;
}) {
  const { style } = useStyle();
  const copy = style.copy.advancedOptions;
  const unlocked = useWalletSessionStore((state) => state.unlocked);
  const showExport = allowExport && unlocked;

  return (
    <Modal
      title={copy.title}
      onBackdropDismiss={() => onResolve("close")}
      actions={[
        {
          label: copy.closeLabel,
          variant: "secondary",
          onClick: () => onResolve("close"),
        },
      ]}
    >
      <p className="text-muted-foreground mb-4 m-0 text-[0.9rem]">{copy.body}</p>
      <div className="flex flex-col gap-2">
        {showExport ? (
          <button
            type="button"
            className="border-border bg-background hover:bg-muted text-foreground rounded-md border px-3 py-2.5 text-left text-[0.9rem] font-medium"
            onClick={() => onResolve("export")}
          >
            {copy.exportLabel}
          </button>
        ) : null}
        <button
          type="button"
          className="border-border bg-background hover:bg-muted text-foreground rounded-md border px-3 py-2.5 text-left text-[0.9rem] font-medium"
          onClick={() => onResolve("import")}
        >
          {copy.importLabel}
        </button>
      </div>
    </Modal>
  );
}
