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
      account: {
        ...current.copy.account,
        ...patch.copy?.account,
      },
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
      confirmTransfer: {
        ...current.copy.confirmTransfer,
        ...patch.copy?.confirmTransfer,
      },
      transferTokens: {
        ...current.copy.transferTokens,
        ...patch.copy?.transferTokens,
      },
      grantExecutionPermission: {
        ...current.copy.grantExecutionPermission,
        ...patch.copy?.grantExecutionPermission,
      },
      cancelDelegation: {
        ...current.copy.cancelDelegation,
        ...patch.copy?.cancelDelegation,
      },
      passkeyPrompt: {
        unlock: {
          ...current.copy.passkeyPrompt.unlock,
          ...patch.copy?.passkeyPrompt?.unlock,
        },
        create: {
          ...current.copy.passkeyPrompt.create,
          ...patch.copy?.passkeyPrompt?.create,
        },
        sign: {
          ...current.copy.passkeyPrompt.sign,
          ...patch.copy?.passkeyPrompt?.sign,
        },
        encrypt: {
          ...current.copy.passkeyPrompt.encrypt,
          ...patch.copy?.passkeyPrompt?.encrypt,
        },
        decrypt: {
          ...current.copy.passkeyPrompt.decrypt,
          ...patch.copy?.passkeyPrompt?.decrypt,
        },
        relayerAuth: {
          ...current.copy.passkeyPrompt.relayerAuth,
          ...patch.copy?.passkeyPrompt?.relayerAuth,
        },
        walletUpgrade: {
          ...current.copy.passkeyPrompt.walletUpgrade,
          ...patch.copy?.passkeyPrompt?.walletUpgrade,
        },
        approveTransaction: {
          ...current.copy.passkeyPrompt.approveTransaction,
          ...patch.copy?.passkeyPrompt?.approveTransaction,
        },
        adjustFee: {
          ...current.copy.passkeyPrompt.adjustFee,
          ...patch.copy?.passkeyPrompt?.adjustFee,
        },
        backup: {
          ...current.copy.passkeyPrompt.backup,
          ...patch.copy?.passkeyPrompt?.backup,
        },
        exportPrivateKey: {
          ...current.copy.passkeyPrompt.exportPrivateKey,
          ...patch.copy?.passkeyPrompt?.exportPrivateKey,
        },
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
      exportPrivateKey: {
        ...current.copy.exportPrivateKey,
        ...patch.copy?.exportPrivateKey,
      },
      importPrivateKey: {
        ...current.copy.importPrivateKey,
        ...patch.copy?.importPrivateKey,
      },
      advancedOptions: {
        ...current.copy.advancedOptions,
        ...patch.copy?.advancedOptions,
      },
    },
    dark: patch.dark === undefined ? current.dark : patch.dark,
    allowedChains:
      patch.allowedChains === undefined
        ? current.allowedChains
        : patch.allowedChains.length === 0
          ? null
          : [...patch.allowedChains],
  };
}

function cloneDefaultStyle(): IResolvedStyle {
  return {
    ...DEFAULT_STYLE,
    theme: { ...DEFAULT_STYLE.theme },
    copy: {
      ...DEFAULT_STYLE.copy,
      account: { ...DEFAULT_STYLE.copy.account },
      connect: { ...DEFAULT_STYLE.copy.connect },
      walletSetup: { ...DEFAULT_STYLE.copy.walletSetup },
      passkeyName: { ...DEFAULT_STYLE.copy.passkeyName },
      personalSign: { ...DEFAULT_STYLE.copy.personalSign },
      typedData: { ...DEFAULT_STYLE.copy.typedData },
      sendTransaction: { ...DEFAULT_STYLE.copy.sendTransaction },
      confirmTransfer: { ...DEFAULT_STYLE.copy.confirmTransfer },
      transferTokens: { ...DEFAULT_STYLE.copy.transferTokens },
      grantExecutionPermission: {
        ...DEFAULT_STYLE.copy.grantExecutionPermission,
      },
      cancelDelegation: { ...DEFAULT_STYLE.copy.cancelDelegation },
      passkeyPrompt: {
        unlock: { ...DEFAULT_STYLE.copy.passkeyPrompt.unlock },
        create: { ...DEFAULT_STYLE.copy.passkeyPrompt.create },
        sign: { ...DEFAULT_STYLE.copy.passkeyPrompt.sign },
        encrypt: { ...DEFAULT_STYLE.copy.passkeyPrompt.encrypt },
        decrypt: { ...DEFAULT_STYLE.copy.passkeyPrompt.decrypt },
        relayerAuth: { ...DEFAULT_STYLE.copy.passkeyPrompt.relayerAuth },
        walletUpgrade: { ...DEFAULT_STYLE.copy.passkeyPrompt.walletUpgrade },
        approveTransaction: {
          ...DEFAULT_STYLE.copy.passkeyPrompt.approveTransaction,
        },
        adjustFee: { ...DEFAULT_STYLE.copy.passkeyPrompt.adjustFee },
        backup: { ...DEFAULT_STYLE.copy.passkeyPrompt.backup },
        exportPrivateKey: {
          ...DEFAULT_STYLE.copy.passkeyPrompt.exportPrivateKey,
        },
      },
      credentialOffer: { ...DEFAULT_STYLE.copy.credentialOffer },
      credentialPresentation: { ...DEFAULT_STYLE.copy.credentialPresentation },
      credentials: { ...DEFAULT_STYLE.copy.credentials },
      balances: { ...DEFAULT_STYLE.copy.balances },
      exportPrivateKey: { ...DEFAULT_STYLE.copy.exportPrivateKey },
      importPrivateKey: { ...DEFAULT_STYLE.copy.importPrivateKey },
      advancedOptions: { ...DEFAULT_STYLE.copy.advancedOptions },
    },
    allowedChains: null,
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
