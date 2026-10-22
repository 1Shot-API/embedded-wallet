import {
  ChainUtils,
  OwsUserRejectedError,
  SOLANA_MAINNET_CHAIN_ID,
  type SolanaAccountAddress,
  type SolanaSignature,
} from "@1shotapi/ows-types";
import { useEffect, useRef, useState } from "react";

import { bytesToDisplay } from "../../lib/utils/bytesToDisplay";
import { isSignCeremonyDenied } from "../../lib/utils/isSignCeremonyDenied";
import { useStyle } from "../../style/StyleProvider";
import { useWalletSessionStore } from "../../wallet/sessionStore";
import { useWallet } from "../../wallet/WalletProvider";
import { CopyableText } from "../CopyableText";
import { Modal } from "../Modal";
import { SafeAssetImage } from "../SafeAssetImage";

import { DetailBlock } from "./DetailBlock";
import { FieldLabel } from "./FieldLabel";

/** Host/Standard `solana:signMessage` consent — UTF-8 preview when printable. */
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
