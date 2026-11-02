import { type Brand, make } from "ts-brand";

/** Amount in lamports (1 SOL = 1_000_000_000 lamports). */
export type SolanaLamports = Brand<bigint, "SolanaLamports">;
export const SolanaLamports = make<SolanaLamports>();

/** Brand already-validated non-negative lamports. */
export function makeSolanaLamports(lamports: bigint): SolanaLamports {
  if (lamports < 0n) {
    throw new Error("SolanaLamports must be non-negative");
  }
  return SolanaLamports(lamports);
}

/** Parse an integer lamport string (never a human SOL decimal). */
export function solanaLamportsFromAtomString(lamports: string): SolanaLamports {
  const trimmed = lamports.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      "SolanaLamports atom string must be a non-negative integer",
    );
  }
  return makeSolanaLamports(BigInt(trimmed));
}
