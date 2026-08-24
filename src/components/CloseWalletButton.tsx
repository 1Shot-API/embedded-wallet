import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStyle } from "../style/StyleProvider";
import { useWallet } from "../wallet/WalletProvider";

/**
 * Chrome Close (X) control — respects `features.hideCloseBox`.
 */
export function CloseWalletButton({ className }: { className?: string }) {
  const { requestHide } = useWallet();
  const { style } = useStyle();

  if (style.features.hideCloseBox) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={className}
      aria-label="Close wallet"
      onClick={() => {
        void requestHide();
      }}
    >
      <XIcon />
    </Button>
  );
}
