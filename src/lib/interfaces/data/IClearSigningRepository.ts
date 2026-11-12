import type {
  IClearSigningCalldataLookupKey,
  IClearSigningEip712LookupKey,
  IClearSigningLookupFound,
} from "@1shotapi/ows-types";

/**
 * ERC-7730 descriptor lookups against the 1Shot relayer (`GET /clear-signing/*`).
 *
 * Lookups never throw: a miss, a network error, a timeout, or a malformed response all resolve
 * to `null`, and callers fall back to the generic consent display. The returned descriptor is
 * untrusted — render it only through `ClearSigningFormatter`, which re-verifies the binding.
 */
export interface IClearSigningRepository {
  lookupCalldata(
    key: IClearSigningCalldataLookupKey,
  ): Promise<IClearSigningLookupFound | null>;
  lookupEip712(
    key: IClearSigningEip712LookupKey,
  ): Promise<IClearSigningLookupFound | null>;
}

export const IClearSigningRepositoryType = Symbol.for(
  "IClearSigningRepository",
);
