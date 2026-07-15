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
      connect: {
        ...current.copy.connect,
        ...patch.copy?.connect,
      },
      walletSetup: {
        ...current.copy.walletSetup,
        ...patch.copy?.walletSetup,
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
