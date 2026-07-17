import { Button } from "@/components/ui/button";
import { useWallet } from "../wallet/WalletProvider";
import { useStyle } from "../style";
import { BrandLogo } from "./BrandLogo";

function taglineLines(tagline: string): string[] {
  return tagline
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function OnboardingPanel() {
  const { loginWithPasskey, createNewWalletFromUi } = useWallet();
  const { style } = useStyle();
  const { productName, tagline, logoUrl, walletSetup } = style.copy;
  const lines = taglineLines(tagline);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-8 text-center">
        <BrandLogo
          logoUrl={logoUrl}
          className="mb-6 size-[4.5rem] rounded-2xl"
        />

        <h1 className="text-foreground m-0 text-[1.35rem] font-bold tracking-tight">
          {productName}
        </h1>

        <div className="text-muted-foreground mt-3 mb-8 max-w-[17rem] space-y-1 text-[0.95rem] leading-snug">
          {lines.map((line) => (
            <p key={line} className="m-0">
              {line}
            </p>
          ))}
        </div>

        <div className="flex w-full max-w-[17rem] flex-col gap-3">
          <Button
            type="button"
            size="lg"
            className="h-11 w-full rounded-full text-[0.95rem] font-semibold"
            onClick={() => {
              void loginWithPasskey().catch((error: unknown) => {
                console.error("[wallet-setup] embedded login failed", error);
              });
            }}
          >
            {walletSetup.loginLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 w-full rounded-full text-[0.95rem] font-semibold"
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

      <footer className="border-border shrink-0 border-t px-6 py-3.5 text-center">
        <p className="text-muted-foreground m-0 text-[0.62rem] font-medium tracking-[0.18em] uppercase">
          Powered by 1Shot
        </p>
      </footer>
    </div>
  );
}
