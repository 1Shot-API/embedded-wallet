import {
  OwsUserRejectedError,
  type SolanaAccountAddress,
  type SolanaChainId,
  type SolanaSignature,
  type SolanaTransactionSignature,
} from "@1shotapi/ows-types";
import { useEffect, useRef, useState } from "react";

import type { ISolanaTxSummary } from "../../lib/implementations/utils/SolanaTxUtils";
import { isSignCeremonyDenied } from "../../lib/utils/isSignCeremonyDenied";
import { useStyle } from "../../style/StyleProvider";
import type { ESolanaTxConsentMode } from "../../wallet/modalTypes";
import { useWallet } from "../../wallet/WalletProvider";
import { CopyableText } from "../CopyableText";
import { Modal } from "../Modal";
import { SafeAssetImage } from "../SafeAssetImage";

import { FieldLabel } from "./FieldLabel";

/**
 * Host/Standard `solana:signTransaction` / `solana:signAndSendTransaction`
 * consent — instruction summary, optional sim/nonce warnings, then ceremony.
 */
export function SolanaSignAndSendModal({
  mode,
  chainId,
  address,
  summaries,
  messageBytesList,
  warnings,
  submit,
  onResolve,
  onReject,
}: {
  mode: ESolanaTxConsentMode;
  chainId: SolanaChainId;
  address: SolanaAccountAddress;
  summaries: readonly ISolanaTxSummary[];
  messageBytesList: readonly Uint8Array[];
  warnings: readonly string[];
  submit?: (
    messageBytes: Uint8Array,
    signatureBytes: Uint8Array,
  ) => Promise<SolanaTransactionSignature>;
  onResolve: (value: SolanaSignature[] | SolanaTransactionSignature) => void;
  onReject: (error: unknown) => void;
}) {
  const { getSigner, resolveChain, configProvider } = useWallet();
  const { style } = useStyle();
  const { solanaSignAndSend, account: accountCopy } = style.copy;
  const [phase, setPhase] = useState<"confirm" | "signing" | "submitting">(
    "confirm",
  );
  const [hostDomain, setHostDomain] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const signGenerationRef = useRef(0);

  useEffect(() => {
    void configProvider.getConfig().then((config) => {
      setHostDomain(String(config.hostDomain));
    });
  }, [configProvider]);

  const chain = resolveChain(chainId);
  const networkDisplay = chain?.label ?? String(chainId);
  const isSend = mode === "signAndSend";
  const title = isSend
    ? solanaSignAndSend.titleSignAndSend
    : solanaSignAndSend.titleSign;
  const bodyTemplate = isSend
    ? solanaSignAndSend.bodySignAndSend
    : solanaSignAndSend.bodySign;
  const body = bodyTemplate.replaceAll(
    "{domain}",
    hostDomain.trim() || "This site",
  );
  const primaryLabel = isSend
    ? solanaSignAndSend.signAndSendLabel
    : solanaSignAndSend.signLabel;

  const cancel = () => {
    signGenerationRef.current += 1;
    onReject(new OwsUserRejectedError("User rejected the signing request"));
  };

  const startSign = () => {
    const generation = ++signGenerationRef.current;
    setSubmitError(null);
    setPhase("signing");
    void (async () => {
      const signer = getSigner();
      if (!signer) {
        throw new Error("Signer not ready");
      }
      const signed = await signer.solana.signTransaction(
        messageBytesList.map((messageBytes) => ({ messageBytes })),
      );
      if (signGenerationRef.current !== generation) return;

      if (!isSend) {
        onResolve(signed.map((entry) => entry.signature));
        return;
      }

      if (!submit) {
        throw new Error("Missing submit handler for signAndSend");
      }
      const first = signed[0];
      const messageBytes = messageBytesList[0];
      if (!first || !messageBytes) {
        throw new Error("Missing signed transaction");
      }
      setPhase("submitting");
      const txSignature = await submit(messageBytes, first.signatureBytes);
      if (signGenerationRef.current !== generation) return;
      onResolve(txSignature);
    })().catch((error: unknown) => {
      if (signGenerationRef.current !== generation) return;
      if (isSignCeremonyDenied(error)) {
        setPhase("confirm");
        return;
      }
      if (isSend) {
        setSubmitError(
          error instanceof Error ? error.message : "Transaction submit failed",
        );
        setPhase("confirm");
        return;
      }
      onReject(error);
    });
  };

  return (
    <Modal
      title={title}
      onBackdropDismiss={phase === "confirm" ? cancel : undefined}
      actions={
        phase === "confirm"
          ? [
              {
                label: solanaSignAndSend.rejectLabel,
                variant: "secondary",
                onClick: cancel,
              },
              {
                label: primaryLabel,
                variant: "primary",
                autoFocus: true,
                onClick: startSign,
              },
            ]
          : undefined
      }
    >
      <div className="text-foreground flex flex-col gap-4">
        <p className="text-muted-foreground m-0 text-sm leading-relaxed text-pretty">
          {body}
        </p>

        <div
          className={`flex items-center gap-3 ${hostDomain.trim() ? "justify-between" : "justify-start"}`}
        >
          <div className="flex shrink-0 items-center gap-2">
            {chain?.logoUrl ? (
              <SafeAssetImage
                src={chain.logoUrl}
                alt=""
                className="size-12 rounded-full object-cover"
              />
            ) : null}
            <span
              className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide"
              title={solanaSignAndSend.networkLabel}
            >
              {networkDisplay}
            </span>
          </div>
          {hostDomain.trim() ? (
            <span
              className="border-border text-foreground min-w-0 max-w-[55%] truncate rounded-full border px-2.5 py-1 text-sm font-medium"
              title={hostDomain}
            >
              {hostDomain}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>{solanaSignAndSend.accountLabel}</FieldLabel>
          <CopyableText
            text={String(address)}
            truncate
            copyLabel={accountCopy.copyAddressLabel}
            copiedLabel={accountCopy.addressCopiedLabel}
            copyFailedLabel={accountCopy.addressCopyFailedLabel}
          />
        </div>

        {summaries.map((summary, index) => (
          <div key={index} className="flex flex-col gap-2">
            {summaries.length > 1 ? (
              <p className="text-muted-foreground m-0 text-xs font-medium">
                Transaction {index + 1} of {summaries.length}
              </p>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <FieldLabel>{solanaSignAndSend.feePayerLabel}</FieldLabel>
              <CopyableText
                text={String(summary.feePayer)}
                truncate
                copyLabel={accountCopy.copyAddressLabel}
                copiedLabel={accountCopy.addressCopiedLabel}
                copyFailedLabel={accountCopy.addressCopyFailedLabel}
              />
            </div>
            <div>
              <FieldLabel>{solanaSignAndSend.instructionsLabel}</FieldLabel>
              <ul className="border-border m-0 list-none rounded-lg border p-3 pl-3">
                {summary.instructions.map((ix, ixIndex) => (
                  <li
                    key={ixIndex}
                    className="text-foreground border-border border-b py-1.5 text-sm last:border-b-0"
                  >
                    {ix.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}

        {warnings.length > 0 ? (
          <div className="border-border bg-muted/40 flex flex-col gap-2 rounded-lg border p-3">
            {warnings.map((warning) => (
              <p
                key={warning}
                className="text-foreground m-0 text-sm leading-relaxed"
              >
                {warning}
              </p>
            ))}
          </div>
        ) : null}

        {submitError ? (
          <p className="text-destructive m-0 text-sm leading-relaxed">
            {submitError}
          </p>
        ) : null}
      </div>

      {phase === "signing" ? (
        <p className="text-muted-foreground mt-4 m-0 text-[0.9rem]">
          {solanaSignAndSend.signingHint}
        </p>
      ) : null}
      {phase === "submitting" ? (
        <p className="text-muted-foreground mt-4 m-0 text-[0.9rem]">
          {solanaSignAndSend.submittingHint}
        </p>
      ) : null}
    </Modal>
  );
}
