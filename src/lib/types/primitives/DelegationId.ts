import { type Brand, make } from "ts-brand";

/**
 * Stable id for a stored execution permission / MetaMask delegation.
 * Prefer a deterministic id derived from the delegation hash when available.
 */
export type DelegationId = Brand<string, "DelegationId">;
export const DelegationId = make<DelegationId>();

export function makeDelegationId(value: string): DelegationId {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("DelegationId must be a non-empty string");
  }
  return DelegationId(trimmed);
}
