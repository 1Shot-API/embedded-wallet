import {
  EChainTechnology,
  type SolanaAccountAddress,
  type SolanaChainId,
  type SolanaTransactionSignature,
} from "@1shotapi/ows-types";
import { useCallback, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";

import {
  makeSolanaLamports,
  type SolanaLamports,
} from "../../lib/types/primitives/SolanaLamports";
import { useStyle } from "../../style/StyleProvider";
import { useWallet } from "../../wallet/WalletProvider";
import { AddressInput, type AddressInputValue } from "../AddressInput";
import { Modal } from "../Modal";
import { TokenAmountInput } from "../TokenAmountInput";

import { SentTransactionModal } from "./SentTransactionModal";

export interface ISolanaSendModalProps {
  chainId: SolanaChainId;
  fromAddress: SolanaAccountAddress;
  balanceLamports: SolanaLamports | null;
  onClose: () => void;
  onSuccess: (signature: SolanaTransactionSignature) => void;
}

const SOL_DECIMALS = 9;
/** Match {@link SolanaService} estimated fee for insufficient-balance UX. */
const ESTIMATED_FEE_LAMPORTS = 5_000n;

function amountValidationError(
  raw: string,
  balance: SolanaLamports | null,
  copy: {
    invalidAmountError: string;
    insufficientBalanceError: string;
  },
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let parsed: bigint;
  try {
    parsed = parseUnits(trimmed, SOL_DECIMALS);
  } catch {
    return copy.invalidAmountError;
  }
  if (parsed <= 0n) return copy.invalidAmountError;
  if (balance !== null && parsed + ESTIMATED_FEE_LAMPORTS > balance) {
    return copy.insufficientBalanceError;
  }
  return null;
}

/**
 * Native SOL send form. CTA stays disabled until recipient + amount are valid.
 */
export function SolanaSendModal({
  chainId,
  fromAddress,
  balanceLamports,
  onClose,
  onSuccess,
}: ISolanaSendModalProps) {
  const { style } = useStyle();
  const transfer = style.copy.transferTokens;
  const nativeSend = style.copy.sendNativeToken;
  const solanaCopy = style.copy.solana;
  const { addressUtils, solanaService, resolveChain } = useWallet();

  const [amount, setAmount] = useState("");
  const [recipientText, setRecipientText] = useState("");
  const [recipient, setRecipient] = useState<AddressInputValue>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentSignature, setSentSignature] =
    useState<SolanaTransactionSignature | null>(null);

  const amountError = useMemo(
    () => amountValidationError(amount, balanceLamports, transfer),
    [amount, balanceLamports, transfer],
  );

  const canSubmit = useMemo(() => {
    if (busy) return false;
    if (!recipient) return false;
    if (!amount.trim() || amountError) return false;
    return true;
  }, [amount, amountError, busy, recipient]);

  const balanceLabel =
    balanceLamports === null
      ? null
      : `${formatUnits(balanceLamports, SOL_DECIMALS)} ${solanaCopy.assetSymbol}`;

  const feeLabel = `${formatUnits(ESTIMATED_FEE_LAMPORTS, SOL_DECIMALS)} ${solanaCopy.assetSymbol}`;

  const handleSend = useCallback(async () => {
    if (!recipient || typeof recipient !== "string") return;
    setBusy(true);
    setSubmitError(null);
    try {
      const amountLamports = makeSolanaLamports(
        parseUnits(amount.trim(), SOL_DECIMALS),
      );
      const result = await solanaService.send({
        chainId,
        from: fromAddress,
        to: recipient as SolanaAccountAddress,
        amountLamports,
      });
      setSentSignature(result.signature);
      onSuccess(result.signature);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : transfer.sendFailedError,
      );
    } finally {
      setBusy(false);
    }
  }, [
    amount,
    chainId,
    fromAddress,
    onSuccess,
    recipient,
    solanaService,
    transfer.sendFailedError,
  ]);

  if (sentSignature) {
    return (
      <SentTransactionModal
        chainId={chainId}
        transactionHash={sentSignature}
        onClose={onClose}
      />
    );
  }

  const chainLabel = resolveChain(chainId)?.label ?? solanaCopy.assetName;

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
        <p className="text-muted-foreground m-0 mt-2 text-sm">{balanceLabel}</p>
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
          symbol={solanaCopy.assetSymbol}
          disabled={busy}
          error={amountError}
        />
        <AddressInput
          technology={EChainTechnology.Solana}
          chainId={chainId}
          addressUtils={addressUtils}
          value={recipientText}
          onChange={setRecipientText}
          onValidated={setRecipient}
          label={transfer.recipientLabel}
          placeholder={solanaCopy.recipientPlaceholder}
          scanQrLabel={transfer.scanQrLabel}
          invalidAddressError={solanaCopy.invalidAddressError}
          disabled={busy}
        />
        <p className="text-muted-foreground m-0 text-xs">
          {nativeSend.feeLabel}: ~{feeLabel}
        </p>
        {submitError ? (
          <p className="text-destructive m-0 text-sm">{submitError}</p>
        ) : null}
      </div>
    </Modal>
  );
}
