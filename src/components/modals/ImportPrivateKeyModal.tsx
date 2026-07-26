import { useRef, useState } from "react";
import { useStyle } from "../../style/StyleProvider";
import type { IStyleCopyImportPrivateKey } from "../../style/types";
import { Modal } from "../Modal";
import { useWallet } from "../../wallet/WalletProvider";

function formatImportError(
  error: unknown,
  copy: IStyleCopyImportPrivateKey,
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
    if (
      message.includes("invalidPrivateKey") ||
      message.includes("InvalidRequest")
    ) {
      return copy.invalidKeyError;
    }
    if (message.includes("NotAllowed") || message.includes("not allowed")) {
      return copy.cancelledError;
    }
    return message || copy.failedError;
  }
  return copy.failedError;
}

/**
 * Warns the user, then runs Signing Layer `importPrivateKey()` (hex paste UI).
 */
export function ImportPrivateKeyModal({
  onResolve,
  onReject,
}: {
  onResolve: (imported: boolean) => void;
  onReject: (error: unknown) => void;
}) {
  const { getSigner, awaitSignerReady } = useWallet();
  const { style } = useStyle();
  const copy = style.copy.importPrivateKey;
  const [phase, setPhase] = useState<"confirm" | "importing" | "error">(
    "confirm",
  );
  const [error, setError] = useState<string | null>(null);
  const abortedRef = useRef(false);

  const startImport = () => {
    abortedRef.current = false;
    setError(null);
    setPhase("importing");

    void (async () => {
      try {
        await awaitSignerReady();
        if (abortedRef.current) return;

        const signer = getSigner();
        if (!signer) {
          throw new Error("Signer not ready to import private key");
        }

        await signer.importPrivateKey();
        if (abortedRef.current) return;
        onResolve(true);
      } catch (err) {
        if (abortedRef.current) return;
        setError(formatImportError(err, copy));
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
      onBackdropDismiss={
        phase === "error" ? () => onResolve(false) : undefined
      }
      actions={
        phase === "confirm"
          ? [
              {
                label: copy.cancelLabel,
                variant: "secondary",
                onClick: () => onResolve(false),
              },
              {
                label: copy.continueLabel,
                variant: "primary",
                autoFocus: true,
                onClick: startImport,
              },
            ]
          : phase === "error"
            ? [
                {
                  label: copy.closeLabel,
                  variant: "secondary",
                  autoFocus: true,
                  onClick: () => onResolve(false),
                },
              ]
            : undefined
      }
    >
      {phase === "confirm" || phase === "importing" ? (
        <p className="mb-4 whitespace-pre-line">{copy.body}</p>
      ) : null}
      {phase === "importing" ? (
        <p className="text-muted-foreground m-0 text-[0.9rem]">
          {copy.importingBody}
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive m-0 text-[0.9rem]">{error}</p>
      ) : null}
    </Modal>
  );
}
