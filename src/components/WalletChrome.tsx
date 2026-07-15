import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "../wallet/WalletProvider";
import { useStyle } from "../style";

export function WalletChrome() {
  const { requestHide } = useWallet();
  const { style } = useStyle();

  return (
    <header
      className="border-border bg-background text-foreground flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5"
      aria-label="Wallet panel"
    >
      <div className="flex min-w-0 items-center gap-2">
        {style.copy.logoUrl ? (
          <img
            src={style.copy.logoUrl}
            alt=""
            className="size-6 shrink-0 rounded-sm object-contain"
          />
        ) : null}
        <h2 className="m-0 truncate text-[0.9rem] font-semibold tracking-tight">
          {style.copy.productName}
        </h2>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Close wallet"
        onClick={() => {
          void requestHide();
        }}
      >
        <XIcon />
      </Button>
    </header>
  );
}
