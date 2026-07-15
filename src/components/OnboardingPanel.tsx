import { Button } from "@/components/ui/button";
import { useWallet } from "../wallet/WalletProvider";
import { useStyle } from "../style";

export function OnboardingPanel() {
  const { loginWithPasskey, createNewWalletFromUi } = useWallet();
  const { style } = useStyle();

  return (
    <div className="text-foreground py-2">
      <h2 className="mb-1 text-lg font-semibold tracking-tight">
        {style.copy.productName}
      </h2>
      <p className="text-muted-foreground mb-4 text-[0.95rem]">
        {style.copy.tagline}. Log in with an existing passkey or create a new
        wallet account to get started.
      </p>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          className="w-full"
          onClick={() => {
            void loginWithPasskey().catch((error: unknown) => {
              console.error("[wallet-setup] embedded login failed", error);
            });
          }}
        >
          Login with passkey
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            void createNewWalletFromUi().catch((error: unknown) => {
              console.error("[wallet-setup] embedded create failed", error);
            });
          }}
        >
          Create account
        </Button>
      </div>
    </div>
  );
}
