import type { SolanaChainId, SolanaMintAddress } from "@1shotapi/ows-types";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";

import type { SolanaKnownAsset } from "../../lib/types/domain";
import { useStyle } from "../../style/StyleProvider";
import { useWallet } from "../../wallet/WalletProvider";
import { AssetIdentityMark } from "../AssetIdentityMark";
import { Modal } from "../Modal";

export interface ISolanaAddAssetModalProps {
  chainId: SolanaChainId;
  onClose: () => void;
  onAdded: () => void;
}

/**
 * Catalog USDC picker → rent consent → ensureAta + track.
 */
export function SolanaAddAssetModal({
  chainId,
  onClose,
  onAdded,
}: ISolanaAddAssetModalProps) {
  const { style } = useStyle();
  const solanaCopy = style.copy.solana;
  const { listSolanaKnownAssets, addSolanaTrackedAsset, solanaService } =
    useWallet();

  const [catalog, setCatalog] = useState<SolanaKnownAsset[]>([]);
  const [selected, setSelected] = useState<SolanaKnownAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rentLamports = solanaService.estimateAtaRentLamports();
  const rentLabel = formatUnits(rentLamports, 9);

  useEffect(() => {
    void listSolanaKnownAssets(chainId).then(setCatalog);
  }, [chainId, listSolanaKnownAssets]);

  const onSubmit = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await addSolanaTrackedAsset(
        chainId,
        selected.address as SolanaMintAddress,
      );
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
          disabled: busy || !selected,
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
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {catalog.map((asset) => {
            const isSelected = selected?.address === asset.address;
            return (
              <li key={`${asset.chainId}:${asset.address}`}>
                <button
                  type="button"
                  disabled={busy}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/60"
                  }`}
                  onClick={() => setSelected(asset)}
                >
                  <AssetIdentityMark
                    chainId={asset.chainId}
                    address={asset.address}
                    symbol={asset.symbol}
                    iconUrl={asset.iconUrl}
                    className="size-10!"
                  />
                  <div className="min-w-0">
                    <p className="m-0 truncate text-sm font-medium">
                      {asset.name}
                    </p>
                    <p className="text-muted-foreground m-0 text-xs">
                      {asset.symbol}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        {catalog.length === 0 ? (
          <p className="text-muted-foreground m-0 text-sm">
            No catalog assets for this cluster.
          </p>
        ) : null}
        {error ? (
          <p className="text-destructive m-0 text-sm">{error}</p>
        ) : null}
      </div>
    </Modal>
  );
}
