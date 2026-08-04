import type {
  EVMAccountAddress,
  EVMChainId,
} from "@1shotapi/ows-types";

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

/** Known (chainId, address) catalog first, then symbol fallback. */
export function resolveAssetIconUrl(
  chainId: EVMChainId,
  address: EVMAccountAddress,
  symbol?: string,
): string | undefined {
  const fromCatalog = resolveKnownAssetIconUrl?.(chainId, address);
  if (fromCatalog) {
    return fromCatalog;
  }
  if (symbol) {
    return iconUrlForSymbol(symbol);
  }
  return undefined;
}
