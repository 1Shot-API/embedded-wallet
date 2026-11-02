import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useStyle } from "../../style/StyleProvider";
import { Modal } from "../Modal";

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
