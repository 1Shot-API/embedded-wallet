import { useRef, useState } from "react";
import { useStyle } from "../../style/StyleProvider";
import type { IStyleCopyExportPrivateKey } from "../../style/types";
import { Modal } from "../Modal";
import { useWallet } from "../../wallet/WalletProvider";

function formatExportError(
  error: unknown,
  copy: IStyleCopyExportPrivateKey,
): string {
  if (error instanceof Error) {
    const message = error.message;
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

/**
 * Warns the user, then runs Signing Layer `revealPrivateKey()` (passkey + key UI).
 */
export function ExportPrivateKeyModal({
  onResolve,
  onReject,
}: {
  onResolve: () => void;
  onReject: (error: unknown) => void;
}) {
  const { getSigner } = useWallet();
  const { style } = useStyle();
  const copy = style.copy.exportPrivateKey;
  const exportPrompt = style.copy.passkeyPrompt.exportPrivateKey;
  const [phase, setPhase] = useState<"confirm" | "revealing" | "error">(
    "confirm",
  );
  const [error, setError] = useState<string | null>(null);
  const abortedRef = useRef(false);

  const startReveal = () => {
    abortedRef.current = false;
    setError(null);
    setPhase("revealing");

    void (async () => {
      try {
        const signer = getSigner();
        if (!signer) {
          throw new Error("Signer not ready to export private key");
        }

        await signer.revealPrivateKey({
          explanationHeader: exportPrompt.title,
          explanationText: exportPrompt.body,
        });

        if (abortedRef.current) return;
        onResolve();
      } catch (err) {
        if (abortedRef.current) return;
        setError(formatExportError(err, copy));
        setPhase("error");
      }
    })().catch((err: unknown) => {
      if (abortedRef.current) return;
      onReject(err);
    });
  };

  return (
    <Modal
      title={copy.title}
      onBackdropDismiss={phase === "error" ? onResolve : undefined}
      actions={
        phase === "confirm"
          ? [
              {
                label: copy.cancelLabel,
                variant: "secondary",
                onClick: onResolve,
              },
              {
                label: copy.continueLabel,
                variant: "primary",
                autoFocus: true,
                onClick: startReveal,
              },
            ]
          : phase === "error"
            ? [
                {
                  label: copy.closeLabel,
                  variant: "secondary",
                  autoFocus: true,
                  onClick: onResolve,
                },
              ]
            : undefined
      }
    >
      {phase === "confirm" || phase === "revealing" ? (
        <p className="mb-4 whitespace-pre-line">{copy.body}</p>
      ) : null}
      {phase === "revealing" ? (
        <p className="text-muted-foreground m-0 text-[0.9rem]">
          {copy.revealingBody}
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive m-0 text-[0.9rem]">{error}</p>
      ) : null}
    </Modal>
  );
}
