import { type Brand, make } from "ts-brand";
import { formatUnits, parseUnits } from "viem";
import type { TokenAmount } from "./TokenAmount";

/** Atomic USDC at 6 decimals (`1_000_000` = $1). */
export type USDCAmount = Brand<number, "USDCAmount">;
export const USDCAmount = make<USDCAmount>();

export const USDC_DECIMALS = 6;

/** Brand already-validated atomic USDC (integer atoms as number). */
export function makeUSDCAmount(atoms: number): USDCAmount {
  if (!Number.isFinite(atoms) || !Number.isInteger(atoms) || atoms < 0) {
    throw new Error("USDCAmount must be a non-negative integer atom count");
  }
  if (atoms > Number.MAX_SAFE_INTEGER) {
    throw new Error("USDCAmount exceeds Number.MAX_SAFE_INTEGER");
  }
  return USDCAmount(atoms);
}

/** Parse a human USDC string/number (e.g. `"1.50"`) into atomic units. */
export function usdcAmountFromHuman(human: string | number): USDCAmount {
  const atoms = parseUnits(String(human).trim(), USDC_DECIMALS);
  return usdcAmountFromAtoms(atoms);
}

export function usdcAmountToHuman(amount: USDCAmount): string {
  return formatUnits(usdcAmountToAtoms(amount), USDC_DECIMALS);
}

export function usdcAmountFromAtoms(atoms: bigint): USDCAmount {
  if (atoms < 0n) {
    throw new Error("USDCAmount atoms must be non-negative");
  }
  if (atoms > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("USDCAmount exceeds Number.MAX_SAFE_INTEGER");
  }
  return USDCAmount(Number(atoms));
}

/** Convert generic token atoms to USDC when the token is known to be USDC. */
export function usdcAmountFromTokenAmount(
  atoms: TokenAmount,
  decimals: number,
): USDCAmount {
  if (decimals !== USDC_DECIMALS) {
    throw new Error(
      `Cannot convert TokenAmount to USDCAmount: expected ${USDC_DECIMALS} decimals, got ${decimals}`,
    );
  }
  return usdcAmountFromAtoms(atoms);
}

export function usdcAmountToAtoms(amount: USDCAmount): bigint {
  return BigInt(amount);
}
