import type {
  EVMAccountAddress,
  EVMChainId,
} from "@1shotapi/ows-types";
import type { TrackedAssetId } from "../types/primitives/TrackedAssetId";
import { makeTrackedAssetId } from "../types/primitives/TrackedAssetId";

import usdcIcon from "../../assets/images/tokens/CircleUSDC.svg";
import usdgIcon from "../../assets/images/tokens/GlobalDollarUSDG.svg";
import musdIcon from "../../assets/images/tokens/mUSD-icon.svg";
import usdtIcon from "../../assets/images/tokens/tetherUSD.svg";

const ICON_BY_SYMBOL: Readonly<Record<string, string>> = {
  USDC: usdcIcon,
  USDT: usdtIcon,
  USDG: usdgIcon,
  MUSD: musdIcon,
};

/** Host / tracked custom icons (HTTPS only). */
const TRACKED_ICON_BY_ID = new Map<TrackedAssetId, string>();

/** True when `url` is a usable remote icon (`https:` only). */
export function isSafeHttpsIconUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Normalize relayer/market symbol variants (e.g. USDT0, USD₮0) to icon keys. */
function normalizeSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper === "USDT0" || upper === "USD₮0") {
    return "USDT";
  }
  return upper;
}

/** Bundled SVG URL for a relayer stablecoin symbol, if recognized. */
export function iconUrlForSymbol(symbol: string): string | undefined {
  return ICON_BY_SYMBOL[normalizeSymbol(symbol)];
}

export type IResolveAssetIconUrl = (
  chainId: EVMChainId,
  address: EVMAccountAddress,
) => string | undefined;

let resolveKnownAssetIconUrl: IResolveAssetIconUrl | null = null;

/** Wired by relayerKnownAssets after the known-asset map is built. */
export function registerKnownAssetIconResolver(
  resolver: IResolveAssetIconUrl,
): void {
  resolveKnownAssetIconUrl = resolver;
}

export function registerTrackedAssetIconUrl(
  id: TrackedAssetId,
  iconUrl: string,
): void {
  if (!isSafeHttpsIconUrl(iconUrl)) {
    TRACKED_ICON_BY_ID.delete(id);
    return;
  }
  TRACKED_ICON_BY_ID.set(id, iconUrl.trim());
}

export function unregisterTrackedAssetIconUrl(id: TrackedAssetId): void {
  TRACKED_ICON_BY_ID.delete(id);
}

/** Replace the tracked custom-icon map (call after list/load). */
export function syncTrackedAssetIconUrls(
  entries: ReadonlyArray<{ id: TrackedAssetId; iconUrl?: string }>,
): void {
  TRACKED_ICON_BY_ID.clear();
  for (const entry of entries) {
    if (entry.iconUrl && isSafeHttpsIconUrl(entry.iconUrl)) {
      TRACKED_ICON_BY_ID.set(entry.id, entry.iconUrl.trim());
    }
  }
}

/**
 * Resolve display icon URL.
 * Priority: explicit override → tracked custom (host) → known catalog → symbol bundle.
 */
export function resolveAssetIconUrl(
  chainId: EVMChainId,
  address: EVMAccountAddress,
  symbol?: string,
  iconUrlOverride?: string,
): string | undefined {
  if (iconUrlOverride && isSafeHttpsIconUrl(iconUrlOverride)) {
    return iconUrlOverride.trim();
  }
  const fromTracked = TRACKED_ICON_BY_ID.get(
    makeTrackedAssetId(chainId, address),
  );
  if (fromTracked) {
    return fromTracked;
  }
  const fromCatalog = resolveKnownAssetIconUrl?.(chainId, address);
  if (fromCatalog) {
    return fromCatalog;
  }
  if (symbol) {
    return iconUrlForSymbol(symbol);
  }
  return undefined;
}
