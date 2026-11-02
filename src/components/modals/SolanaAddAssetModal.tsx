import {
  SolanaAddressUtils,
  type SolanaChainId,
  type SolanaMintAddress,
} from "@1shotapi/ows-types";
import { useMemo, useState } from "react";
import { formatUnits } from "viem";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useStyle } from "../../style/StyleProvider";
import { useWallet } from "../../wallet/WalletProvider";
import { Modal } from "../Modal";

export interface ISolanaAddAssetModalProps {
  chainId: SolanaChainId;
  onClose: () => void;
  onAdded: () => void;
}

/**
 * Mint address → rent consent → ensureAta + track (any SPL mint).
 */
export function SolanaAddAssetModal({
  chainId,
  onClose,
  onAdded,
}: ISolanaAddAssetModalProps) {
  const { style } = useStyle();
  const solanaCopy = style.copy.solana;
  const { addSolanaTrackedAsset, solanaService } = useWallet();

  const [mintInput, setMintInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rentLamports = solanaService.estimateAtaRentLamports();
  const rentLabel = formatUnits(rentLamports, 9);

  const parsedMint = useMemo((): SolanaMintAddress | null => {
    const trimmed = mintInput.trim();
    if (!trimmed) return null;
    try {
      return SolanaAddressUtils.asMintAddress(trimmed);
    } catch {
      return null;
    }
  }, [mintInput]);

  const mintError = useMemo(() => {
    const trimmed = mintInput.trim();
    if (!trimmed) return null;
    if (!parsedMint) return solanaCopy.invalidMintError;
    return null;
  }, [mintInput, parsedMint, solanaCopy.invalidMintError]);

  const canSubmit = Boolean(parsedMint) && !mintError && !busy;

  const onSubmit = async () => {
    if (!parsedMint) return;
    setBusy(true);
    setError(null);
    try {
      await addSolanaTrackedAsset(chainId, parsedMint);
      onAdded();
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : solanaCopy.addAssetFailedError;
      if (/insufficient sol/i.test(message)) {
        setError(solanaCopy.addAssetInsufficientSolError);
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={solanaCopy.addAssetTitle}
      onBackdropDismiss={busy ? undefined : onClose}
      actions={[
        {
          label: solanaCopy.addAssetCancelLabel,
          variant: "secondary",
          onClick: onClose,
          disabled: busy,
        },
        {
          label: busy
            ? solanaCopy.addAssetBusyLabel
            : solanaCopy.addAssetSubmitLabel,
          variant: "primary",
          disabled: !canSubmit,
          onClick: () => {
            void onSubmit();
          },
        },
      ]}
    >
      <div className="text-foreground flex flex-col gap-4">
        <p className="text-muted-foreground m-0 text-sm leading-relaxed">
          {solanaCopy.addAssetBody}
        </p>
        <p className="text-muted-foreground m-0 text-sm">
          {solanaCopy.addAssetRentWarning.replace("{rent}", rentLabel)}
        </p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="add-solana-mint">{solanaCopy.mintAddressLabel}</Label>
          <Input
            id="add-solana-mint"
            value={mintInput}
            placeholder={solanaCopy.mintAddressPlaceholder}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            disabled={busy}
            onChange={(event) => {
              setMintInput(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canSubmit) {
                event.preventDefault();
                void onSubmit();
              }
            }}
          />
          {mintError ? (
            <p className="text-destructive m-0 text-sm">{mintError}</p>
          ) : null}
          {error ? (
            <p className="text-destructive m-0 text-sm">{error}</p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
