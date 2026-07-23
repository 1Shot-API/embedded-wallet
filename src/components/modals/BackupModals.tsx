import { useEffect, useRef, useState } from "react";
import { overlaySignerIframe } from "@1shotapi/ows-signer-utils";
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

const SIGNER_SLOT_CLASS =
  "border-border bg-muted/40 mb-4 min-h-28 overflow-hidden rounded-md border";

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/**
 * Dialog portals content; refs on the footer slot are not always set on the
 * first effect tick. Wait a few frames before treating them as missing.
 */
async function waitForSignerSlot(
  getHome: () => HTMLElement | null,
  getSlot: () => HTMLElement | null,
  isAborted: () => boolean,
): Promise<{ home: HTMLElement; slot: HTMLElement } | null> {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (isAborted()) return null;
    const home = getHome();
    const slot = getSlot();
    if (home && slot) {
      return { home, slot };
    }
    await waitForPaint();
  }
  if (isAborted()) return null;
  const home = getHome();
  const slot = getSlot();
  if (home && slot) {
    return { home, slot };
  }
  return null;
}

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
  const { getSigner, signerContainerRef, ensureReady, persistBackup } =
    useWallet();
  const { style } = useStyle();
  const createBackup = style.copy.createBackup;
  const minLengthVars = {
    minLength: String(DEFAULT_MIN_PASSWORD_LENGTH),
  };
  const signerSlotRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"prompt" | "result" | "error">("prompt");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecoveryDataCreatedData | null>(null);
  const abortedRef = useRef(false);
  const restoreOverlayRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    abortedRef.current = false;

    void (async () => {
      try {
        const nodes = await waitForSignerSlot(
          () => signerContainerRef.current,
          () => signerSlotRef.current,
          () => abortedRef.current,
        );
        if (abortedRef.current) return;
        if (!nodes) {
          onReject(new Error("Signer not ready for backup"));
          return;
        }
        const { home, slot } = nodes;

        // Unlock is usually a no-op here (create only when unlocked); this still
        // waits for Signing Layer load before getSigner().
        await ensureReady();
        if (abortedRef.current) return;

        const signer = getSigner();
        if (!signer) {
          throw new Error("Signer not ready for backup");
        }

        const iframe = home.querySelector("iframe");
        if (!(iframe instanceof HTMLIFrameElement)) {
          throw new Error("Signer iframe not found in signerContainer");
        }

        restoreOverlayRef.current = overlaySignerIframe(iframe, slot, {
          homeContainer: home,
        });
        await waitForPaint();

        const created = await signer.createRecoveryData(
          fillTemplate(createBackup.passphrasePrompt, minLengthVars),
          createBackup.continueLabel,
          DEFAULT_MIN_PASSWORD_LENGTH,
        );

        if (abortedRef.current) return;

        restoreOverlayRef.current?.();
        restoreOverlayRef.current = null;

        await persistBackup(created.encryptedPrivateKey);
        if (abortedRef.current) return;

        setResult(created);
        setPhase("result");
      } catch (err) {
        if (abortedRef.current) return;
        restoreOverlayRef.current?.();
        restoreOverlayRef.current = null;
        setError(formatBackupError(err, createBackup));
        setPhase("error");
      }
    })().catch((err: unknown) => {
      if (abortedRef.current) return;
      restoreOverlayRef.current?.();
      restoreOverlayRef.current = null;
      onReject(err);
    });

    return () => {
      abortedRef.current = true;
      restoreOverlayRef.current?.();
      restoreOverlayRef.current = null;
    };
    // Overlay/signing path runs once per modal open. Copy is snapshotted from
    // StyleContext at mount; do not re-run when setStyle patches arrive mid-flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [
    ensureReady,
    getSigner,
    onReject,
    persistBackup,
    signerContainerRef,
  ]);

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
      footer={
        phase === "prompt" ? (
          <div ref={signerSlotRef} className={SIGNER_SLOT_CLASS} />
        ) : null
      }
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
          {fillTemplate(createBackup.body, minLengthVars)}
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
  const { getSigner, signerContainerRef, awaitSignerReady } = useWallet();
  const { style } = useStyle();
  const restoreBackup = style.copy.restoreBackup;
  const signerSlotRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"prompt" | "done" | "error">("prompt");
  const [error, setError] = useState<string | null>(null);
  const abortedRef = useRef(false);
  const restoreOverlayRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    abortedRef.current = false;

    void (async () => {
      try {
        const nodes = await waitForSignerSlot(
          () => signerContainerRef.current,
          () => signerSlotRef.current,
          () => abortedRef.current,
        );
        if (abortedRef.current) return;
        if (!nodes) {
          onReject(new Error("Signer not ready for restore"));
          return;
        }
        const { home, slot } = nodes;

        // Restore is offered while locked — wait for Signing Layer only.
        // Do not call ensureReady() (that would unlock / run setup first).
        await awaitSignerReady();
        if (abortedRef.current) return;

        const signer = getSigner();
        if (!signer) {
          throw new Error("Signer not ready for restore");
        }

        const iframe = home.querySelector("iframe");
        if (!(iframe instanceof HTMLIFrameElement)) {
          throw new Error("Signer iframe not found in signerContainer");
        }

        restoreOverlayRef.current = overlaySignerIframe(iframe, slot, {
          homeContainer: home,
        });
        await waitForPaint();
        await signer.recoverKey(
          encryptedPrivateKey,
          restoreBackup.passphraseLabel,
          restoreBackup.restoreLabel,
        );
        if (abortedRef.current) return;
        restoreOverlayRef.current?.();
        restoreOverlayRef.current = null;
        setPhase("done");
      } catch (err) {
        if (abortedRef.current) return;
        restoreOverlayRef.current?.();
        restoreOverlayRef.current = null;
        setError(formatRestoreError(err, restoreBackup));
        setPhase("error");
      }
    })().catch((err: unknown) => {
      if (abortedRef.current) return;
      restoreOverlayRef.current?.();
      restoreOverlayRef.current = null;
      onReject(err);
    });

    return () => {
      abortedRef.current = true;
      restoreOverlayRef.current?.();
      restoreOverlayRef.current = null;
    };
    // Overlay/signing path runs once per modal open. Copy is snapshotted from
    // StyleContext at mount; do not re-run when setStyle patches arrive mid-flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [
    awaitSignerReady,
    encryptedPrivateKey,
    getSigner,
    onReject,
    signerContainerRef,
  ]);

  return (
    <Modal
      title={restoreBackup.title}
      onBackdropDismiss={
        phase === "error" ? () => onResolve(false) : undefined
      }
      footer={
        phase === "prompt" ? (
          <div ref={signerSlotRef} className={SIGNER_SLOT_CLASS} />
        ) : null
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
