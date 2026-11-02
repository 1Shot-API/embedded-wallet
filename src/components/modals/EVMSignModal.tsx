import type { PersonalSignApprovalRequest } from "@1shotapi/ows-signer-utils";
import {
  ChainUtils,
  OwsUserRejectedError,
  type EVMSignatureHex,
} from "@1shotapi/ows-types";
import { useEffect, useRef, useState } from "react";

import { formatMessageForDisplay } from "../../lib/utils/formatMessageForDisplay";
import { isSignCeremonyDenied } from "../../lib/utils/isSignCeremonyDenied";
import { useStyle } from "../../style/StyleProvider";
import { useWalletSessionStore } from "../../wallet/sessionStore";
import { useWallet } from "../../wallet/WalletProvider";
import { CopyableText } from "../CopyableText";
import { Modal } from "../Modal";

import { DetailBlock } from "./DetailBlock";
import { FieldLabel } from "./FieldLabel";
import { NetworkIdentityMark } from "./NetworkIdentityMark";

/** Host EIP-1193 `personal_sign` consent. */
export function EVMSignModal({
  request,
  onResolve,
  onReject,
}: {
  request: PersonalSignApprovalRequest;
  onResolve: (signature: EVMSignatureHex) => void;
  onReject: (error: unknown) => void;
}) {
  const { getSigner, resolveChain, configProvider } = useWallet();
  const { style } = useStyle();
  const { personalSign, account: accountCopy } = style.copy;
  const [phase, setPhase] = useState<"confirm" | "signing">("confirm");
  const [hostDomain, setHostDomain] = useState("");
  /** Bumped on cancel and each startSign so stale in-flight ops cannot settle. */
  const signGenerationRef = useRef(0);

  useEffect(() => {
    void configProvider.getConfig().then((config) => {
      setHostDomain(String(config.hostDomain));
    });
  }, [configProvider]);

  const sessionChainId = useWalletSessionStore((state) => state.chainId);
  const chain = ChainUtils.isEVMChainId(sessionChainId)
    ? resolveChain(sessionChainId)
    : null;
  const networkDisplay = chain?.label ?? "Ethereum";
  const body = personalSign.body.replaceAll(
    "{domain}",
    hostDomain.trim() || "This site",
  );

  const cancel = () => {
    signGenerationRef.current += 1;
    onReject(new OwsUserRejectedError("User rejected the signing request"));
  };

  const startSign = () => {
    const generation = ++signGenerationRef.current;
    setPhase("signing");
    void (async () => {
      const signer = getSigner();
      if (!signer) {
        throw new Error("Signer not ready");
      }
      const [signature] = await signer.evm.signMessage([request.message]);
      if (signGenerationRef.current !== generation) return;
      onResolve(signature!);
    })().catch((error: unknown) => {
      if (signGenerationRef.current !== generation) return;
      if (isSignCeremonyDenied(error)) {
        setPhase("confirm");
        return;
      }
      onReject(error);
    });
  };

  return (
    <Modal
      title={personalSign.title}
      onBackdropDismiss={phase === "confirm" ? cancel : undefined}
      actions={
        phase === "confirm"
          ? [
              {
                label: personalSign.rejectLabel,
                variant: "secondary",
                onClick: cancel,
              },
              {
                label: personalSign.signLabel,
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
            <NetworkIdentityMark
              label={networkDisplay}
              logoUrl={chain?.logoUrl}
              size="sm"
            />
            <span
              className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide"
              title={personalSign.networkLabel}
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
          <FieldLabel>{personalSign.accountLabel}</FieldLabel>
          <CopyableText
            text={String(request.address)}
            truncate
            copyLabel={accountCopy.copyAddressLabel}
            copiedLabel={accountCopy.addressCopiedLabel}
            copyFailedLabel={accountCopy.addressCopyFailedLabel}
          />
        </div>

        <div>
          <FieldLabel>{personalSign.messageLabel}</FieldLabel>
          <DetailBlock content={formatMessageForDisplay(request.message)} />
        </div>
      </div>
      {phase === "signing" ? (
        <p className="text-muted-foreground mt-4 m-0 text-[0.9rem]">
          {personalSign.signingHint}
        </p>
      ) : null}
    </Modal>
  );
}
