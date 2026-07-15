import { useWallet } from "../wallet/WalletProvider";
import { useStyle } from "../style";

export function WalletChrome() {
  const { requestHide } = useWallet();
  const { style } = useStyle();

  return (
    <header
      className="border-border flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5"
      aria-label="Wallet panel"
    >
      <h2 className="m-0 text-[0.9rem] font-semibold">{style.copy.productName}</h2>
      <button
        type="button"
        aria-label="Close wallet"
        onClick={() => {
          void requestHide();
        }}
        className="border-border text-foreground hover:bg-muted flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border bg-transparent text-lg leading-none"
      >
        ×
      </button>
    </header>
  );
}
