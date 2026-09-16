/** Map EVM decimal chain id → Circle onramp network id (`assets.chains`). */
const CIRCLE_CHAIN_BY_DECIMAL: ReadonlyMap<number, string> = new Map([
  [1, "ethereum"],
  [10, "optimism"],
  [137, "polygon"],
  [8453, "base"],
  [42161, "arbitrum"],
  [43114, "avalanche"],
  [59144, "linea"],
  [130, "unichain"],
  [5042, "arc"],
]);

/**
 * Convert a hex (`0x…`) or decimal chain id to Circle's onramp network id.
 * Returns null when unsupported (widget shows full catalog).
 */
export function circleChainLabelFromChainId(
  chainId: string | number | bigint,
): string | null {
  let decimal: number;
  if (typeof chainId === "number") {
    decimal = chainId;
  } else if (typeof chainId === "bigint") {
    decimal = Number(chainId);
  } else {
    const trimmed = chainId.trim();
    if (/^0x[0-9a-fA-F]+$/i.test(trimmed)) {
      decimal = Number(BigInt(trimmed));
    } else if (/^\d+$/.test(trimmed)) {
      decimal = Number(trimmed);
    } else {
      return null;
    }
  }
  if (!Number.isFinite(decimal)) {
    return null;
  }
  return CIRCLE_CHAIN_BY_DECIMAL.get(decimal) ?? null;
}
