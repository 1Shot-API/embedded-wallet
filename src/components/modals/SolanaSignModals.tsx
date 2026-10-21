import {
  ChainUtils,
  OwsUserRejectedError,
  SOLANA_MAINNET_CHAIN_ID,
  type SolanaAccountAddress,
  type SolanaSignature,
} from "@1shotapi/ows-types";
import { useEffect, useRef, useState } from "react";

import type { ISiwsFields } from "../../lib/types/domain/SiwsFields";
import { isSignCeremonyDenied } from "../../lib/utils/isSignCeremonyDenied";
import { isSiweUriRedundant } from "../../lib/utils/siweDisplay";
import { useStyle } from "../../style/StyleProvider";
import { useWalletSessionStore } from "../../wallet/sessionStore";
import { useWallet } from "../../wallet/WalletProvider";
import { CopyableText } from "../CopyableText";
import { Modal } from "../Modal";
import { SafeAssetImage } from "../SafeAssetImage";

function bytesToDisplay(bytes: Uint8Array): string {
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (isMostlyPrintable(decoded)) {
      return decoded;
    }
  } catch {
    // fall through
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function isMostlyPrintable(text: string): boolean {
  if (!text.trim()) return false;
  let printable = 0;
  let codePoints = 0;
  for (const char of text) {
    codePoints++;
    const code = char.codePointAt(0) ?? 0;
    if (code === 0x09 || code === 0x0a || code === 0x0d || (code >= 0x20 && code !== 0x7f)) {
      printable++;
    }
  }
  return printable / codePoints >= 0.85;
}

function FieldLabel({ children }: { children: string }) {
  return (
    <p className="text-muted-foreground mb-1 text-[0.8rem] font-medium">
      {children}
    </p>
  );
}

function DetailBlock({ content }: { content: string }) {
  return <pre className="wallet-detail-block">{content}</pre>;
}

/**
 * Host/Standard `solana:signMessage` consent — UTF-8 preview when printable.
 */
export function SolanaSignModal({
  address,
  messages,
  onResolve,
  onReject,
}: {
  address: SolanaAccountAddress;
  messages: readonly Uint8Array[];
  onResolve: (signatures: SolanaSignature[]) => void;
  onReject: (error: unknown) => void;
}) {
  const { getSigner, resolveChain, configProvider } = useWallet();
  const { style } = useStyle();
  const { solanaSign, account: accountCopy } = style.copy;
  const [phase, setPhase] = useState<"confirm" | "signing">("confirm");
  const [hostDomain, setHostDomain] = useState("");
  const signGenerationRef = useRef(0);

  useEffect(() => {
    void configProvider.getConfig().then((config) => {
      setHostDomain(String(config.hostDomain));
    });
  }, [configProvider]);

  const sessionChainId = useWalletSessionStore((state) => state.chainId);
  const chainId = ChainUtils.isSolanaChainId(sessionChainId)
    ? sessionChainId
    : SOLANA_MAINNET_CHAIN_ID;
  const chain = resolveChain(chainId);
  const networkDisplay = chain?.label ?? "Solana";
  const body = solanaSign.body.replaceAll(
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
      const signatures = await signer.solana.signMessage([...messages]);
      if (signGenerationRef.current !== generation) return;
      onResolve(signatures);
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
      title={solanaSign.title}
      onBackdropDismiss={phase === "confirm" ? cancel : undefined}
      actions={
        phase === "confirm"
          ? [
              {
                label: solanaSign.rejectLabel,
                variant: "secondary",
                onClick: cancel,
              },
              {
                label: solanaSign.signLabel,
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
              title={solanaSign.networkLabel}
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
          <FieldLabel>{solanaSign.accountLabel}</FieldLabel>
          <CopyableText
            text={String(address)}
            truncate
            copyLabel={accountCopy.copyAddressLabel}
            copiedLabel={accountCopy.addressCopiedLabel}
            copyFailedLabel={accountCopy.addressCopyFailedLabel}
          />
        </div>

        <div>
          <FieldLabel>{solanaSign.messageLabel}</FieldLabel>
          {messages.map((message, index) => (
            <DetailBlock
              key={index}
              content={
                messages.length > 1
                  ? `[${index + 1}/${messages.length}]\n${bytesToDisplay(message)}`
                  : bytesToDisplay(message)
              }
            />
          ))}
        </div>
      </div>
      {phase === "signing" ? (
        <p className="text-muted-foreground mt-4 m-0 text-[0.9rem]">
          {solanaSign.signingHint}
        </p>
      ) : null}
    </Modal>
  );
}

/**
 * Host/Standard `solana:signIn` (SIWS) consent — structured fields, not raw bytes.
 */
export function SiwsModal({
  fields,
  messageBytes,
  onResolve,
  onReject,
}: {
  fields: ISiwsFields;
  messageBytes: Uint8Array;
  onResolve: (signature: SolanaSignature) => void;
  onReject: (error: unknown) => void;
}) {
  const { getSigner, resolveChain } = useWallet();
  const { style } = useStyle();
  const { siws, account: accountCopy } = style.copy;
  const [phase, setPhase] = useState<"confirm" | "signing">("confirm");
  const signGenerationRef = useRef(0);

  const body = siws.body.replaceAll("{domain}", fields.domain);
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

        <div
          className={`flex items-center gap-3 ${fields.domain.trim() ? "justify-between" : "justify-start"}`}
        >
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
              <span className="text-muted-foreground mb-1.5 block text-xs font-medium tracking-wide uppercase">
                {siws.messageLabel}
              </span>
              <p className="text-foreground m-0 whitespace-pre-wrap text-sm leading-snug">
                {statement}
              </p>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {showUri ? (
              <SiwsMetadataRow label={siws.uriLabel} value={fields.uri} />
            ) : null}
            {fields.version ? (
              <SiwsMetadataRow label={siws.versionLabel} value={fields.version} />
            ) : null}
            {fields.nonce ? (
              <SiwsMetadataRow label={siws.nonceLabel} value={fields.nonce} />
            ) : null}
            {fields.issuedAt ? (
              <SiwsMetadataRow
                label={siws.issuedAtLabel}
                value={fields.issuedAt}
              />
            ) : null}
            {fields.expirationTime ? (
              <SiwsMetadataRow
                label={siws.expirationTimeLabel}
                value={fields.expirationTime}
              />
            ) : null}
            {fields.notBefore ? (
              <SiwsMetadataRow
                label={siws.notBeforeLabel}
                value={fields.notBefore}
              />
            ) : null}
          </div>
          {fields.resources && fields.resources.length > 0 ? (
            <div className="mt-2 first:mt-0">
              <span className="text-muted-foreground mb-1.5 block text-xs font-medium tracking-wide uppercase">
                {siws.resourcesLabel}
              </span>
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

function SiwsMetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-muted-foreground mb-0.5 block text-[0.65rem] font-medium tracking-wide uppercase">
        {label}
      </span>
      <p className="text-foreground m-0 break-all text-sm">{value}</p>
    </div>
  );
}
