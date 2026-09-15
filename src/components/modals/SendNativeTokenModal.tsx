import { useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import {
  EChainTechnology,
  type EVMAccountAddress,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import type { TrackedAsset } from "../../lib/types/domain";
import { EAssetType } from "../../lib/types/enum/EAssetType";
import { maxNativeSendable } from "../../lib/interfaces/business";
import { useStyle } from "../../style/StyleProvider";
import { chainTechnologyFor } from "../../wallet/activeAddress";
import { useLiveTrackedBalance } from "../../wallet/useLiveTrackedBalance";
import { useWallet } from "../../wallet/WalletProvider";
import { useWalletSessionStore } from "../../wallet/sessionStore";
import { Modal } from "../Modal";
import {
  AddressInput,
  type AddressInputValue,
} from "../AddressInput";
import { SentTransactionModal } from "./SentTransactionModal";
import { TokenAmountInput } from "../TokenAmountInput";

export interface ISendNativeTokenModalProps {
  asset: TrackedAsset;
  onClose: () => void;
  onSuccess: (hash: EVMTransactionHash) => void;
}

function amountValidationError(
  raw: string,
  decimals: number,
  balance: bigint | null,
  feeAtoms: bigint | null,
  copy: {
    invalidAmountError: string;
    insufficientBalanceError: string;
  },
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  let parsed: bigint;
  try {
    parsed = parseUnits(trimmed, decimals);
  } catch {
    return copy.invalidAmountError;
  }
  if (parsed <= 0n) {
    return copy.invalidAmountError;
  }
  if (balance !== null && feeAtoms !== null && parsed + feeAtoms > balance) {
    return copy.insufficientBalanceError;
  }
  if (balance !== null && feeAtoms === null && parsed > balance) {
    return copy.insufficientBalanceError;
  }
  return null;
}

/**
 * In-wallet native (ETH-style) Send. Always broadcasts a raw value transfer —
 * never the public relayer — even on `useRelayer` chains.
 */
export function SendNativeTokenModal({
  asset,
  onClose,
  onSuccess,
}: ISendNativeTokenModalProps) {
  const { style } = useStyle();
  const copy = style.copy.sendNativeToken;
  const {
    switchChain,
    sendNativeTransfer,
    estimateNativeTransferFee,
    recordSentActivity,
    addressUtils,
  } = useWallet();
  const [amount, setAmount] = useState("");
  const [recipientText, setRecipientText] = useState("");
  const [recipient, setRecipient] = useState<AddressInputValue>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feeBusy, setFeeBusy] = useState(false);
  const [feeAtoms, setFeeAtoms] = useState<bigint | null>(null);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [sentHash, setSentHash] = useState<EVMTransactionHash | null>(null);

  const evmAddress = useWalletSessionStore((state) => state.evmAddress);
  const { balance, decimals } = useLiveTrackedBalance(
    asset.id,
    asset.balance,
    asset.decimals,
  );

  const technology = useMemo(
    () => chainTechnologyFor(asset.chainId),
    [asset.chainId],
  );

  const refreshFee = useCallback(async () => {
    setFeeBusy(true);
    setFeeError(null);
    try {
      const estimate = await estimateNativeTransferFee(asset.chainId);
      setFeeAtoms(estimate.feeAtoms);
    } catch (error: unknown) {
      console.error("[oneshot-wallet] native fee estimate failed", error);
      setFeeAtoms(null);
      setFeeError(copy.feeEstimateFailedError);
    } finally {
      setFeeBusy(false);
    }
  }, [asset.chainId, copy.feeEstimateFailedError, estimateNativeTransferFee]);

  useEffect(() => {
    void refreshFee();
  }, [refreshFee]);

  const amountError = useMemo(
    () => amountValidationError(amount, decimals, balance, feeAtoms, copy),
    [amount, balance, decimals, feeAtoms, copy],
  );

  const canSubmit = useMemo(() => {
    if (busy || feeBusy || asset.type !== EAssetType.Native) {
      return false;
    }
    if (technology !== EChainTechnology.Evm || !recipient) {
      return false;
    }
    if (!amount.trim() || amountError || feeAtoms === null || feeError) {
      return false;
    }
    return true;
  }, [
    amount,
    amountError,
    asset.type,
    busy,
    feeAtoms,
    feeBusy,
    feeError,
    recipient,
    technology,
  ]);

  const onValidated = useCallback((address: AddressInputValue) => {
    setRecipient(address);
  }, []);

  const onAmountChange = useCallback((next: string) => {
    setAmount(next);
    setSubmitError(null);
  }, []);

  const handleMax = useCallback(async () => {
    setSubmitError(null);
    setFeeBusy(true);
    setFeeError(null);
    try {
      const estimate = await estimateNativeTransferFee(asset.chainId);
      setFeeAtoms(estimate.feeAtoms);
      if (balance === null) {
        return;
      }
      const max = maxNativeSendable(balance, estimate.feeAtoms);
      setAmount(max > 0n ? formatUnits(max, decimals) : "");
    } catch (error: unknown) {
      console.error("[oneshot-wallet] native Max failed", error);
      setFeeAtoms(null);
      setFeeError(copy.feeEstimateFailedError);
    } finally {
      setFeeBusy(false);
    }
  }, [
    asset.chainId,
    balance,
    copy.feeEstimateFailedError,
    decimals,
    estimateNativeTransferFee,
  ]);

  async function handleSend(): Promise<void> {
    setSubmitError(null);

    if (!canSubmit || !recipient || !evmAddress || feeAtoms === null) {
      return;
    }

    let parsed: bigint;
    try {
      parsed = parseUnits(amount.trim(), decimals);
    } catch {
      return;
    }
    if (balance !== null && parsed + feeAtoms > balance) {
      setSubmitError(copy.insufficientBalanceError);
      return;
    }

    setBusy(true);
    try {
      await switchChain(asset.chainId);
      const hash = await sendNativeTransfer(
        asset.chainId,
        recipient as EVMAccountAddress,
        parsed,
      );
      await recordSentActivity({
        chainId: asset.chainId,
        tokenAddress: asset.address,
        owner: evmAddress,
        to: recipient as EVMAccountAddress,
        amount: parsed,
        decimals,
        hash,
      });
      onSuccess(hash);
      setSentHash(hash);
    } catch (error: unknown) {
      console.error("[oneshot-wallet] native send failed", error);
      setSubmitError(
        error instanceof Error ? error.message : copy.sendFailedError,
      );
    } finally {
      setBusy(false);
    }
  }

  const feeDisplay =
    feeAtoms !== null
      ? `${formatUnits(feeAtoms, decimals)} ${asset.symbol}`
      : feeBusy
        ? copy.feeEstimatingLabel
        : "—";

  const youSendDisplay = amount.trim()
    ? `${amount.trim()} ${asset.symbol}`
    : "—";

  if (sentHash) {
    return (
      <SentTransactionModal
        chainId={asset.chainId}
        transactionHash={sentHash}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal
      title={copy.title}
      onBackdropDismiss={busy ? undefined : onClose}
      actions={[
        {
          label: copy.cancelLabel,
          variant: "secondary",
          disabled: busy,
          onClick: onClose,
        },
        {
          label: copy.sendLabel,
          variant: "primary",
          autoFocus: true,
          disabled: !canSubmit,
          onClick: () => void handleSend(),
        },
      ]}
    >
      <p className="text-muted-foreground m-0">{copy.body}</p>
      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs font-medium">
              {copy.amountLabel}
            </span>
            <button
              type="button"
              className="text-primary text-xs font-medium disabled:opacity-50"
              disabled={busy || feeBusy || balance === null}
              onClick={() => void handleMax()}
            >
              {copy.maxLabel}
            </button>
          </div>
          <TokenAmountInput
            label=""
            placeholder={copy.amountPlaceholder}
            symbol={asset.symbol}
            value={amount}
            onChange={onAmountChange}
            error={amountError}
            disabled={busy}
            className="[&>label]:sr-only"
          />
        </div>
        <AddressInput
          technology={technology}
          chainId={asset.chainId}
          addressUtils={addressUtils}
          value={recipientText}
          onChange={setRecipientText}
          onValidated={onValidated}
          label={copy.recipientLabel}
          placeholder={copy.recipientPlaceholder}
          scanQrLabel={copy.scanQrLabel}
          invalidAddressError={copy.invalidAddressError}
          disabled={busy}
        />
        <div className="bg-muted/40 flex flex-col gap-1.5 rounded-md px-3 py-2 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">{copy.feeLabel}</span>
            <span className="text-foreground font-medium">{feeDisplay}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">{copy.youSendLabel}</span>
            <span className="text-foreground font-medium">{youSendDisplay}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">{copy.theyReceiveLabel}</span>
            <span className="text-foreground font-medium">{youSendDisplay}</span>
          </div>
          {feeError ? (
            <p className="text-destructive m-0" role="alert">
              {feeError}
            </p>
          ) : null}
        </div>
        {submitError ? (
          <p className="text-destructive text-xs" role="alert">
            {submitError}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
