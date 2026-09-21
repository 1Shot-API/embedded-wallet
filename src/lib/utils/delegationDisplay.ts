import type { IExecutionPermissionRule } from "@1shotapi/ows-types";
import { parseUnits } from "viem";

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_WEEK = 604_800;

/** Human-readable reset cadence for periodic permissions. */
export function humanizePeriodDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 1 || !Number.isInteger(seconds)) {
    return "—";
  }
  if (seconds === SECONDS_PER_DAY) return "Daily";
  if (seconds === SECONDS_PER_WEEK) return "Weekly";
  if (seconds % SECONDS_PER_DAY === 0) {
    const days = seconds / SECONDS_PER_DAY;
    return days === 1 ? "Every day" : `Every ${days} days`;
  }
  if (seconds % SECONDS_PER_HOUR === 0) {
    const hours = seconds / SECONDS_PER_HOUR;
    return hours === 1 ? "Every hour" : `Every ${hours} hours`;
  }
  return `Every ${seconds} seconds`;
}

/** Summary amount for grant UI; null when input is empty or invalid. */
export function formatPermissionAmount(
  amountText: string,
  symbol: string,
  decimals: number,
): string | null {
  const trimmed = amountText.trim();
  if (!trimmed) return null;
  try {
    const parsed = parseUnits(trimmed, decimals);
    if (parsed <= 0n) return null;
    return `${trimmed} ${symbol}`;
  } catch {
    return null;
  }
}

export function parsePeriodDurationSeconds(durationText: string): number | null {
  const trimmed = durationText.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
    return null;
  }
  return n;
}

function parseUnixSeconds(unix: string | number | undefined): number | null {
  if (unix === undefined || unix === null) return null;
  const trimmed = String(unix).trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

/** Locale date/time for optional permission start (Unix seconds). */
export function formatUnixSecondsLabel(
  unix: string | number | undefined,
  locale?: string,
): string | null {
  const seconds = parseUnixSeconds(unix);
  if (seconds === null) return null;
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(locale, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** Value for `<input type="datetime-local">` from Unix seconds (local timezone). */
export function unixSecondsToDatetimeLocalInput(
  unix: string | number | undefined,
): string {
  const seconds = parseUnixSeconds(unix);
  if (seconds === null) return "";
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return "";
  date.setSeconds(0, 0);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parse `datetime-local` input to Unix seconds, or null if empty/invalid. */
export function datetimeLocalInputToUnixSeconds(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

const PERMISSION_END_DATA_KEYS = [
  "endDate",
  "endTime",
  "expiry",
  "expiresAt",
  "expiration",
] as const;

const EXPIRY_RULE_DATA_KEYS = [
  "expiry",
  "expiresAt",
  "expiration",
  "timestamp",
  "end",
] as const;

const LIFETIME_DATA_KEYS = [
  "lifetimeSeconds",
  "lifetime",
  "permissionDuration",
  "totalDuration",
] as const;

function readUnixSecondsField(
  record: Record<string, unknown>,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const n = parseUnixSeconds(record[key] as string | number | undefined);
    if (n !== null) return n;
  }
  return null;
}

/**
 * Unix seconds when the permission ends, if the host specified a finite lifetime
 * (EIP-7715 `expiry` rule and/or explicit end / start + lifetime on permission data).
 */
export function resolvePermissionEndUnixSeconds(args: {
  rules?: readonly IExecutionPermissionRule[];
  permissionData?: Record<string, unknown>;
}): number | null {
  const { rules, permissionData } = args;

  if (permissionData) {
    const direct = readUnixSecondsField(
      permissionData,
      PERMISSION_END_DATA_KEYS,
    );
    if (direct !== null) return direct;

    const start = readUnixSecondsField(permissionData, ["startDate", "start"]);
    const lifetimeRaw = LIFETIME_DATA_KEYS.map((k) => permissionData[k]).find(
      (v) => typeof v === "number" || typeof v === "string",
    );
    if (start !== null && lifetimeRaw !== undefined) {
      const lifetime = Number(lifetimeRaw);
      if (
        Number.isFinite(lifetime) &&
        lifetime > 0 &&
        Number.isInteger(lifetime)
      ) {
        return start + lifetime;
      }
    }
  }

  if (rules) {
    for (const rule of rules) {
      if (rule.type !== "expiry") continue;
      const fromRule = readUnixSecondsField(rule.data, EXPIRY_RULE_DATA_KEYS);
      if (fromRule !== null) return fromRule;
    }
  }

  return null;
}
