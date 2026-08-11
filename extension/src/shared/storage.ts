import { DEFAULT_WALLET_URL } from "./constants";

export type ExtensionSettings = {
  walletUrl: string;
  /** Origins that auto-inject the provider shim (exact origin). */
  allowlist: string[];
  /** When true, set/overwrite window.ethereum even if another provider exists. */
  preferOneshot: boolean;
};

const SETTINGS_KEY = "settings";

const FALLBACK: ExtensionSettings = {
  walletUrl: DEFAULT_WALLET_URL,
  allowlist: [],
  preferOneshot: false,
};

function normalize(value: Partial<ExtensionSettings> | undefined): ExtensionSettings {
  return {
    walletUrl: value?.walletUrl?.trim() || FALLBACK.walletUrl,
    allowlist: Array.isArray(value?.allowlist) ? value.allowlist : [],
    preferOneshot: Boolean(value?.preferOneshot),
  };
}

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await browser.storage.local.get(SETTINGS_KEY);
  return normalize(result[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined);
}

export async function setSettings(
  patch: Partial<ExtensionSettings>,
): Promise<ExtensionSettings> {
  const current = await getSettings();
  const next: ExtensionSettings = {
    walletUrl: patch.walletUrl?.trim() || current.walletUrl,
    allowlist: patch.allowlist ?? current.allowlist,
    preferOneshot:
      patch.preferOneshot !== undefined
        ? patch.preferOneshot
        : current.preferOneshot,
  };
  await browser.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export async function addAllowlistOrigin(
  origin: string,
): Promise<ExtensionSettings> {
  const current = await getSettings();
  if (current.allowlist.includes(origin)) {
    return current;
  }
  return setSettings({ allowlist: [...current.allowlist, origin] });
}

export function isOriginAllowlisted(
  origin: string,
  allowlist: string[],
): boolean {
  return allowlist.includes(origin);
}
