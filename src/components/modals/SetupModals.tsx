import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStyle } from "../../style/StyleProvider";
import { Modal } from "../Modal";
import type { WalletSetupChoice } from "../../wallet/modalTypes";

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

export function PasskeyNameModal({
  onResolve,
}: {
  onResolve: (name: string | null) => void;
}) {
  const { style } = useStyle();
  const { passkeyName } = style.copy;
  const [name, setName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const canContinue = trimmedName.length > 0 && termsAccepted;

  const submit = () => {
    if (!trimmedName) {
      setError(passkeyName.emptyError);
      return;
    }
    if (!termsAccepted) {
      setError(passkeyName.termsAcceptanceError);
      return;
    }
    onResolve(trimmedName);
  };

  return (
    <Modal
      title={passkeyName.title}
      onBackdropDismiss={() => onResolve(null)}
      actions={[
        {
          label: passkeyName.cancelLabel,
          variant: "secondary",
          onClick: () => onResolve(null),
        },
        {
          label: passkeyName.continueLabel,
          variant: "primary",
          disabled: !canContinue,
          onClick: submit,
        },
      ]}
    >
      <p className="text-muted-foreground mb-3">{passkeyName.body}</p>
      <div className="grid gap-1.5">
        <Label htmlFor="passkey-name">{passkeyName.fieldLabel}</Label>
        <Input
          id="passkey-name"
          autoFocus
          type="text"
          autoComplete="username"
          placeholder={passkeyName.placeholder}
          maxLength={64}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (canContinue) {
                submit();
              }
            }
          }}
        />
      </div>
      <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-left">
        <input
          type="checkbox"
          className="border-input bg-background text-primary mt-0.5 size-4 shrink-0 rounded border accent-[var(--primary)]"
          checked={termsAccepted}
          onChange={(event) => {
            setTermsAccepted(event.target.checked);
            setError(null);
          }}
        />
        <span className="text-muted-foreground text-[0.85rem] leading-snug">
          {passkeyName.termsAcceptancePrefix}{" "}
          <a
            href={passkeyName.termsOfServiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {passkeyName.termsOfServiceLabel}
          </a>{" "}
          {passkeyName.termsAcceptanceJoiner}{" "}
          <a
            href={passkeyName.privacyPolicyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {passkeyName.privacyPolicyLabel}
          </a>
        </span>
      </label>
      {error ? (
        <p className="text-destructive m-0 mt-2 text-[0.85rem]">{error}</p>
      ) : null}
    </Modal>
  );
}

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
