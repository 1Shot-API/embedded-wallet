import type { SignTypedDataApprovalRequest } from "@1shotapi/ows-signer-utils";
import { OwsUserRejectedError, type EVMSignatureHex } from "@1shotapi/ows-types";
import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TypedDataDefinition } from "viem";

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
import { isSignCeremonyDenied } from "../../lib/utils/isSignCeremonyDenied";
import { resolveSiweEvmChainId } from "../../lib/utils/siweDisplay";
import { useStyle } from "../../style/StyleProvider";
import { useWallet } from "../../wallet/WalletProvider";
import { ConsentSummaryRow } from "../ConsentSummaryRow";
import { Eip712FieldTree } from "../Eip712FieldTree";
import { Modal } from "../Modal";
import { SafeAssetImage } from "../SafeAssetImage";

/** Host EIP-712 typed-data consent. */
export function EVMTypedDataModal({
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
      if (isSignCeremonyDenied(error)) {
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
