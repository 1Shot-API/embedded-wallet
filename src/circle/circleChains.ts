/** Map EVM decimal chain id → Circle onramp chain label (`Blockchain` enum). */
const CIRCLE_CHAIN_BY_DECIMAL: ReadonlyMap<number, string> = new Map([
  [1, "Ethereum"],
  [10, "Optimism"],
  [137, "Polygon"],
  [8453, "Base"],
  [42161, "Arbitrum"],
  [43114, "Avalanche"],
  [59144, "Linea"],
  [130, "Unichain"],
]);

/**
 * Convert a hex (`0x…`) or decimal chain id to Circle's display chain label.
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
