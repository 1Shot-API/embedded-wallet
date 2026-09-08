import { type Brand, make } from "ts-brand";

/** Amount in satoshis (1 BTC = 100_000_000 sats). */
export type BitcoinSatoshiAmount = Brand<bigint, "BitcoinSatoshiAmount">;
export const BitcoinSatoshiAmount = make<BitcoinSatoshiAmount>();

/** Brand already-validated non-negative satoshis. */
export function makeBitcoinSatoshiAmount(sats: bigint): BitcoinSatoshiAmount {
  if (sats < 0n) {
    throw new Error("BitcoinSatoshiAmount must be non-negative");
  }
  return BitcoinSatoshiAmount(sats);
}

/**
 * Brand a satoshi delta that may be negative (e.g. Blockbook
 * `unconfirmedBalance` when pending spends exceed pending receives).
 */
export function makeBitcoinSatoshiDelta(sats: bigint): BitcoinSatoshiAmount {
  return BitcoinSatoshiAmount(sats);
}

/** Parse an integer satoshi string (never a human BTC decimal). */
export function bitcoinSatoshiAmountFromAtomString(
  sats: string,
): BitcoinSatoshiAmount {
  const trimmed = sats.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      "BitcoinSatoshiAmount atom string must be a non-negative integer",
    );
  }
  return makeBitcoinSatoshiAmount(BigInt(trimmed));
}

/** Parse a signed integer satoshi string (Blockbook unconfirmed deltas). */
export function bitcoinSatoshiDeltaFromAtomString(
  sats: string,
): BitcoinSatoshiAmount {
  const trimmed = sats.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new Error(
      "BitcoinSatoshiAmount delta string must be a signed integer",
    );
  }
  return makeBitcoinSatoshiDelta(BigInt(trimmed));
}
