/**
 * True when calldata has no 4-byte function selector.
 * `0x`, missing data, and anything shorter than 4 bytes qualify.
 * AllowedMethodsEnforcer reverts on those (`invalid-execution-data-length`).
 */
export function isEmptyCalldata(callData: string | null | undefined): boolean {
  if (callData == null) return true;
  const hex = callData.trim();
  if (!hex.startsWith("0x") && !hex.startsWith("0X")) return true;
  return hex.length < 10;
}
