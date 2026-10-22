import { useState } from "react";

import { useStyle } from "../../style/StyleProvider";
import type { WalletSetupChoice } from "../../wallet/modalTypes";
import { Modal } from "../Modal";

export function WalletSetupModal({
  onResolve,
}: {
  onResolve: (choice: WalletSetupChoice) => void;
}) {
  const { style } = useStyle();
  const { walletSetup, advancedOptions } = style.copy;
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <Modal
      title={walletSetup.title}
      onBackdropDismiss={() => onResolve("cancel")}
      actions={[
        {
          label: walletSetup.cancelLabel,
          variant: "secondary",
          onClick: () => onResolve("cancel"),
        },
        {
          label: walletSetup.loginLabel,
          variant: "primary",
          autoFocus: true,
          onClick: () => onResolve("login"),
        },
        {
          label: walletSetup.createLabel,
          variant: "primary",
          onClick: () => onResolve("create"),
        },
      ]}
    >
      <p className="text-muted-foreground m-0">{walletSetup.body}</p>
      {!showAdvanced ? (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground mt-4 text-[0.8rem] underline-offset-2 hover:underline"
          onClick={() => setShowAdvanced(true)}
        >
          {advancedOptions.onboardingLabel}
        </button>
      ) : (
        <div className="border-border mt-4 flex flex-col gap-2 border-t pt-3">
          <p className="text-muted-foreground m-0 text-[0.8rem] leading-snug">
            {advancedOptions.body}
          </p>
          <button
            type="button"
            className="text-foreground hover:bg-muted rounded-md px-2 py-2 text-left text-[0.85rem] font-medium"
            onClick={() => onResolve("import")}
          >
            {advancedOptions.importLabel}
          </button>
        </div>
      )}
    </Modal>
  );
}
