import {
  EChainTechnology,
  type SolanaAccountAddress,
  type SolanaChainId,
  type SolanaMintAddress,
  type SolanaTransactionHash,
} from "@1shotapi/ows-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";

import type { TrackedAsset } from "../../lib/types/domain";
import { useStyle } from "../../style/StyleProvider";
import { useWallet } from "../../wallet/WalletProvider";
import { AddressInput, type AddressInputValue } from "../AddressInput";
import { Modal } from "../Modal";
import { TokenAmountInput } from "../TokenAmountInput";

import { SentTransactionModal } from "./SentTransactionModal";

export interface ISolanaSendSplModalProps {
  chainId: SolanaChainId;
  fromAddress: SolanaAccountAddress;
  asset: TrackedAsset;
  onClose: () => void;
  onSuccess: (signature: SolanaTransactionHash) => void;
}

/**
 * SPL send with CreateIdempotent + rent warning when recipient ATA is missing.
 */
export function SolanaSendSplModal({
  chainId,
  fromAddress,
  asset,
  onClose,
  onSuccess,
}: ISolanaSendSplModalProps) {
  const { style } = useStyle();
  const transfer = style.copy.transferTokens;
  const solanaCopy = style.copy.solana;
  const { addressUtils, solanaService, resolveChain } = useWallet();

  const [amount, setAmount] = useState("");
  const [recipientText, setRecipientText] = useState("");
  const [recipient, setRecipient] = useState<AddressInputValue>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentSignature, setSentSignature] =
    useState<SolanaTransactionHash | null>(null);
  const [destNeedsAta, setDestNeedsAta] = useState(false);

  const rentLamports = solanaService.estimateAtaRentLamports();
  const rentLabel = formatUnits(rentLamports, 9);

  const amountError = useMemo(() => {
    const trimmed = amount.trim();
    if (!trimmed) return null;
    let parsed: bigint;
    try {
      parsed = parseUnits(trimmed, asset.decimals);
    } catch {
      return transfer.invalidAmountError;
    }
    if (parsed <= 0n) return transfer.invalidAmountError;
    if (asset.balance !== null && parsed > asset.balance) {
      return transfer.insufficientBalanceError;
    }
    return null;
  }, [amount, asset.balance, asset.decimals, transfer]);

  useEffect(() => {
    if (!recipient || typeof recipient !== "string") {
      setDestNeedsAta(false);
      return;
    }
    let cancelled = false;
    void solanaService
      .recipientAtaExists(
        chainId,
        recipient as SolanaAccountAddress,
        asset.address as SolanaMintAddress,
      )
      .then(({ exists }) => {
        if (!cancelled) setDestNeedsAta(!exists);
      })
      .catch(() => {
        if (!cancelled) setDestNeedsAta(false);
      });
    return () => {
      cancelled = true;
    };
  }, [asset.address, chainId, recipient, solanaService]);

  const canSubmit = useMemo(() => {
    if (busy) return false;
    if (!recipient) return false;
    if (!amount.trim() || amountError) return false;
    return true;
  }, [amount, amountError, busy, recipient]);

  const title = solanaCopy.sendSplTitle.replace("{symbol}", asset.symbol);
  const chainLabel = resolveChain(chainId)?.label ?? solanaCopy.assetName;

  const handleSend = useCallback(async () => {
    if (!recipient || typeof recipient !== "string") return;
    setBusy(true);
    setSubmitError(null);
    try {
      const parsed = parseUnits(amount.trim(), asset.decimals);
      const result = await solanaService.sendSpl({
        chainId,
        from: fromAddress,
        to: recipient as SolanaAccountAddress,
        mint: asset.address as SolanaMintAddress,
        amount: parsed,
        decimals: asset.decimals,
      });
      setSentSignature(result.signature);
      onSuccess(result.signature);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : transfer.sendFailedError;
      if (/insufficient sol/i.test(message) && /token account/i.test(message)) {
        setSubmitError(solanaCopy.insufficientSolForAtaError);
      } else {
        setSubmitError(message);
      }
    } finally {
      setBusy(false);
    }
  }, [
    amount,
    asset.address,
    asset.decimals,
    chainId,
    fromAddress,
    onSuccess,
    recipient,
    solanaCopy.insufficientSolForAtaError,
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

  return (
    <Modal
      title={title}
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
      {asset.balance !== null ? (
        <p className="text-muted-foreground m-0 mt-2 text-sm">
          {formatUnits(asset.balance, asset.decimals)} {asset.symbol}
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
          symbol={asset.symbol}
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
        {destNeedsAta ? (
          <p className="text-muted-foreground m-0 text-sm leading-relaxed">
            {solanaCopy.createRecipientAtaWarning.replace("{rent}", rentLabel)}
          </p>
        ) : null}
        {submitError ? (
          <p className="text-destructive m-0 text-sm">{submitError}</p>
        ) : null}
      </div>
    </Modal>
  );
}
