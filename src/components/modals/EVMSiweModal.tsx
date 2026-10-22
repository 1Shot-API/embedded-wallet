import type {
  PersonalSignApprovalRequest,
  SignTypedDataApprovalRequest,
} from "@1shotapi/ows-signer-utils";
import { OwsUserRejectedError, type EVMSignatureHex } from "@1shotapi/ows-types";
import { useRef, useState } from "react";
import type { TypedDataDefinition } from "viem";

import type { ISiweFields } from "../../lib/types/domain/SiweFields";
import { isSignCeremonyDenied } from "../../lib/utils/isSignCeremonyDenied";
import {
  isSiweUriRedundant,
  resolveSiweEvmChainId,
} from "../../lib/utils/siweDisplay";
import { useStyle } from "../../style/StyleProvider";
import { useWallet } from "../../wallet/WalletProvider";
import { CopyableText } from "../CopyableText";
import { Modal } from "../Modal";

import { NetworkIdentityMark } from "./NetworkIdentityMark";
import { SignInMetadataRow } from "./SignInMetadataRow";
import { SignInSectionLabel } from "./SignInSectionLabel";

/** Host SIWE consent (`personal_sign` or typed-data shaped). */
export function EVMSiweModal({
  source,
  request,
  fields,
  onResolve,
  onReject,
}: {
  source: "typedData" | "personalSign";
  request: SignTypedDataApprovalRequest | PersonalSignApprovalRequest;
  fields: ISiweFields;
  onResolve: (signature: EVMSignatureHex) => void;
  onReject: (error: unknown) => void;
}) {
  const { getSigner, resolveChain } = useWallet();
  const { style } = useStyle();
  const { siwe, account: accountCopy } = style.copy;
  const [phase, setPhase] = useState<"confirm" | "signing">("confirm");
  const signGenerationRef = useRef(0);

  const accountAddress = fields.address?.trim() || String(request.address);
  const body = siwe.body.replaceAll("{domain}", fields.domain);
  const evmChainId = resolveSiweEvmChainId(fields.chainId);
  const chain = evmChainId ? resolveChain(evmChainId) : null;
  const networkDisplay =
    (chain?.label ?? fields.chainId.trim()) || "Unknown network";
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
      let signature: EVMSignatureHex;
      if (source === "typedData") {
        const typed = (request as SignTypedDataApprovalRequest).typedData;
        const [sig] = await signer.evm.signTypedData([
          typed as unknown as TypedDataDefinition,
        ]);
        signature = sig!;
      } else {
        const message = (request as PersonalSignApprovalRequest).message;
        const [sig] = await signer.evm.signMessage([message]);
        signature = sig!;
      }
      if (signGenerationRef.current !== generation) return;
      onResolve(signature);
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
      title={siwe.title}
      onBackdropDismiss={phase === "confirm" ? cancel : undefined}
      actions={
        phase === "confirm"
          ? [
              {
                label: siwe.rejectLabel,
                variant: "secondary",
                onClick: cancel,
              },
              {
                label: siwe.signLabel,
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
          className={`flex items-center gap-3 ${fields.domain.trim() ? "justify-between" : "justify-start"}`}
        >
          <div className="flex shrink-0 items-center gap-2">
            <NetworkIdentityMark
              label={networkDisplay}
              logoUrl={chain?.logoUrl}
              size="sm"
            />
            <span
              className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide"
              title={siwe.networkLabel}
            >
              {networkDisplay}
            </span>
          </div>
          {fields.domain.trim() ? (
            <span
              className="border-border text-foreground min-w-0 max-w-[55%] truncate rounded-full border px-2.5 py-1 text-sm font-medium"
              title={fields.domain}
            >
              {fields.domain}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {siwe.signingInWithLabel}
          </span>
          <CopyableText
            text={accountAddress}
            truncate
            copyLabel={accountCopy.copyAddressLabel}
            copiedLabel={accountCopy.addressCopiedLabel}
            copyFailedLabel={accountCopy.addressCopyFailedLabel}
          />
        </div>

        <div className="border-border rounded-md border px-3 py-2.5">
          {statement ? (
            <div className="mb-2 last:mb-0">
              <SignInSectionLabel>{siwe.messageLabel}</SignInSectionLabel>
              <p className="text-foreground m-0 whitespace-pre-wrap text-sm leading-snug">
                {statement}
              </p>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {showUri ? (
              <SignInMetadataRow
                label={siwe.uriLabel}
                value={fields.uri}
                compact
              />
            ) : null}
            {fields.version ? (
              <SignInMetadataRow
                label={siwe.versionLabel}
                value={fields.version}
                compact
              />
            ) : null}
            {fields.nonce ? (
              <SignInMetadataRow
                label={siwe.nonceLabel}
                value={fields.nonce}
                compact
              />
            ) : null}
            {fields.issuedAt ? (
              <SignInMetadataRow
                label={siwe.issuedAtLabel}
                value={fields.issuedAt}
                compact
              />
            ) : null}
            {fields.expirationTime ? (
              <SignInMetadataRow
                label={siwe.expirationTimeLabel}
                value={fields.expirationTime}
                compact
              />
            ) : null}
            {fields.notBefore ? (
              <SignInMetadataRow
                label={siwe.notBeforeLabel}
                value={fields.notBefore}
                compact
              />
            ) : null}
          </div>
          {fields.resources && fields.resources.length > 0 ? (
            <div className="mt-2 first:mt-0">
              <SignInSectionLabel>{siwe.resourcesLabel}</SignInSectionLabel>
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
          {siwe.signingHint}
        </p>
      ) : null}
    </Modal>
  );
}
