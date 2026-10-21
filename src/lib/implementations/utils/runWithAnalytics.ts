import { OwsUserRejectedError, type OWSAnalyticsEvent } from "@1shotapi/ows-types";

export function isAnalyticsCancelled(error: unknown): boolean {
  return error instanceof OwsUserRejectedError;
}

/** Max length of the analytics `errorCode` payload (`Name: message`). */
export const ANALYTICS_ERROR_CODE_MAX_LENGTH = 255;

function readErrorField(error: unknown, field: string): string {
  if (error === null || typeof error !== "object") return "";
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Analytics error payload: `Name: message` so dashboards see the actual
 * failure (e.g. `OwsInvalidRequestError: Passkey does not support PRF or PRF
 * output missing`), not just the error class name. Falls back to whichever
 * of name / message / signer `reason` is available. Truncated to
 * {@link ANALYTICS_ERROR_CODE_MAX_LENGTH} — well beyond the old 64-char cap.
 */
export function analyticsErrorCode(error: unknown): string {
  if (typeof error === "string" && error.trim()) {
    return error.trim().slice(0, ANALYTICS_ERROR_CODE_MAX_LENGTH);
  }
  const name = readErrorField(error, "name");
  const message = readErrorField(error, "message");
  const reason = readErrorField(error, "reason");
  const detail = message || reason;
  let combined: string;
  if (name && name !== "Error" && detail && detail !== name) {
    combined = `${name}: ${detail}`;
  } else {
    combined = detail || (name === "Error" ? "" : name);
  }
  return combined
    ? combined.slice(0, ANALYTICS_ERROR_CODE_MAX_LENGTH)
    : "Unknown";
}

/**
 * Run work and emit success / cancelled / failed analytics. Re-throws errors.
 */
export async function runWithAnalytics<T>(
  emit: (event: OWSAnalyticsEvent) => void,
  work: () => Promise<T>,
  events: {
    success: (result: T) => OWSAnalyticsEvent;
    cancelled: () => OWSAnalyticsEvent;
    failed: (errorCode: string) => OWSAnalyticsEvent;
  },
): Promise<T> {
  try {
    const result = await work();
    emit(events.success(result));
    return result;
  } catch (error: unknown) {
    if (isAnalyticsCancelled(error)) {
      emit(events.cancelled());
    } else {
      emit(events.failed(analyticsErrorCode(error)));
    }
    throw error;
  }
}
