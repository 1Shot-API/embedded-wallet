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
  return (
    <Modal
      title="Set up your wallet"
      onBackdropDismiss={() => onResolve("cancel")}
      actions={[
        {
          label: "Cancel",
          variant: "secondary",
          onClick: () => onResolve("cancel"),
        },
        {
          label: "Login with passkey",
          variant: "primary",
          autoFocus: true,
          onClick: () => onResolve("login"),
        },
        {
          label: "Create account",
          variant: "primary",
          onClick: () => onResolve("create"),
        },
      ]}
    >
      <p className="m-0">
        This wallet uses a passkey to secure your keys on this device. Log in
        with an existing passkey or create a new account before continuing.
      </p>
    </Modal>
  );
}

export function PasskeyNameModal({
  onResolve,
}: {
  onResolve: (name: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name for your passkey.");
      return;
    }
    onResolve(trimmed);
  };

  return (
    <Modal
      title="Name your passkey"
      onBackdropDismiss={() => onResolve(null)}
      actions={[
        {
          label: "Cancel",
          variant: "secondary",
          onClick: () => onResolve(null),
        },
        {
          label: "Continue",
          variant: "primary",
          onClick: submit,
        },
      ]}
    >
      <p className="mb-3">
        Choose a name for this wallet passkey. Your device will use it when you
        create the credential and when you sign in later.
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="passkey-name">Account name</Label>
        <Input
          id="passkey-name"
          autoFocus
          type="text"
          autoComplete="username"
          placeholder="e.g. My wallet"
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
