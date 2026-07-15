import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStyle } from "../../style";
import { Modal } from "../Modal";
import type { WalletSetupChoice } from "../../wallet/modalTypes";

export function WalletSetupModal({
  onResolve,
}: {
  onResolve: (choice: WalletSetupChoice) => void;
}) {
  const { style } = useStyle();
  const { walletSetup } = style.copy;

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
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(passkeyName.emptyError);
      return;
    }
    onResolve(trimmed);
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
              submit();
            }
          }}
        />
      </div>
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
