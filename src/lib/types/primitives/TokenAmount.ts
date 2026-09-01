import { type Brand, make } from "ts-brand";

/**
 * Token amount in smallest units. Decimals are defined by the token/asset,
 * not this type.
 */
export type TokenAmount = Brand<bigint, "TokenAmount">;
export const TokenAmount = make<TokenAmount>();

/** Brand already-validated non-negative token atoms. */
export function makeTokenAmount(atoms: bigint): TokenAmount {
  if (atoms < 0n) {
    throw new Error("TokenAmount must be non-negative");
  }
  return TokenAmount(atoms);
}

/** Parse an integer atom string (never a human decimal). */
export function tokenAmountFromAtomString(atoms: string): TokenAmount {
  const trimmed = atoms.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error("TokenAmount atom string must be a non-negative integer");
  }
  return makeTokenAmount(BigInt(trimmed));
}
