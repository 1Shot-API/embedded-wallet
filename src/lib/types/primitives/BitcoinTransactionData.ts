import { type Brand, make } from "ts-brand";

/**
 * Serialized Bitcoin transaction as lowercase hex **without** a `0x` prefix.
 * Matches Bitcoin Core `sendrawtransaction` / `@scure/btc-signer` wire format.
 */
export type BitcoinTransactionData = Brand<string, "BitcoinTransactionData">;
export const BitcoinTransactionData = make<BitcoinTransactionData>();

/** Brand already-validated bare hex transaction bytes. */
export function makeBitcoinTransactionData(hex: string): BitcoinTransactionData {
  const clean = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (clean.length === 0 || clean.length % 2 !== 0) {
    throw new Error("BitcoinTransactionData must be non-empty even-length hex");
  }
  if (!/^[0-9a-fA-F]+$/.test(clean)) {
    throw new Error("BitcoinTransactionData must be hex");
  }
  return BitcoinTransactionData(clean.toLowerCase());
}
