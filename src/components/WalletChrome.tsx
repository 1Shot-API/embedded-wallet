import { SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStyle } from "../style/StyleProvider";
import { useWallet } from "../wallet/WalletProvider";
import { BrandLogo } from "./BrandLogo";
import { CloseWalletButton } from "./CloseWalletButton";

/**
 * Top shell bar: brand logo + product name + settings / close.
 */
export function WalletChrome() {
  const { openAdvancedOptions } = useWallet();
  const { style } = useStyle();

  return (
    <header
      className="border-border flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5"
      aria-label="Wallet panel"
    >
      <div className="flex min-w-0 items-center gap-2">
        <BrandLogo logoUrl={style.copy.logoUrl} className="size-5" alt="" />
        <h2 className="m-0 truncate text-[0.9rem] font-semibold tracking-tight">
          {style.copy.productName}
        </h2>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={style.copy.advancedOptions.menuLabel}
          onClick={() => {
            void openAdvancedOptions().catch((error: unknown) => {
              console.error("[advanced-options] failed", error);
            });
          }}
        >
          <SettingsIcon />
        </Button>
        <CloseWalletButton />
      </div>
    </header>
  );
}
