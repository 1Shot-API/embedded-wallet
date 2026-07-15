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
    passkeyName: {
      title: "Name your passkey",
      body: "Choose a name for this wallet passkey. Your device will use it when you create the credential and when you sign in later.",
      fieldLabel: "Account name",
      placeholder: "e.g. My wallet",
      emptyError: "Enter a name for your passkey.",
      cancelLabel: "Cancel",
      continueLabel: "Continue",
    },
    personalSign: {
      title: "Sign message",
      accountLabel: "Account",
      messageLabel: "Message",
      rejectLabel: "Reject",
      signLabel: "Sign",
    },
    typedData: {
      title: "Sign typed data",
      accountLabel: "Account",
      primaryTypeLabel: "Primary type",
      domainLabel: "Domain",
      messageLabel: "Message",
      rejectLabel: "Reject",
      signLabel: "Sign",
    },
  },
  dark: false,
};
