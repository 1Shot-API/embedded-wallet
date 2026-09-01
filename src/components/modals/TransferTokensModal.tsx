import { useCallback, useMemo, useState } from "react";
import {
  encodeFunctionData,
  erc20Abi,
  parseUnits,
  type Hex,
} from "viem";
import {
  EChainTechnology,
  HexString,
  type EVMAccountAddress,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import type { TrackedAsset } from "../../lib/types/domain";
import { EAssetType } from "../../lib/types/enum/EAssetType";
import type { IPaymentQuote } from "../../lib/interfaces/business";
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
import { PaymentFeePicker } from "../PaymentFeePicker";
import { SentTransactionModal } from "./SentTransactionModal";
import { TokenAmountInput } from "../TokenAmountInput";

export interface ITransferTokensModalProps {
  asset: TrackedAsset;
  onClose: () => void;
  onSuccess: (hash: EVMTransactionHash) => void;
}

function amountValidationError(
  raw: string,
  decimals: number,
  balance: bigint | null,
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
  if (balance !== null && parsed > balance) {
    return copy.insufficientBalanceError;
  }
  return null;
}

/**
 * User-initiated ERC-20 send. Collects recipient/amount, then submits via the
 * TransactionService (relayer 7710 or raw RPC) — not through host EIP-1193 consent.
 */
export function TransferTokensModal({
  asset,
  onClose,
  onSuccess,
}: ITransferTokensModalProps) {
  const { style } = useStyle();
  const copy = style.copy.transferTokens;
  const {
    switchChain,
    sendTransaction,
    recordSentActivity,
    addressUtils,
    resolveChain,
  } = useWallet();
  const [amount, setAmount] = useState("");
  const [recipientText, setRecipientText] = useState("");
  const [recipient, setRecipient] = useState<AddressInputValue>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentHash, setSentHash] = useState<EVMTransactionHash | null>(null);
  const [quote, setQuote] = useState<IPaymentQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const evmAddress = useWalletSessionStore((state) => state.evmAddress);
  const chainMeta = resolveChain(asset.chainId);
  const useRelayer = chainMeta?.useRelayer === true;

  // AssetDetails / list pass a snapshot; BalanceDisplay is live via events.
  // Validate against the same live balance or Send always hits insufficient.
  const { balance, decimals } = useLiveTrackedBalance(
    asset.id,
    asset.balance,
    asset.decimals,
  );

  const technology = useMemo(
    () => chainTechnologyFor(asset.chainId),
    [asset.chainId],
  );

  const amountError = useMemo(
    () => amountValidationError(amount, decimals, balance, copy),
    [amount, balance, decimals, copy],
  );

  const onQuoteChange = useCallback(
    (next: IPaymentQuote | null, error: string | null) => {
      setQuote(next);
      setQuoteError(error);
    },
    [],
  );

  const canSubmit = useMemo(() => {
    if (busy || asset.type !== EAssetType.Erc20) {
      return false;
    }
    if (technology !== EChainTechnology.Evm || !recipient) {
      return false;
    }
    if (!amount.trim() || amountError) {
      return false;
    }
    if (useRelayer && (!quote || quoteError)) {
      return false;
    }
    return true;
  }, [
    amount,
    amountError,
    asset.type,
    busy,
    quote,
    quoteError,
    recipient,
    technology,
    useRelayer,
  ]);

  const onValidated = useCallback((address: AddressInputValue) => {
    setRecipient(address);
  }, []);

  const onAmountChange = useCallback((next: string) => {
    setAmount(next);
    setSubmitError(null);
  }, []);

  async function handleSend(): Promise<void> {
    setSubmitError(null);

    if (!canSubmit || !recipient || !evmAddress) {
      return;
    }

    let parsed: bigint;
    try {
      parsed = parseUnits(amount.trim(), decimals);
    } catch {
      return;
    }
    if (balance !== null && parsed > balance) {
      setSubmitError(copy.insufficientBalanceError);
      return;
    }

    setBusy(true);
    try {
      await switchChain(asset.chainId);

      const data = HexString(
        encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [recipient as EVMAccountAddress, parsed],
        }) as Hex,
      );
      const hash = await sendTransaction(
        asset.chainId,
        asset.address,
        data,
        undefined,
        useRelayer && quote
          ? {
              paymentToken: quote.selectedToken,
              feeAtoms: quote.feeAtoms,
            }
          : undefined,
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
      console.error("[oneshot-wallet] transfer failed", error);
      setSubmitError(
        error instanceof Error ? error.message : copy.sendFailedError,
      );
    } finally {
      setBusy(false);
    }
  }

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
        <TokenAmountInput
          label={copy.amountLabel}
          placeholder={copy.amountPlaceholder}
          symbol={asset.symbol}
          value={amount}
          onChange={onAmountChange}
          error={amountError}
          disabled={busy}
        />
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
        {useRelayer && evmAddress ? (
          <PaymentFeePicker
            chainId={asset.chainId}
            ownerAddress={evmAddress}
            quote={quote}
            error={quoteError}
            loading={false}
            paused={busy}
            onQuoteChange={onQuoteChange}
          />
        ) : null}
        {submitError ? (
          <p className="text-destructive text-xs" role="alert">
            {submitError}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
