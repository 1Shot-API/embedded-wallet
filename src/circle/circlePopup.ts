/** Dev override key: `localStorage.setItem("circlePopup", "true"|"false")`. */
export const CIRCLE_POPUP_STORAGE_KEY = "circlePopup";

/**
 * When true, onramp uses AppKit `openWindow` instead of `mountIframe`.
 *
 * Preference order:
 * 1. Explicit `localStorage.circlePopup` (`"true"` / `"false"`) for local/ngrok
 *    CSP allowlist testing.
 * 2. Otherwise, prefer popup whenever the Branding Layer is nested in a host
 *    iframe (`window.self !== window.top`). Transak’s `frame-ancestors` is
 *    sealed to a single `referrerDomain` at mint time and cannot authorize
 *    arbitrary Host Layer origins, so inline iframe only works when Branding
 *    is top-level (or the host is allowlisted via server `referrerDomain`).
 */
export function isCirclePopupPreferred(): boolean {
  try {
    if (typeof localStorage !== "undefined") {
      const override = localStorage.getItem(CIRCLE_POPUP_STORAGE_KEY);
      if (override === "true") {
        return true;
      }
      if (override === "false") {
        return false;
      }
    }
  } catch {
    // Privacy mode / blocked storage — fall through to embedding check.
  }

  try {
    return typeof window !== "undefined" && window.self !== window.top;
  } catch {
    // If the embedding check fails, prefer popup (safer than a blank iframe).
    return true;
  }
}
