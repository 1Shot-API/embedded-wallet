import { useCallback, useMemo, useState } from "react";
import { parseUnits, formatUnits } from "viem";
import {
  EChainTechnology,
  type BitcoinChainId,
  type BitcoinSegwitAccountAddress,
  type BitcoinTransactionHash,
} from "@1shotapi/ows-types";
import { useStyle } from "../../style/StyleProvider";
import { useWallet } from "../../wallet/WalletProvider";
import { Modal } from "../Modal";
import {
  AddressInput,
  type AddressInputValue,
} from "../AddressInput";
import { TokenAmountInput } from "../TokenAmountInput";
import { SentTransactionModal } from "./SentTransactionModal";
import {
  makeBitcoinSatoshiAmount,
  type BitcoinSatoshiAmount,
} from "../../lib/types/primitives/BitcoinSatoshiAmount";

export interface IBitcoinSendModalProps {
  chainId: BitcoinChainId;
  fromAddress: BitcoinSegwitAccountAddress;
  balanceSats: BitcoinSatoshiAmount | null;
  onClose: () => void;
  onSuccess: (txid: BitcoinTransactionHash) => void;
}

const BTC_DECIMALS = 8;

function amountValidationError(
  raw: string,
  balance: BitcoinSatoshiAmount | null,
  copy: {
    invalidAmountError: string;
    insufficientBalanceError: string;
  },
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let parsed: bigint;
  try {
    parsed = parseUnits(trimmed, BTC_DECIMALS);
  } catch {
    return copy.invalidAmountError;
  }
  if (parsed <= 0n) return copy.invalidAmountError;
  if (balance !== null && parsed > balance) {
    return copy.insufficientBalanceError;
  }
  return null;
}

/**
 * Bitcoin send form. CTA stays disabled until recipient + amount are valid.
 */
export function BitcoinSendModal({
  chainId,
  fromAddress,
  balanceSats,
  onClose,
  onSuccess,
}: IBitcoinSendModalProps) {
  const { style } = useStyle();
  const transfer = style.copy.transferTokens;
  const bitcoinCopy = style.copy.bitcoin;
  const { addressUtils, bitcoinService, resolveChain } = useWallet();

  const [amount, setAmount] = useState("");
  const [recipientText, setRecipientText] = useState("");
  const [recipient, setRecipient] = useState<AddressInputValue>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTxid, setSentTxid] = useState<BitcoinTransactionHash | null>(null);

  const amountError = useMemo(
    () => amountValidationError(amount, balanceSats, transfer),
    [amount, balanceSats, transfer],
  );

  const canSubmit = useMemo(() => {
    if (busy) return false;
    if (!recipient) return false;
    if (!amount.trim() || amountError) return false;
    return true;
  }, [amount, amountError, busy, recipient]);

  const balanceLabel =
    balanceSats === null
      ? null
      : `${formatUnits(balanceSats, BTC_DECIMALS)} ${bitcoinCopy.assetSymbol}`;

  const handleSend = useCallback(async () => {
    if (!recipient || typeof recipient !== "string") return;
    setBusy(true);
    setSubmitError(null);
    try {
      const amountSats = makeBitcoinSatoshiAmount(
        parseUnits(amount.trim(), BTC_DECIMALS),
      );
      const result = await bitcoinService.send({
        chainId,
        from: fromAddress,
        to: recipient as BitcoinSegwitAccountAddress,
        amountSats,
      });
      setSentTxid(result.txid);
      onSuccess(result.txid);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : transfer.sendFailedError,
      );
    } finally {
      setBusy(false);
    }
  }, [
    amount,
    bitcoinService,
    chainId,
    fromAddress,
    onSuccess,
    recipient,
    transfer.sendFailedError,
  ]);

  if (sentTxid) {
    return (
      <SentTransactionModal
        chainId={chainId}
        transactionHash={sentTxid}
        onClose={onClose}
      />
    );
  }

  const chainLabel = resolveChain(chainId)?.label ?? bitcoinCopy.assetName;

  return (
    <Modal
      title={transfer.title}
      onBackdropDismiss={busy ? undefined : onClose}
      actions={[
        {
          label: transfer.cancelLabel,
          variant: "secondary",
          disabled: busy,
          onClick: onClose,
        },
        {
          label: transfer.sendLabel,
          variant: "primary",
          disabled: !canSubmit || busy,
          onClick: () => {
            void handleSend();
          },
        },
      ]}
    >
      <p className="text-muted-foreground m-0">
        {transfer.body.replace("{chainLabel}", chainLabel)}
      </p>
      {balanceLabel ? (
        <p className="text-muted-foreground m-0 mt-2 text-sm">
          {balanceLabel}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-4">
        <TokenAmountInput
          value={amount}
          onChange={(next) => {
            setAmount(next);
            setSubmitError(null);
          }}
          label={transfer.amountLabel}
          placeholder={transfer.amountPlaceholder}
          symbol={bitcoinCopy.assetSymbol}
          disabled={busy}
          error={amountError}
        />
        <AddressInput
          technology={EChainTechnology.Bitcoin}
          chainId={chainId}
          addressUtils={addressUtils}
          value={recipientText}
          onChange={setRecipientText}
          onValidated={setRecipient}
          label={transfer.recipientLabel}
          placeholder={bitcoinCopy.recipientPlaceholder}
          scanQrLabel={transfer.scanQrLabel}
          invalidAddressError={bitcoinCopy.invalidAddressError}
          disabled={busy}
        />
        {submitError ? (
          <p className="text-destructive m-0 text-sm">{submitError}</p>
        ) : null}
      </div>
    </Modal>
  );
}
