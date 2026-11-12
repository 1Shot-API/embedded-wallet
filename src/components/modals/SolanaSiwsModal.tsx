import {
  OwsUserRejectedError,
  type DomainString,
  type SolanaSignature,
} from "@1shotapi/ows-types";
import { useRef, useState } from "react";

import { UNKNOWN_HOST_DOMAIN } from "../../lib/implementations/utils/HostOriginProvider";
import type { ISiwsFields } from "../../lib/types/domain/SiwsFields";
import { isSignCeremonyDenied } from "../../lib/utils/isSignCeremonyDenied";
import {
  isSiweUriRedundant,
  siweDomainMatchesHost,
} from "../../lib/utils/siweDisplay";
import { useStyle } from "../../style/StyleProvider";
import { useWallet } from "../../wallet/WalletProvider";
import { CopyableText } from "../CopyableText";
import { Modal } from "../Modal";
import { RiskWarning } from "../RiskWarning";
import { SafeAssetImage } from "../SafeAssetImage";

import { RequestingHostBadge } from "./RequestingHostBadge";
import { SignInMetadataRow } from "./SignInMetadataRow";
import { SignInSectionLabel } from "./SignInSectionLabel";

/** Host/Standard `solana:signIn` (SIWS) consent — structured fields, not raw bytes. */
export function SolanaSiwsModal({
  fields,
  hostDomain,
  messageBytes,
  onResolve,
  onReject,
}: {
  fields: ISiwsFields;
  /** Browser-attested requester, never the message's own `domain`. */
  hostDomain: DomainString;
  messageBytes: Uint8Array;
  onResolve: (signature: SolanaSignature) => void;
  onReject: (error: unknown) => void;
}) {
  const { getSigner, resolveChain } = useWallet();
  const { style } = useStyle();
  const { siws, account: accountCopy } = style.copy;
  const [phase, setPhase] = useState<"confirm" | "signing">("confirm");
  const signGenerationRef = useRef(0);

  const body = siws.body.replaceAll("{domain}", hostDomain);
  const domainMismatch =
    hostDomain === UNKNOWN_HOST_DOMAIN ||
    !siweDomainMatchesHost(fields.domain, hostDomain);
  const domainMismatchWarning = siws.domainMismatchWarning
    .replaceAll("{domain}", fields.domain)
    .replaceAll("{host}", hostDomain);
  const chain = resolveChain(fields.chainId);
  const networkDisplay = chain?.label ?? String(fields.chainId);
  const showUri =
    Boolean(fields.uri?.trim()) &&
    !isSiweUriRedundant(fields.uri, fields.domain);
  const statement = fields.statement?.trim();

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
      const [signature] = await signer.solana.signMessage([messageBytes]);
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
      title={siws.title}
      onBackdropDismiss={phase === "confirm" ? cancel : undefined}
      actions={
        phase === "confirm"
          ? [
              {
                label: siws.rejectLabel,
                variant: "secondary",
                onClick: cancel,
              },
              {
                label: siws.signLabel,
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

        <div className="flex items-center justify-between gap-3">
          <div className="flex shrink-0 items-center gap-2">
            {chain?.logoUrl ? (
              <SafeAssetImage
                src={chain.logoUrl}
                alt=""
                className="size-5 rounded-full"
              />
            ) : null}
            <span
              className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide"
              title={siws.networkLabel}
            >
              {networkDisplay}
            </span>
          </div>
          <RequestingHostBadge domain={hostDomain} />
        </div>

        {domainMismatch ? (
          <RiskWarning>{domainMismatchWarning}</RiskWarning>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {siws.signingInWithLabel}
          </span>
          <CopyableText
            text={String(fields.address)}
            truncate
            copyLabel={accountCopy.copyAddressLabel}
            copiedLabel={accountCopy.addressCopiedLabel}
            copyFailedLabel={accountCopy.addressCopyFailedLabel}
          />
        </div>

        <div className="border-border rounded-md border px-3 py-2.5">
          {statement ? (
            <div className="mb-2 last:mb-0">
              <SignInSectionLabel>{siws.messageLabel}</SignInSectionLabel>
              <p className="text-foreground m-0 whitespace-pre-wrap text-sm leading-snug">
                {statement}
              </p>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {showUri ? (
              <SignInMetadataRow
                label={siws.uriLabel}
                value={fields.uri}
                compact
              />
            ) : null}
            {fields.version ? (
              <SignInMetadataRow
                label={siws.versionLabel}
                value={fields.version}
                compact
              />
            ) : null}
            {fields.nonce ? (
              <SignInMetadataRow
                label={siws.nonceLabel}
                value={fields.nonce}
                compact
              />
            ) : null}
            {fields.issuedAt ? (
              <SignInMetadataRow
                label={siws.issuedAtLabel}
                value={fields.issuedAt}
                compact
              />
            ) : null}
            {fields.expirationTime ? (
              <SignInMetadataRow
                label={siws.expirationTimeLabel}
                value={fields.expirationTime}
                compact
              />
            ) : null}
            {fields.notBefore ? (
              <SignInMetadataRow
                label={siws.notBeforeLabel}
                value={fields.notBefore}
                compact
              />
            ) : null}
          </div>
          {fields.resources && fields.resources.length > 0 ? (
            <div className="mt-2 first:mt-0">
              <SignInSectionLabel>{siws.resourcesLabel}</SignInSectionLabel>
              <ul className="text-foreground m-0 list-disc pl-5 text-sm leading-relaxed">
                {fields.resources.map((resource) => (
                  <li key={resource} className="break-all">
                    {resource}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {phase === "signing" ? (
        <p className="text-muted-foreground mt-4 m-0 text-sm">
          {siws.signingHint}
        </p>
      ) : null}
    </Modal>
  );
}
