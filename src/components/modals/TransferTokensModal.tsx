import { useCallback, useMemo, useState } from "react";
import {
  encodeFunctionData,
  erc20Abi,
  parseUnits,
  type Hex,
} from "viem";
import { AddressUtils } from "@1shotapi/ows-wallet-utils";
import {
  EChainTechnology,
  HexString,
  type EVMAccountAddress,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import type { TrackedAsset } from "../../lib/types/business";
import { EAssetType } from "../../lib/types/enum";
import { useStyle } from "../../style";
import { chainTechnologyFor } from "../../wallet/activeAddress";
import { useWallet } from "../../wallet/WalletProvider";
import { Modal } from "../Modal";
import {
  AddressInput,
  type AddressInputValue,
} from "../AddressInput";
import { TokenAmountInput } from "../TokenAmountInput";

export interface ITransferTokensModalProps {
  asset: TrackedAsset;
  addressUtils: AddressUtils;
  onClose: () => void;
  onSuccess: (hash: EVMTransactionHash) => void;
}

/**
 * User-initiated ERC-20 send. Collects recipient/amount, then submits via the
 * relayer (`sendTransaction`) — not through host EIP-1193 consent.
 */
export function TransferTokensModal({
  asset,
  addressUtils,
  onClose,
  onSuccess,
}: ITransferTokensModalProps) {
  const { style } = useStyle();
  const copy = style.copy.transferTokens;
  const { switchChain, sendTransaction } = useWallet();
  const [amount, setAmount] = useState("");
  const [recipientText, setRecipientText] = useState("");
  const [recipient, setRecipient] = useState<AddressInputValue>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const technology = useMemo(
    () => chainTechnologyFor(asset.chainId),
    [asset.chainId],
  );

  const onValidated = useCallback((address: AddressInputValue) => {
    setRecipient(address);
  }, []);

  async function handleSend(): Promise<void> {
    setSubmitError(null);
    setAmountError(null);

    if (asset.type !== EAssetType.Erc20) {
      setSubmitError(copy.sendFailedError);
      return;
    }
    if (technology !== EChainTechnology.Evm) {
      setSubmitError(copy.invalidAddressError);
      return;
    }
    if (!recipient) {
      setSubmitError(copy.invalidAddressError);
      return;
    }

    let parsed: bigint;
    try {
      parsed = parseUnits(amount.trim(), asset.decimals);
    } catch {
      setAmountError(copy.invalidAmountError);
      return;
    }
    if (parsed <= 0n) {
      setAmountError(copy.invalidAmountError);
      return;
    }
    if (asset.balance !== null && parsed > asset.balance) {
      setAmountError(copy.insufficientBalanceError);
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
      const hash = await sendTransaction(asset.chainId, asset.address, data);
      onSuccess(hash);
      onClose();
    } catch (error: unknown) {
      console.error("[oneshot-wallet] transfer failed", error);
      setSubmitError(
        error instanceof Error ? error.message : copy.sendFailedError,
      );
    } finally {
      setBusy(false);
    }
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
          disabled: busy,
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
          onChange={setAmount}
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
        {submitError ? (
          <p className="text-destructive text-xs" role="alert">
            {submitError}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
