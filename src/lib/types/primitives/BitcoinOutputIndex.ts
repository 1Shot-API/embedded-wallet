import { type Brand, make } from "ts-brand";

/**
 * Index of a transaction output within its parent transaction (Bitcoin `vout`).
 */
export type BitcoinOutputIndex = Brand<number, "BitcoinOutputIndex">;
export const BitcoinOutputIndex = make<BitcoinOutputIndex>();

/** Brand an already-validated non-negative integer output index. */
export function makeBitcoinOutputIndex(index: number): BitcoinOutputIndex {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("BitcoinOutputIndex must be a non-negative integer");
  }
  return BitcoinOutputIndex(index);
}
