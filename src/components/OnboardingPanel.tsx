import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import oneShotIcon from "@/assets/1Shot-Icon-New.svg";
import { useWallet } from "../wallet/WalletProvider";
import { useStyle } from "../style";

export function OnboardingPanel() {
  const { loginWithPasskey, createNewWalletFromUi } = useWallet();
  const { style } = useStyle();
  const { walletSetup } = style.copy;
  const logoSrc = style.copy.logoUrl || oneShotIcon;

  return (
    <div className="text-foreground flex w-full max-w-sm flex-col items-center text-center">
      <img
        src={logoSrc}
        alt=""
        className="mb-6 size-24 object-contain"
      />

      <h2 className="mb-3 text-2xl font-bold tracking-tight">
        {style.copy.productName}
      </h2>

      <p className="text-muted-foreground mb-6 max-w-xs text-[0.95rem] leading-relaxed whitespace-pre-line">
        {walletSetup.body}
      </p>

      <div className="flex w-full flex-col gap-3">
        <Button
          type="button"
          size="lg"
          className="h-12 w-full rounded-full text-base font-semibold shadow-sm"
          onClick={() => {
            void loginWithPasskey().catch((error: unknown) => {
              console.error("[wallet-setup] embedded login failed", error);
            });
          }}
        >
          {walletSetup.loginLabel}
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-12 w-full rounded-full text-base font-semibold"
          onClick={() => {
            void createNewWalletFromUi().catch((error: unknown) => {
              console.error("[wallet-setup] embedded create failed", error);
            });
          }}
        >
          {walletSetup.createLabel}
        </Button>
      </div>
    </div>
  );
}
