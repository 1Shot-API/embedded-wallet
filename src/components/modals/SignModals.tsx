import type {
  PersonalSignApprovalRequest,
  SendTransactionApprovalRequest,
  SignTypedDataApprovalRequest,
} from "@1shotapi/ows-signer-utils";
import {
  ConversionUtils,
  HexString,
  OwsUserRejectedError,
  type EVMSignatureHex,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import { useEffect, useRef, useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import type { TypedDataDefinition } from "viem";
import type { ISiweFields } from "../../lib/types/domain/SiweFields";
import type {
  IConfirmSendPayment,
  IConfirmTransferRequest,
} from "../../wallet/modalTypes";
import type { IRelayerSendUiCallbacks } from "../../lib/types/domain/RelayerSendUi";
import { useStyle } from "../../style/StyleProvider";
import { useWallet } from "../../wallet/WalletProvider";
import { Modal } from "../Modal";
import { AssetIdentityMark } from "../AssetIdentityMark";
import { CopyableText } from "../CopyableText";
import { SafeAssetImage } from "../SafeAssetImage";
import {
  isSiweUriRedundant,
  resolveSiweEvmChainId,
} from "../../lib/utils/siweDisplay";
import {
  domainFieldEntries,
  formatEip712Primitive,
  humanizeEip712Key,
  isEvmAddressString,
  readDomainChainId,
  readVerifyingContract,
} from "../../lib/utils/eip712Display";
import {
  faviconUrl,
  truncateAddress,
} from "../../lib/utils/identityDisplay";
import { ConsentSummaryRow } from "../ConsentSummaryRow";
import { Eip712FieldTree } from "../Eip712FieldTree";
import { RelayerConfirmModalChrome } from "../RelayerConfirmModalChrome";
import { useRelayerConfirmSubmit } from "../useRelayerConfirmSubmit";

function isSignDenied(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "OwsSignDeniedError" ||
    error.message.includes("signDenied") ||
    error.message.includes("SignDenied") ||
    error.message.includes("NotAllowed") ||
    error.message.includes("not allowed")
  );
}

export function PersonalSignModal({
  request,
  onResolve,
  onReject,
}: {
  request: PersonalSignApprovalRequest;
  onResolve: (signature: EVMSignatureHex) => void;
  onReject: (error: unknown) => void;
}) {
  const { getSigner } = useWallet();
  const { style } = useStyle();
  const { personalSign, account: accountCopy } = style.copy;
  const [phase, setPhase] = useState<"confirm" | "signing">("confirm");
  /** Bumped on cancel and each startSign so stale in-flight ops cannot settle. */
  const signGenerationRef = useRef(0);

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
      if (isSignDenied(error)) {
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
      <FieldLabel>{personalSign.accountLabel}</FieldLabel>
      <div className="mb-3">
        <CopyableText
          text={String(request.address)}
          truncate
          copyLabel={accountCopy.copyAddressLabel}
          copiedLabel={accountCopy.addressCopiedLabel}
          copyFailedLabel={accountCopy.addressCopyFailedLabel}
        />
      </div>
      <FieldLabel>{personalSign.messageLabel}</FieldLabel>
      <DetailBlock content={formatMessageForDisplay(request.message)} />
      {phase === "signing" ? (
        <p className="text-muted-foreground mt-4 m-0 text-[0.9rem]">
          Confirm in the signing panel…
        </p>
      ) : null}
    </Modal>
  );
}

export function SiweModal({
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

  const accountAddress =
    fields.address?.trim() || String(request.address);
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
      if (isSignDenied(error)) {
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
              <SiweSectionLabel>{siwe.messageLabel}</SiweSectionLabel>
              <p className="text-foreground m-0 whitespace-pre-wrap text-sm leading-snug">
                {statement}
              </p>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {showUri ? (
              <SiweMetadataRow label={siwe.uriLabel} value={fields.uri} compact />
            ) : null}
            {fields.version ? (
              <SiweMetadataRow
                label={siwe.versionLabel}
                value={fields.version}
                compact
              />
            ) : null}
            {fields.nonce ? (
              <SiweMetadataRow
                label={siwe.nonceLabel}
                value={fields.nonce}
                compact
              />
            ) : null}
            {fields.issuedAt ? (
              <SiweMetadataRow
                label={siwe.issuedAtLabel}
                value={fields.issuedAt}
                compact
              />
            ) : null}
            {fields.expirationTime ? (
              <SiweMetadataRow
                label={siwe.expirationTimeLabel}
                value={fields.expirationTime}
                compact
              />
            ) : null}
            {fields.notBefore ? (
              <SiweMetadataRow
                label={siwe.notBeforeLabel}
                value={fields.notBefore}
                compact
              />
            ) : null}
          </div>
          {fields.resources && fields.resources.length > 0 ? (
            <div className="mt-2 first:mt-0">
              <SiweSectionLabel>{siwe.resourcesLabel}</SiweSectionLabel>
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

function SiweSectionLabel({ children }: { children: string }) {
  return (
    <span className="text-muted-foreground mb-1.5 block text-xs font-medium tracking-wide uppercase">
      {children}
    </span>
  );
}

function SiweMetadataRow({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "min-w-0" : "mt-3 first:mt-0"}>
      <SiweSectionLabel>{label}</SiweSectionLabel>
      <p className="text-foreground m-0 break-all text-sm leading-snug">
        {value}
      </p>
    </div>
  );
}

function NetworkIdentityMark({
  label,
  logoUrl,
  size = "md",
}: {
  label: string;
  logoUrl?: string;
  size?: "sm" | "md";
}) {
  const letter = (label.trim()[0] ?? "?").toUpperCase();
  const box = size === "sm" ? "size-12" : "size-16";
  const text = size === "sm" ? "text-xl" : "text-2xl";
  return (
    <div className={`relative shrink-0 ${box}`} aria-hidden>
      <SafeAssetImage
        src={logoUrl}
        className={`${box} rounded-full object-cover`}
        fallback={
          <div
            className={`bg-muted text-foreground flex ${box} items-center justify-center rounded-full font-semibold ${text}`}
          >
            {letter}
          </div>
        }
      />
    </div>
  );
}

export function TypedDataModal({
  request,
  onResolve,
  onReject,
}: {
  request: SignTypedDataApprovalRequest;
  onResolve: (signature: EVMSignatureHex) => void;
  onReject: (error: unknown) => void;
}) {
  const { getSigner, resolveChain, configProvider } = useWallet();
  const { style } = useStyle();
  const { typedData: copy } = style.copy;
  const { typedData } = request;
  const [phase, setPhase] = useState<"confirm" | "signing">("confirm");
  const [hostDomain, setHostDomain] = useState("");
  /** Bumped on cancel and each startSign so stale in-flight ops cannot settle. */
  const signGenerationRef = useRef(0);

  useEffect(() => {
    void configProvider.getConfig().then((config) => {
      setHostDomain(String(config.hostDomain));
    });
  }, [configProvider]);

  const domainChainRaw = readDomainChainId(typedData.domain);
  const evmChainId = domainChainRaw
    ? resolveSiweEvmChainId(domainChainRaw)
    : null;
  const chain = evmChainId ? resolveChain(evmChainId) : null;
  const networkDisplay =
    chain?.label ??
    (domainChainRaw ? `Chain ${domainChainRaw.trim()}` : "Unknown network");
  const verifyingContract = readVerifyingContract(typedData.domain);
  const contractExplorerUrl =
    chain && verifyingContract && isEvmAddressString(verifyingContract)
      ? chain.addressExplorerUrl(verifyingContract)
      : null;
  /** Domain separator fields other than chain / contract (e.g. `Ether Mail · v1`). */
  const domainSummary = domainFieldEntries(typedData.domain)
    .filter(({ key }) => key !== "verifyingContract")
    .map(({ key, value }) => {
      const text = formatEip712Primitive(value);
      return text ? `${humanizeEip712Key(key)}: ${text}` : "";
    })
    .filter(Boolean)
    .join(" · ");

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
      const [signature] = await signer.evm.signTypedData([
        typedData as unknown as TypedDataDefinition,
      ]);
      if (signGenerationRef.current !== generation) return;
      onResolve(signature!);
    })().catch((error: unknown) => {
      if (signGenerationRef.current !== generation) return;
      if (isSignDenied(error)) {
        setPhase("confirm");
        return;
      }
      onReject(error);
    });
  };

  return (
    <Modal
      title={copy.title}
      onBackdropDismiss={phase === "confirm" ? cancel : undefined}
      actions={
        phase === "confirm"
          ? [
              {
                label: copy.rejectLabel,
                variant: "secondary",
                onClick: cancel,
              },
              {
                label: copy.signLabel,
                variant: "primary",
                autoFocus: true,
                onClick: startSign,
              },
            ]
          : undefined
      }
    >
      <div className="text-foreground flex flex-col gap-3">
        <p className="text-muted-foreground m-0 text-sm leading-relaxed text-pretty">
          {copy.body}
        </p>

        <dl className="border-border m-0 flex flex-col gap-2.5 rounded-md border px-3 py-2.5">
          <ConsentSummaryRow label={copy.networkLabel}>
            <SafeAssetImage
              src={chain?.logoUrl}
              className="size-5 shrink-0 rounded-full object-cover"
            />
            <span className="truncate text-sm font-medium">
              {networkDisplay}
            </span>
          </ConsentSummaryRow>

          <ConsentSummaryRow label={copy.accountLabel}>
            <span
              className="truncate font-mono text-sm"
              title={String(request.address)}
            >
              {truncateAddress(String(request.address))}
            </span>
          </ConsentSummaryRow>

          {hostDomain.trim() ? (
            <ConsentSummaryRow label={copy.requestFromLabel}>
              <SafeAssetImage
                src={faviconUrl(hostDomain)}
                className="size-4 shrink-0 rounded-sm"
              />
              <span className="truncate text-sm font-medium" title={hostDomain}>
                {hostDomain}
              </span>
            </ConsentSummaryRow>
          ) : null}

          {verifyingContract ? (
            <ConsentSummaryRow label={copy.interactingWithLabel}>
              {contractExplorerUrl ? (
                <a
                  href={contractExplorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary flex min-w-0 items-center gap-1 font-mono text-sm underline underline-offset-2"
                  title={verifyingContract}
                >
                  <span className="truncate">
                    {truncateAddress(verifyingContract)}
                  </span>
                  <ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden />
                </a>
              ) : (
                <span
                  className="truncate font-mono text-sm"
                  title={verifyingContract}
                >
                  {truncateAddress(verifyingContract)}
                </span>
              )}
            </ConsentSummaryRow>
          ) : null}
        </dl>

        <div className="border-border rounded-md border px-3 py-2.5">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {copy.messageSectionLabel}
            </span>
            <span
              className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase"
              title={copy.primaryTypeLabel}
            >
              {typedData.primaryType}
            </span>
          </div>
          {domainSummary ? (
            <p className="text-muted-foreground m-0 mb-2 truncate text-xs">
              {domainSummary}
            </p>
          ) : null}
          <div className="max-h-[min(40vh,280px)] overflow-y-auto pr-1">
            <Eip712FieldTree value={typedData.message} />
          </div>
        </div>
      </div>

      {phase === "signing" ? (
        <p className="text-muted-foreground mt-4 m-0 text-sm">
          {copy.signingHint}
        </p>
      ) : null}
    </Modal>
  );
}

export function SendTransactionModal({
  request,
  execute,
  onResolve,
  onReject,
}: {
  request: SendTransactionApprovalRequest & { useRelayer?: boolean };
  execute: (
    payment: IConfirmSendPayment,
    ui?: IRelayerSendUiCallbacks,
  ) => Promise<EVMTransactionHash>;
  onResolve: (hash: EVMTransactionHash) => void;
  onReject: (error: unknown) => void;
}) {
  const { style } = useStyle();
  const { sendTransaction: copy } = style.copy;
  const relayerCopy = style.copy.relayerSubmit;

  const relayerSubmit = useRelayerConfirmSubmit({
    execute: (payment, ui) =>
      execute(
        {
          paymentToken: payment.paymentToken,
          feeAtoms: payment.feeAtoms,
        },
        ui,
      ),
    onResolve,
    onReject,
    rejectMessage: "User rejected the transaction request",
    signingMessage: relayerCopy.signingMessage,
    waitingMessage: relayerCopy.waitingMessage,
    finalFeeNotice: relayerCopy.finalFeeNotice,
  });

  const [legacyPhase, setLegacyPhase] = useState<"confirm" | "signing">(
    "confirm",
  );
  const [legacyError, setLegacyError] = useState<string | null>(null);
  const abortedRef = useRef(false);

  const useRelayer = request.useRelayer === true;

  const phase = useRelayer ? relayerSubmit.phase : legacyPhase;

  const canConfirm = useRelayer
    ? relayerSubmit.canConfirm
    : true;

  const cancel = () => {
    abortedRef.current = true;
    if (useRelayer) {
      relayerSubmit.cancel();
      return;
    }
    onReject(new OwsUserRejectedError("User rejected the transaction request"));
  };

  const startLegacySend = () => {
    abortedRef.current = false;
    setLegacyError(null);
    setLegacyPhase("signing");
    void execute({})
      .then((hash) => {
        if (abortedRef.current) return;
        onResolve(hash);
      })
      .catch((err: unknown) => {
        if (abortedRef.current) return;
        if (isSignDenied(err)) {
          setLegacyPhase("confirm");
          return;
        }
        setLegacyError(err instanceof Error ? err.message : String(err));
        setLegacyPhase("confirm");
      });
  };

  const showActions = useRelayer
    ? phase === "confirm" || phase === "finalFee"
    : legacyPhase === "confirm";

  return (
    <Modal
      title={copy.title}
      onBackdropDismiss={
        phase === "confirm" || phase === "finalFee" ? cancel : undefined
      }
      actions={
        showActions
          ? [
              {
                label: copy.rejectLabel,
                variant: "secondary",
                onClick: cancel,
              },
              {
                label: copy.signLabel,
                variant: "primary",
                autoFocus: true,
                disabled: useRelayer ? !canConfirm : false,
                onClick: useRelayer
                  ? phase === "finalFee"
                    ? relayerSubmit.confirmFinalFee
                    : relayerSubmit.startSubmit
                  : startLegacySend,
              },
            ]
          : undefined
      }
    >
      <FieldLabel>{copy.accountLabel}</FieldLabel>
      <p className="mb-3 break-all font-mono text-[0.8rem]">{request.address}</p>
      <LabeledBlock
        label={copy.contractLabel}
        content={request.to ?? copy.contractCreationLabel}
      />
      <LabeledBlock label={copy.valueLabel} content={request.value} />
      <LabeledBlock label={copy.dataLabel} content={request.data} />
      <LabeledBlock label={copy.chainLabel} content={request.chainId} />
      {useRelayer ? (
        <RelayerConfirmModalChrome
          chainId={request.chainId}
          ownerAddress={request.address}
          submit={relayerSubmit}
        />
      ) : legacyPhase === "signing" ? (
        <p className="text-muted-foreground mt-4 m-0 text-[0.9rem]">
          {relayerCopy.signingMessage}
        </p>
      ) : null}
      {!useRelayer && legacyError ? (
        <p className="text-destructive mt-3 m-0 text-[0.9rem]">{legacyError}</p>
      ) : null}
    </Modal>
  );
}

export function ConfirmTransferModal({
  request,
  execute,
  onResolve,
  onReject,
}: {
  request: IConfirmTransferRequest;
  execute: (
    payment: IConfirmSendPayment,
    ui?: IRelayerSendUiCallbacks,
  ) => Promise<EVMTransactionHash>;
  onResolve: (hash: EVMTransactionHash) => void;
  onReject: (error: unknown) => void;
}) {
  const { style } = useStyle();
  const { resolveChain } = useWallet();
  const { confirmTransfer: copy, account: accountCopy } = style.copy;
  const relayerCopy = style.copy.relayerSubmit;
  const body = copy.body.replace("{domain}", request.domain);
  const chain = resolveChain(request.chainId);

  const submit = useRelayerConfirmSubmit({
    execute: (payment, ui) =>
      execute(
        {
          paymentToken: payment.paymentToken,
          feeAtoms: payment.feeAtoms,
        },
        ui,
      ),
    onResolve,
    onReject,
    rejectMessage: "User rejected the transaction request",
    signingMessage: relayerCopy.signingMessage,
    waitingMessage: relayerCopy.waitingMessage,
    finalFeeNotice: relayerCopy.finalFeeNotice,
  });

  const canConfirm =
    !request.useRelayer || submit.canConfirm;

  const cancel = () => {
    if (request.useRelayer) {
      submit.cancel();
      return;
    }
    onReject(new OwsUserRejectedError("User rejected the transaction request"));
  };

  const [legacyPhase, setLegacyPhase] = useState<"confirm" | "signing">(
    "confirm",
  );
  const [legacyError, setLegacyError] = useState<string | null>(null);
  const abortedRef = useRef(false);

  const startLegacySend = () => {
    abortedRef.current = false;
    setLegacyError(null);
    setLegacyPhase("signing");
    void execute({})
      .then((hash) => {
        if (abortedRef.current) return;
        onResolve(hash);
      })
      .catch((err: unknown) => {
        if (abortedRef.current) return;
        if (isSignDenied(err)) {
          setLegacyPhase("confirm");
          return;
        }
        setLegacyError(err instanceof Error ? err.message : String(err));
        setLegacyPhase("confirm");
      });
  };

  const phase = request.useRelayer ? submit.phase : legacyPhase;
  const showActions = request.useRelayer
    ? phase === "confirm" || phase === "finalFee"
    : legacyPhase === "confirm";

  return (
    <Modal
      title={copy.title}
      onBackdropDismiss={
        phase === "confirm" || phase === "finalFee" ? cancel : undefined
      }
      actions={
        showActions
          ? [
              {
                label: copy.rejectLabel,
                variant: "secondary",
                onClick: cancel,
              },
              {
                label: copy.confirmLabel,
                variant: "primary",
                autoFocus: true,
                disabled: request.useRelayer ? !canConfirm : false,
                onClick: request.useRelayer
                  ? phase === "finalFee"
                    ? submit.confirmFinalFee
                    : submit.startSubmit
                  : startLegacySend,
              },
            ]
          : undefined
      }
    >
      <div className="text-foreground flex flex-col gap-5">
        <p className="text-muted-foreground m-0 text-sm leading-relaxed">
          {body}
        </p>

        <div className="flex items-center gap-4">
          <AssetIdentityMark
            chainId={request.chainId}
            address={request.tokenAddress}
            symbol={request.tokenSymbol}
            chainLogoUrl={chain?.logoUrl}
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xl font-semibold tracking-tight">
              {request.amount} {request.tokenSymbol}
            </span>
            <span className="bg-muted text-muted-foreground w-fit rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide">
              {request.chainName}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {copy.receiverLabel}
          </span>
          <CopyableText
            text={request.receiver}
            truncate
            copyLabel={accountCopy.copyAddressLabel}
            copiedLabel={accountCopy.addressCopiedLabel}
            copyFailedLabel={accountCopy.addressCopyFailedLabel}
          />
        </div>
      </div>
      {request.useRelayer ? (
        <RelayerConfirmModalChrome
          chainId={request.chainId}
          ownerAddress={request.ownerAddress}
          submit={submit}
        />
      ) : legacyPhase === "signing" ? (
        <p className="text-muted-foreground mt-4 m-0 text-[0.9rem]">
          {relayerCopy.signingMessage}
        </p>
      ) : null}
      {!request.useRelayer && legacyError ? (
        <p className="text-destructive mt-3 m-0 text-[0.9rem]">{legacyError}</p>
      ) : null}
    </Modal>
  );
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

function LabeledBlock({ label, content }: { label: string; content: string }) {
  return (
    <div className="mb-3 min-w-0 last:mb-0">
      <FieldLabel>{label}</FieldLabel>
      <DetailBlock content={content} />
    </div>
  );
}

function formatMessageForDisplay(message: string): string {
  if (message.startsWith("0x") && message.length > 2) {
    try {
      const bytes = ConversionUtils.hexToBytes(
        HexString(message as `0x${string}`),
      );
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      if (isMostlyPrintable(decoded)) {
        return decoded;
      }
    } catch {
      // fall through
    }
  }
  return message;
}

function isMostlyPrintable(text: string): boolean {
  if (!text.trim()) return false;
  let printable = 0;
  let codePoints = 0;
  for (const char of text) {
    codePoints++;
    const code = char.codePointAt(0) ?? 0;
    if (code >= 32 && code !== 127) printable++;
  }
  return codePoints > 0 && printable / codePoints >= 0.85;
}
