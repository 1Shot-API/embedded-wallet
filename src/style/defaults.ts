import type { IResolvedStyle } from "./types";

/** 1Shot default branding (shadcn nova / neutral tokens). */
export const DEFAULT_STYLE: IResolvedStyle = {
  theme: {
    primary: "oklch(0.205 0 0)",
    primaryForeground: "oklch(0.985 0 0)",
    background: "oklch(1 0 0)",
    foreground: "oklch(0.145 0 0)",
    muted: "oklch(0.97 0 0)",
    mutedForeground: "oklch(0.556 0 0)",
    border: "oklch(0.922 0 0)",
    accent: "oklch(0.97 0 0)",
    accentForeground: "oklch(0.205 0 0)",
    radius: "0.625rem",
    fontSans: "'Geist Variable', ui-sans-serif, system-ui, sans-serif",
  },
  copy: {
    productName: "1Shot Wallet",
    tagline: "Passkey-secured embedded wallet",
    connect: {
      title: "Connect wallet",
      body: "The connected app is requesting your wallet address. You may be asked to verify with your passkey after you continue.",
      rejectLabel: "Reject",
      continueLabel: "Continue",
    },
    walletSetup: {
      title: "Set up your wallet",
      body: "This wallet uses a passkey to secure your keys on this device. Log in with an existing passkey or create a new account before continuing.",
      cancelLabel: "Cancel",
      loginLabel: "Login with passkey",
      createLabel: "Create account",
    },
  },
  dark: false,
};
