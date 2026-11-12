import { EClearSigningDisplayKind } from "@1shotapi/ows-clear-signing";
import type { SendTransactionApprovalRequest } from "@1shotapi/ows-signer-utils";
import {
  OwsUserRejectedError,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import { useEffect, useRef, useState } from "react";
import { formatUnits } from "viem";

import type { IClearSigningPresentation } from "../../lib/types/domain/ClearSigningPresentation";
import type { IRelayerSendUiCallbacks } from "../../lib/types/domain/RelayerSendUi";
import { truncateAddress } from "../../lib/utils/identityDisplay";
import { isSignCeremonyDenied } from "../../lib/utils/isSignCeremonyDenied";
import { useStyle } from "../../style/StyleProvider";
import type { IConfirmSendPayment } from "../../wallet/modalTypes";
import { useWallet } from "../../wallet/WalletProvider";
import { ConsentSummaryRow } from "../ConsentSummaryRow";
import { Modal } from "../Modal";
import { RelayerConfirmModalChrome } from "../RelayerConfirmModalChrome";
import { SafeAssetImage } from "../SafeAssetImage";
import { useRelayerConfirmSubmit } from "../useRelayerConfirmSubmit";

import {
  ClearSigningDetails,
  type IClearSigningExtraRow,
} from "./ClearSigningDetails";
import { FieldLabel } from "./FieldLabel";
import { LabeledBlock } from "./LabeledBlock";
import { RequestingHostBadge } from "./RequestingHostBadge";

/**
 * Host EIP-1193 `eth_sendTransaction` consent (non-transfer). With an ERC-7730 `clearSigning`
 * presentation the call is shown as intent + labeled fields (raw view collapsed); otherwise as
 * raw to / value / data.
 */
export function EVMSendTransactionModal({
  request,
  clearSigning,
  execute,
  onResolve,
  onReject,
}: {
  request: SendTransactionApprovalRequest & { useRelayer?: boolean };
  clearSigning: IClearSigningPresentation | null;
  execute: (
    payment: IConfirmSendPayment,
    ui?: IRelayerSendUiCallbacks,
  ) => Promise<EVMTransactionHash>;
  onResolve: (hash: EVMTransactionHash) => void;
  onReject: (error: unknown) => void;
}) {
  const { style } = useStyle();
  const { configProvider, resolveChain } = useWallet();
  const { sendTransaction: copy, clearSigning: clearCopy } = style.copy;
  const relayerCopy = style.copy.relayerSubmit;
  const [hostDomain, setHostDomain] = useState("");

  useEffect(() => {
    void configProvider.getConfig().then((config) => {
      setHostDomain(String(config.hostDomain));
    });
  }, [configProvider]);

  const relayerSubmit = useRelayerConfirmSubmit({
    execute: (payment, ui) =>
      execute(
        {
          paymentToken: payment.paymentToken,
          feeAtoms: payment.feeAtoms,
          paymentChainId: payment.paymentChainId,
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

  const canConfirm = useRelayer ? relayerSubmit.canConfirm : true;

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
        if (isSignCeremonyDenied(err)) {
          setLegacyPhase("confirm");
          return;
        }
        setLegacyError(err instanceof Error ? err.message : String(err));
        setLegacyPhase("confirm");
      });
  };

  const valueRaw = String(request.value);
  const valueWei =
    valueRaw && valueRaw !== "0x0" && valueRaw !== "0x"
      ? BigInt(valueRaw)
      : undefined;
  const chain = resolveChain(request.chainId);

  // A descriptor that does not render `@.value` must not hide native value sent with the call.
  const extraRows: IClearSigningExtraRow[] = [];
  if (
    clearSigning &&
    valueWei &&
    valueWei > 0n &&
    !clearSigning.display.fields.some(
      (field) => field.kind === EClearSigningDisplayKind.NativeAmount,
    )
  ) {
    const native = chain?.nativeCurrency ?? { symbol: "ETH", decimals: 18 };
    extraRows.push({
      label: clearCopy.nativeValueLabel,
      value: `${formatUnits(valueWei, native.decimals)} ${native.symbol}`,
    });
  }

  const rawFields = (
    <>
      <LabeledBlock
        label={copy.contractLabel}
        content={request.to ?? copy.contractCreationLabel}
      />
      <LabeledBlock label={copy.valueLabel} content={request.value} />
      <LabeledBlock label={copy.dataLabel} content={request.data} />
      <LabeledBlock label={copy.chainLabel} content={request.chainId} />
    </>
  );

  const showActions = useRelayer
    ? phase === "confirm" || phase === "finalFee"
    : legacyPhase === "confirm";

  return (
    <Modal
      title={clearSigning ? clearSigning.display.intent : copy.title}
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
      <div className="mb-3 flex">
        <RequestingHostBadge domain={hostDomain} />
      </div>
      {clearSigning ? (
        <div className="flex flex-col gap-3">
          <dl className="border-border m-0 flex flex-col gap-2.5 rounded-md border px-3 py-2.5">
            <ConsentSummaryRow label={copy.chainLabel}>
              <SafeAssetImage
                src={chain?.logoUrl}
                className="size-5 shrink-0 rounded-full object-cover"
              />
              <span className="truncate text-sm font-medium">
                {chain?.label ?? String(request.chainId)}
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
          </dl>
          <ClearSigningDetails
            presentation={clearSigning}
            chainId={request.chainId}
            extraRows={extraRows}
          />
          <details className="mb-1">
            <summary className="text-muted-foreground mb-2 cursor-pointer text-xs font-medium select-none">
              {clearCopy.rawTransactionLabel}
            </summary>
            {rawFields}
          </details>
        </div>
      ) : (
        <>
          <FieldLabel>{copy.accountLabel}</FieldLabel>
          <p className="mb-3 break-all font-mono text-[0.8rem]">
            {request.address}
          </p>
          {rawFields}
        </>
      )}
      {useRelayer ? (
        <RelayerConfirmModalChrome
          chainId={request.chainId}
          ownerAddress={request.address}
          work={{
            to: request.to!,
            data: request.data,
            value: valueWei,
          }}
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
