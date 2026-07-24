import { useState } from "react";
import { EVMAccountAddress } from "@1shotapi/ows-types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TrackedAsset } from "../../lib/types/domain";
import { useStyle } from "../../style/StyleProvider";
import { useWallet } from "../../wallet/WalletProvider";
import { useWalletSessionStore } from "../../wallet/sessionStore";
import { AssetList } from "./AssetList";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export interface IBalancesTabProps {
  onView: (asset: TrackedAsset) => void;
}

export function BalancesTab({ onView }: IBalancesTabProps) {
  const { style } = useStyle();
  const { balances: copy } = style.copy;
  const { addTrackedAsset } = useWallet();
  const chainId = useWalletSessionStore((state) => state.chainId);

  const [addOpen, setAddOpen] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const onSubmitAdd = async () => {
    const trimmed = addressInput.trim();
    if (!ADDRESS_RE.test(trimmed)) {
      setAddError(copy.invalidAddressError);
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      await addTrackedAsset(
        chainId,
        EVMAccountAddress(trimmed as `0x${string}`),
      );
      setAddOpen(false);
      setAddressInput("");
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : copy.addFailedError);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <AssetList onView={onView} />

      <Button
        type="button"
        size="sm"
        className="self-center"
        onClick={() => {
          setAddError(null);
          setAddressInput("");
          setAddOpen(true);
        }}
      >
        {copy.addLabel}
      </Button>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            setAddError(null);
            setAddressInput("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{copy.addDialogTitle}</DialogTitle>
            <DialogDescription>{copy.addDialogBody}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="add-asset-address">{copy.addressLabel}</Label>
            <Input
              id="add-asset-address"
              value={addressInput}
              placeholder={copy.addressPlaceholder}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setAddressInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onSubmitAdd();
                }
              }}
            />
            {addError ? (
              <p className="text-destructive m-0 text-sm">{addError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={adding}
              onClick={() => setAddOpen(false)}
            >
              {copy.addDialogCancelLabel}
            </Button>
            <Button
              type="button"
              disabled={adding}
              onClick={() => {
                void onSubmitAdd();
              }}
            >
              {copy.addDialogSubmitLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
