import { useState } from "react";
import { EVMAccountAddress } from "@1shotapi/ows-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "../Modal";
import { useStyle } from "../../style/StyleProvider";
import { useWallet } from "../../wallet/WalletProvider";
import { useWalletSessionStore } from "../../wallet/sessionStore";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export interface IAddAssetViewProps {
  onClose: () => void;
}

/** Full-page add-asset flow (current network). */
export function AddAssetView({ onClose }: IAddAssetViewProps) {
  const { style } = useStyle();
  const { balances: copy } = style.copy;
  const { addTrackedAsset } = useWallet();
  const chainId = useWalletSessionStore((state) => state.chainId);

  const [addressInput, setAddressInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const onSubmit = async () => {
    const trimmed = addressInput.trim();
    if (!ADDRESS_RE.test(trimmed)) {
      setError(copy.invalidAddressError);
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await addTrackedAsset(
        chainId,
        EVMAccountAddress(trimmed as `0x${string}`),
      );
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : copy.addFailedError);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Modal
      title={copy.addDialogTitle}
      onBackdropDismiss={onClose}
      actions={[
        {
          label: copy.addDialogCancelLabel,
          variant: "secondary",
          onClick: onClose,
          disabled: adding,
        },
        {
          label: copy.addDialogSubmitLabel,
          variant: "primary",
          disabled: adding,
          onClick: () => {
            void onSubmit();
          },
        },
      ]}
    >
      <div className="text-foreground flex flex-col gap-4">
        <p className="text-muted-foreground m-0 text-sm leading-relaxed">
          {copy.addDialogBody}
        </p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="add-asset-address">{copy.addressLabel}</Label>
          <Input
            id="add-asset-address"
            value={addressInput}
            placeholder={copy.addressPlaceholder}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            disabled={adding}
            onChange={(event) => setAddressInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void onSubmit();
              }
            }}
          />
          {error ? (
            <p className="text-destructive m-0 text-sm">{error}</p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
