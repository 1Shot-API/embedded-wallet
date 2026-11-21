import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";

import type { IRelayerSendUiCallbacks } from "../../lib/types/domain/RelayerSendUi";
import { truncateAddress } from "../../lib/utils/identityDisplay";
import { useStyle } from "../../style/StyleProvider";
import type {
  IRelayerConfirmSendResult,
  ISendCallsModalRequest,
} from "../../wallet/modalTypes";
import { useWallet } from "../../wallet/WalletProvider";
import { AssetIdentityMark } from "../AssetIdentityMark";
import { CopyableText } from "../CopyableText";
import { Modal } from "../Modal";
import { RelayerConfirmModalChrome } from "../RelayerConfirmModalChrome";
import { SafeAssetImage } from "../SafeAssetImage";
import { TransactionInFlight } from "../TransactionInFlight";
import { useRelayerConfirmSubmit } from "../useRelayerConfirmSubmit";

import { ClearSigningDetails } from "./ClearSigningDetails";
import { FieldLabel } from "./FieldLabel";
import { LabeledBlock } from "./LabeledBlock";
import { RequestingHostBadge } from "./RequestingHostBadge";

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

/** Native value worth showing. Empty, `0x`, and zero quantities stay hidden. */
function hasNativeValue(value: string): boolean {
  const raw = value.trim().toLowerCase();
  if (!raw || raw === "0x" || raw === "0x0") return false;
  try {
    return BigInt(raw) !== 0n;
  } catch {
    return true;
  }
}

/** Formatted native amount for an approval card. Unparseable values stay hidden. */
function formatNativeAmount(
  value: string,
  decimals: number,
  symbol: string,
): string | null {
  try {
    const wei = BigInt(value.trim());
    if (wei <= 0n) return null;
    return `${formatUnits(wei, decimals)} ${symbol}`;
  } catch {
    return null;
  }
}

/** EIP-5792 `wallet_sendCalls` consent. Resolves the relayer task id. */
export function EVMSendCallsModal({
  request,
  execute,
  onResolve,
  onReject,
}: {
  request: ISendCallsModalRequest;
  execute: (
    payment: IRelayerConfirmSendResult,
    ui?: IRelayerSendUiCallbacks,
  ) => Promise<string>;
  onResolve: (bundleId: string) => void;
  onReject: (error: unknown) => void;
}) {
  const { style } = useStyle();
  const { configProvider, resolveChain } = useWallet();
  const {
    sendCalls: copy,
    sendTransaction: txCopy,
    confirmTransfer,
    confirmApprove,
    account: accountCopy,
    clearSigning: clearCopy,
  } = style.copy;
  const chain = resolveChain(request.chainId);
  const native = chain?.nativeCurrency ?? { symbol: "ETH", decimals: 18 };
  const relayerCopy = style.copy.relayerSubmit;
  const [hostDomain, setHostDomain] = useState(request.domain);

  useEffect(() => {
    void configProvider.getConfig().then((config) => {
      setHostDomain(String(config.hostDomain));
    });
  }, [configProvider]);

  const submit = useRelayerConfirmSubmit<string>({
    execute,
    onResolve,
    onReject,
    rejectMessage: "User rejected the request",
    retainDisplayDuringSubmit: true,
    signingMessage: relayerCopy.signingMessage,
    waitingMessage: relayerCopy.waitingMessage,
    finalFeeNotice: relayerCopy.finalFeeNotice,
  });

  const inFlight =
    submit.phase === "signing" || submit.phase === "submitting";
  const showActions = submit.phase === "confirm" || submit.phase === "finalFee";

  return (
    <Modal
      title={copy.title}
      onBackdropDismiss={showActions ? submit.cancel : undefined}
      actions={
        showActions
          ? [
              {
                label: copy.rejectLabel,
                variant: "secondary",
                onClick: submit.cancel,
              },
              {
                label: copy.signLabel,
                variant: "primary",
                autoFocus: true,
                disabled: !submit.canConfirm,
                onClick:
                  submit.phase === "finalFee"
                    ? submit.confirmFinalFee
                    : submit.startSubmit,
              },
            ]
          : undefined
      }
    >
      {inFlight ? (
        <TransactionInFlight
          status={
            submit.phase === "signing"
              ? relayerCopy.signingMessage
              : relayerCopy.submittedMessage
          }
          entries={request.calls.map((call) => {
            if (call.transfer) {
              return {
                amount: call.transfer.amount,
                symbol: call.transfer.symbol,
                chainLabel: request.chainName,
                recipient: call.transfer.recipient,
                recipientLabel:
                  call.transfer.purpose === "approve"
                    ? confirmApprove.spenderLabel
                    : confirmTransfer.receiverLabel,
              };
            }
            const attached = formatNativeAmount(
              call.value,
              native.decimals,
              native.symbol,
            );
            return {
              subject: call.to,
              subjectLabel: txCopy.contractLabel,
              chainLabel: request.chainName,
              ...(attached ? { amount: attached } : {}),
            };
          })}
        />
      ) : (
      <>
      <div className="mb-3 flex">
        <RequestingHostBadge domain={hostDomain} />
      </div>
      <p className="text-muted-foreground mb-3 m-0 text-sm">
        {fill(copy.body, { domain: hostDomain })}
      </p>
      <p className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8rem]">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className="text-muted-foreground font-medium">
            {txCopy.accountLabel}:
          </span>
          <span className="text-foreground font-mono" title={request.account}>
            {truncateAddress(request.account)}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <span className="text-muted-foreground font-medium">Network:</span>
          <SafeAssetImage
            src={chain?.logoUrl}
            alt={request.chainName}
            className="size-5 shrink-0 rounded-full object-cover"
          />
        </span>
      </p>
      <ul className="m-0 list-none p-0">
        {request.calls.map((call, index) => {
          const approveNative =
            call.transfer?.purpose === "approve"
              ? formatNativeAmount(call.value, native.decimals, native.symbol)
              : null;
          return (
            <li key={`${call.to}-${index}`} className="mt-3">
              <FieldLabel>
                {fill(copy.callLabel, { index: String(index + 1) })}
              </FieldLabel>
              {call.transfer ? (
                <div className="flex flex-col gap-3">
                  <p className="text-foreground m-0 text-sm font-semibold">
                    {call.transfer.purpose === "approve"
                      ? confirmApprove.intentLabel
                      : confirmTransfer.intentLabel}
                  </p>
                  <div className="flex items-center gap-4">
                    {call.transfer.tokenAddress ? (
                      <AssetIdentityMark
                        chainId={request.chainId}
                        address={call.transfer.tokenAddress}
                        symbol={call.transfer.symbol}
                        iconUrl={call.transfer.iconUrl}
                        chainLogoUrl={chain?.logoUrl}
                      />
                    ) : (
                      <SafeAssetImage
                        src={call.transfer.iconUrl ?? chain?.logoUrl}
                        alt={call.transfer.symbol}
                        className="size-16 shrink-0 rounded-full object-cover"
                        fallback={
                          <div className="bg-muted text-foreground flex size-16 items-center justify-center rounded-full text-2xl font-semibold">
                            {(
                              call.transfer.symbol.trim()[0] ?? "?"
                            ).toUpperCase()}
                          </div>
                        }
                      />
                    )}
                    <span className="text-xl font-semibold tracking-tight">
                      {call.transfer.amount} {call.transfer.symbol}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      {call.transfer.purpose === "approve"
                        ? confirmApprove.spenderLabel
                        : confirmTransfer.receiverLabel}
                    </span>
                    <CopyableText
                      text={call.transfer.recipient}
                      truncate
                      copyLabel={accountCopy.copyAddressLabel}
                      copiedLabel={accountCopy.addressCopiedLabel}
                      copyFailedLabel={accountCopy.addressCopyFailedLabel}
                    />
                  </div>
                  {approveNative ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        {clearCopy.nativeValueLabel}
                      </span>
                      <span className="text-sm font-medium">
                        {approveNative}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : call.clearSigning ? (
                <div className="flex flex-col gap-3">
                  <p className="text-foreground m-0 text-sm font-semibold">
                    {call.clearSigning.display.intent}
                  </p>
                  <ClearSigningDetails
                    presentation={call.clearSigning}
                    chainId={request.chainId}
                  />
                  {hasNativeValue(call.value) ? (
                    <LabeledBlock
                      label={txCopy.valueLabel}
                      content={call.value}
                    />
                  ) : null}
                  <details className="mb-1">
                    <summary className="text-muted-foreground mb-2 cursor-pointer text-xs font-medium select-none">
                      {clearCopy.rawTransactionLabel}
                    </summary>
                    <LabeledBlock
                      label={txCopy.contractLabel}
                      content={call.to}
                    />
                    <LabeledBlock
                      label={txCopy.dataLabel}
                      content={call.data}
                    />
                  </details>
                </div>
              ) : (
                <>
                  <LabeledBlock
                    label={txCopy.contractLabel}
                    content={call.to}
                  />
                  {hasNativeValue(call.value) ? (
                    <LabeledBlock
                      label={txCopy.valueLabel}
                      content={call.value}
                    />
                  ) : null}
                  <LabeledBlock label={txCopy.dataLabel} content={call.data} />
                </>
              )}
            </li>
          );
        })}
      </ul>
      <RelayerConfirmModalChrome
        chainId={request.chainId as EVMChainId}
        ownerAddress={request.account as EVMAccountAddress}
        work={request.work}
        submit={submit}
      />
      </>
      )}
    </Modal>
  );
}
