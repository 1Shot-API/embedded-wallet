import type { IResolvedStyle, IStyleOptions } from "./types";
import { DEFAULT_STYLE } from "./defaults";

export function mergeStyle(
  current: IResolvedStyle,
  patch: IStyleOptions,
): IResolvedStyle {
  return {
    theme: {
      ...current.theme,
      ...patch.theme,
    },
    copy: {
      productName: patch.copy?.productName ?? current.copy.productName,
      tagline: patch.copy?.tagline ?? current.copy.tagline,
      logoUrl: patch.copy?.logoUrl ?? current.copy.logoUrl,
      connect: {
        ...current.copy.connect,
        ...patch.copy?.connect,
      },
      walletSetup: {
        ...current.copy.walletSetup,
        ...patch.copy?.walletSetup,
      },
      passkeyName: {
        ...current.copy.passkeyName,
        ...patch.copy?.passkeyName,
      },
      personalSign: {
        ...current.copy.personalSign,
        ...patch.copy?.personalSign,
      },
      typedData: {
        ...current.copy.typedData,
        ...patch.copy?.typedData,
      },
      sendTransaction: {
        ...current.copy.sendTransaction,
        ...patch.copy?.sendTransaction,
      },
      credentialOffer: {
        ...current.copy.credentialOffer,
        ...patch.copy?.credentialOffer,
      },
      credentialPresentation: {
        ...current.copy.credentialPresentation,
        ...patch.copy?.credentialPresentation,
      },
      credentials: {
        ...current.copy.credentials,
        ...patch.copy?.credentials,
      },
      balances: {
        ...current.copy.balances,
        ...patch.copy?.balances,
      },
      createBackup: {
        ...current.copy.createBackup,
        ...patch.copy?.createBackup,
      },
      restoreBackup: {
        ...current.copy.restoreBackup,
        ...patch.copy?.restoreBackup,
      },
    },
    dark: patch.dark === undefined ? current.dark : patch.dark,
  };
}

function cloneDefaultStyle(): IResolvedStyle {
  return {
    ...DEFAULT_STYLE,
    theme: { ...DEFAULT_STYLE.theme },
    copy: {
      ...DEFAULT_STYLE.copy,
      connect: { ...DEFAULT_STYLE.copy.connect },
      walletSetup: { ...DEFAULT_STYLE.copy.walletSetup },
      passkeyName: { ...DEFAULT_STYLE.copy.passkeyName },
      personalSign: { ...DEFAULT_STYLE.copy.personalSign },
      typedData: { ...DEFAULT_STYLE.copy.typedData },
      sendTransaction: { ...DEFAULT_STYLE.copy.sendTransaction },
      credentialOffer: { ...DEFAULT_STYLE.copy.credentialOffer },
      credentialPresentation: { ...DEFAULT_STYLE.copy.credentialPresentation },
      credentials: { ...DEFAULT_STYLE.copy.credentials },
      balances: { ...DEFAULT_STYLE.copy.balances },
      createBackup: { ...DEFAULT_STYLE.copy.createBackup },
      restoreBackup: { ...DEFAULT_STYLE.copy.restoreBackup },
    },
  };
}

export function createInitialStyle(patch?: IStyleOptions): IResolvedStyle {
  return patch ? mergeStyle(cloneDefaultStyle(), patch) : cloneDefaultStyle();
}

/** Map resolved theme onto CSS variables consumed by shadcn / Tailwind. */
export function applyStyleToDocument(style: IResolvedStyle): void {
  const root = document.documentElement;
  const { theme } = style;

  root.style.setProperty("--primary", theme.primary);
  root.style.setProperty("--primary-foreground", theme.primaryForeground);
  root.style.setProperty("--background", theme.background);
  root.style.setProperty("--foreground", theme.foreground);
  root.style.setProperty("--muted", theme.muted);
  root.style.setProperty("--muted-foreground", theme.mutedForeground);
  root.style.setProperty("--border", theme.border);
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-foreground", theme.accentForeground);
  root.style.setProperty("--radius", theme.radius);
  root.style.setProperty("--font-sans", theme.fontSans);

  root.classList.toggle("dark", style.dark);
}
