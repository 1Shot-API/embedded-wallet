import { useEffect, useRef, useState } from "react";
import type { RecoveryDataCreatedData } from "@1shotapi/ows-types";
import { useStyle } from "../../style/StyleProvider";
import type {
  IStyleCopyCreateBackup,
  IStyleCopyRestoreBackup,
} from "../../style/types";
import { CopyableText } from "../CopyableText";
import { Modal } from "../Modal";
import { useWallet } from "../../wallet/WalletProvider";

const DEFAULT_MIN_PASSWORD_LENGTH = 12;

const CREATE_BACKUP_MIN_LENGTH_VARS = {
  minLength: String(DEFAULT_MIN_PASSWORD_LENGTH),
};

function fillTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => vars[key] ?? "");
}

function formatBackupError(
  error: unknown,
  copy: IStyleCopyCreateBackup,
): string {
  if (error instanceof Error) {
    const message = error.message;
    if (message.includes("passwordTooShort")) {
      return copy.passwordTooShortError;
    }
    if (
      error.name === "OwsSignDeniedError" ||
      message.includes("signDenied") ||
      message.includes("SignDenied")
    ) {
      return copy.cancelledError;
    }
    if (message.includes("NotAllowed") || message.includes("not allowed")) {
      return copy.cancelledError;
    }
    return message || copy.failedError;
  }
  return copy.failedError;
}

function formatRestoreError(
  error: unknown,
  copy: IStyleCopyRestoreBackup,
): string {
  if (error instanceof Error) {
    const message = error.message;
    if (
      message.includes("decryptionFailed") ||
      message.includes("decrypt") ||
      message.includes("OperationError")
    ) {
      return copy.decryptFailedError;
    }
    if (
      error.name === "OwsSignDeniedError" ||
      message.includes("signDenied") ||
      message.includes("SignDenied")
    ) {
      return copy.cancelledError;
    }
    if (message.includes("NotAllowed") || message.includes("not allowed")) {
      return copy.cancelledError;
    }
    return message || copy.failedError;
  }
  return copy.failedError;
}

export function CreateBackupModal({
  onResolve,
  onReject,
}: {
  onResolve: () => void;
  onReject: (error: unknown) => void;
}) {
  const { getSigner, persistBackup } = useWallet();
  const { style } = useStyle();
  const createBackup = style.copy.createBackup;
  const backupPrompt = style.copy.passkeyPrompt.backup;
  const [phase, setPhase] = useState<"prompt" | "result" | "error">("prompt");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecoveryDataCreatedData | null>(null);
  const abortedRef = useRef(false);

  useEffect(() => {
    abortedRef.current = false;

    void (async () => {
      try {
        // No separate unlock — createRecoveryData is the sole passkey ceremony.
        const signer = getSigner();
        if (!signer) {
          throw new Error("Signer not ready for backup");
        }

        const created = await signer.createRecoveryData(
          fillTemplate(createBackup.passphrasePrompt, CREATE_BACKUP_MIN_LENGTH_VARS),
          createBackup.continueLabel,
          DEFAULT_MIN_PASSWORD_LENGTH,
          {
            explanationHeader: backupPrompt.title,
            explanationText: backupPrompt.body,
          },
        );

        if (abortedRef.current) return;

        await persistBackup(created.encryptedPrivateKey);
        if (abortedRef.current) return;

        setResult(created);
        setPhase("result");
      } catch (err) {
        if (abortedRef.current) return;
        setError(formatBackupError(err, createBackup));
        setPhase("error");
      }
    })().catch((err: unknown) => {
      if (abortedRef.current) return;
      onReject(err);
    });

    return () => {
      abortedRef.current = true;
    };
    // Signing path runs once per modal open. Copy is snapshotted from
    // StyleContext at mount; do not re-run when setStyle patches arrive mid-flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [getSigner, onReject, persistBackup]);

  if (phase === "result" && result) {
    return (
      <Modal
        title={createBackup.title}
        actions={[
          {
            label: createBackup.doneLabel,
            variant: "primary",
            autoFocus: true,
            onClick: onResolve,
          },
        ]}
      >
        <p className="text-muted-foreground mb-1 text-[0.8rem] font-medium">
          {createBackup.encryptedLabel}
        </p>
        <CopyableText
          text={result.encryptedPrivateKey}
          copyLabel={createBackup.copyLabel}
          copiedLabel={createBackup.copiedLabel}
          copyFailedLabel={createBackup.copyFailedLabel}
        />
      </Modal>
    );
  }

  return (
    <Modal
      title={createBackup.title}
      onBackdropDismiss={phase === "error" ? onResolve : undefined}
      actions={
        phase === "error" || phase === "prompt"
          ? [
              {
                label:
                  phase === "error"
                    ? createBackup.closeLabel
                    : createBackup.cancelLabel,
                variant: "secondary",
                autoFocus: phase === "error",
                onClick: onResolve,
              },
            ]
          : undefined
      }
    >
      {phase === "prompt" ? (
        <p className="mb-4">
          {fillTemplate(createBackup.body, CREATE_BACKUP_MIN_LENGTH_VARS)}
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive m-0 text-[0.9rem]">{error}</p>
      ) : null}
    </Modal>
  );
}

export function RestoreBackupModal({
  encryptedPrivateKey,
  onResolve,
  onReject,
}: {
  encryptedPrivateKey: string;
  onResolve: (restored: boolean) => void;
  onReject: (error: unknown) => void;
}) {
  const { getSigner, awaitSignerReady } = useWallet();
  const { style } = useStyle();
  const restoreBackup = style.copy.restoreBackup;
  const unlockPrompt = style.copy.passkeyPrompt.unlock;
  const [phase, setPhase] = useState<"prompt" | "done" | "error">("prompt");
  const [error, setError] = useState<string | null>(null);
  const abortedRef = useRef(false);

  useEffect(() => {
    abortedRef.current = false;

    void (async () => {
      try {
        await awaitSignerReady();
        if (abortedRef.current) return;

        const signer = getSigner();
        if (!signer) {
          throw new Error("Signer not ready for restore");
        }

        await signer.recoverKey(
          encryptedPrivateKey,
          restoreBackup.passphraseLabel,
          restoreBackup.restoreLabel,
          {
            explanationHeader: unlockPrompt.title,
            explanationText: unlockPrompt.body,
          },
        );
        if (abortedRef.current) return;
        setPhase("done");
      } catch (err) {
        if (abortedRef.current) return;
        setError(formatRestoreError(err, restoreBackup));
        setPhase("error");
      }
    })().catch((err: unknown) => {
      if (abortedRef.current) return;
      onReject(err);
    });

    return () => {
      abortedRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [awaitSignerReady, encryptedPrivateKey, getSigner, onReject]);

  return (
    <Modal
      title={restoreBackup.title}
      onBackdropDismiss={
        phase === "error" ? () => onResolve(false) : undefined
      }
      actions={
        phase === "done"
          ? [
              {
                label: restoreBackup.doneLabel,
                variant: "primary",
                autoFocus: true,
                onClick: () => onResolve(true),
              },
            ]
          : [
              {
                label:
                  phase === "error"
                    ? restoreBackup.closeLabel
                    : restoreBackup.cancelLabel,
                variant: "secondary",
                autoFocus: phase === "error",
                onClick: () => onResolve(false),
              },
            ]
      }
    >
      {phase === "prompt" ? <p className="mb-4">{restoreBackup.body}</p> : null}
      {phase === "done" ? (
        <p className="m-0">{restoreBackup.successBody}</p>
      ) : null}
      {error ? (
        <p className="text-destructive m-0 text-[0.9rem]">{error}</p>
      ) : null}
    </Modal>
  );
}
