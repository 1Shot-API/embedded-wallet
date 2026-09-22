import type { IAppendedCaveatConfiguration } from "@1shotapi/ows-types";
import {
  formatUnixSecondsLabel,
  truncateMiddle,
} from "../../../lib/utils/delegationDisplay";
import { truncateAddress } from "../../../lib/utils/identityDisplay";

/**
 * User-facing display name for each appended caveat `type`.
 *
 * Curated to match the 9-type allowlist in `DelegationService.validateAppendedCaveats`.
 * Unknown types are rejected before signing, so the UI only sees these keys.
 */
export const CAVEAT_DISPLAY_NAME: Record<string, string> = {
  allowedCalldata: "Pinned Calldata",
  allowedTargets: "Allowed Targets",
  allowedMethods: "Allowed Methods",
  valueLte: "Max Native Value",
  timestamp: "Time Window",
  redeemer: "Allowed Redeemer",
  limitedCalls: "Redemption Limit",
  nonce: "Revocation Nonce",
  id: "One-Time ID",
};

/** A resolved, user-facing row for an appended caveat parameter. */
export interface IAppendedCaveatRow {
  label: string;
  value: string;
}

function readString(data: Record<string, unknown>, key: string): string | null {
  const v = data[key];
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

function readNumber(data: Record<string, unknown>, key: string): number | null {
  const v = data[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) return Number(v.trim());
  return null;
}

function readBigInt(data: Record<string, unknown>, key: string): bigint | null {
  const v = data[key];
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isFinite(v)) return BigInt(v);
  if (typeof v === "string" && /^\d+$/.test(v.trim())) return BigInt(v.trim());
  return null;
}

function readStringArray(
  data: Record<string, unknown>,
  key: string,
): string[] {
  const v = data[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x !== "");
}

function joinAddresses(addresses: string[]): string {
  return addresses.map((a) => truncateAddress(a)).join(", ") || "—";
}

function joinStrings(values: string[]): string {
  return values.join(", ") || "—";
}

/**
 * True if an appended caveat is well-formed enough to display and sign.
 *
 * Mirrors the allowlist in `DelegationService.validateAppendedCaveats` so the
 * consent UI can disable Grant before the service ever sees the request.
 */
export function isAppendedCaveatValid(
  caveat: IAppendedCaveatConfiguration,
): boolean {
  if (typeof caveat !== "object" || caveat === null) return false;
  if (typeof caveat.type !== "string" || !(caveat.type in CAVEAT_DISPLAY_NAME)) {
    return false;
  }
  if (
    typeof caveat.data !== "object" ||
    caveat.data === null ||
    Array.isArray(caveat.data)
  ) {
    return false;
  }
  return true;
}

/**
 * Resolve the user-facing rows for one appended caveat's config parameters.
 *
 * Pure (no React, no asset imports) so it can be unit-tested in a plain Node
 * environment. The `AppendedCaveatTerms` component renders these rows inside a
 * `PermissionGrantTermsCard`.
 */
export function resolveAppendedCaveatRows(
  caveat: IAppendedCaveatConfiguration,
): IAppendedCaveatRow[] {
  const data = caveat.data as Record<string, unknown>;
  switch (caveat.type) {
    case "allowedCalldata": {
      const startIndex = readNumber(data, "startIndex");
      const value = readString(data, "value");
      return [
        ...(startIndex !== null
          ? [{ label: "Calldata offset", value: String(startIndex) }]
          : []),
        ...(value ? [{ label: "Pinned value", value: truncateMiddle(value) }] : []),
      ];
    }
    case "allowedTargets": {
      const targets = readStringArray(data, "targets");
      return [{ label: "Allowed targets", value: joinAddresses(targets) }];
    }
    case "allowedMethods": {
      const selectors = readStringArray(data, "selectors");
      return [{ label: "Allowed methods", value: joinStrings(selectors) }];
    }
    case "valueLte": {
      const maxValue = readBigInt(data, "maxValue");
      return [
        {
          label: "Max value",
          value: maxValue !== null ? `${maxValue.toString()} wei` : "—",
        },
      ];
    }
    case "timestamp": {
      const after = readNumber(data, "afterThreshold");
      const before = readNumber(data, "beforeThreshold");
      const afterLabel =
        after !== null && after > 0 ? formatUnixSecondsLabel(after) : null;
      const beforeLabel =
        before !== null && before > 0 ? formatUnixSecondsLabel(before) : null;
      return [
        ...(afterLabel ? [{ label: "Valid after", value: afterLabel }] : []),
        ...(beforeLabel ? [{ label: "Valid before", value: beforeLabel }] : []),
      ];
    }
    case "redeemer": {
      const redeemers = readStringArray(data, "redeemers");
      return [{ label: "Only redeemer", value: joinAddresses(redeemers) }];
    }
    case "limitedCalls": {
      const limit = readNumber(data, "limit");
      return [
        { label: "Max redemptions", value: limit !== null ? String(limit) : "—" },
      ];
    }
    case "nonce": {
      const nonce = readString(data, "nonce");
      return [
        { label: "Revocation nonce", value: nonce ? truncateMiddle(nonce) : "—" },
      ];
    }
    case "id": {
      const id = readBigInt(data, "id");
      return [{ label: "One-time ID", value: id !== null ? id.toString() : "—" }];
    }
    default:
      return [];
  }
}
