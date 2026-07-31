import { OwsUserRejectedError, type OWSAnalyticsEvent } from "@1shotapi/ows-types";

export function isAnalyticsCancelled(error: unknown): boolean {
  return error instanceof OwsUserRejectedError;
}

export function analyticsErrorCode(error: unknown): string {
  if (error instanceof Error) {
    const name = error.name?.trim();
    if (name && name !== "Error") {
      return name.slice(0, 64);
    }
    const message = error.message?.trim();
    if (message) {
      return message.slice(0, 64);
    }
  }
  return "Unknown";
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
