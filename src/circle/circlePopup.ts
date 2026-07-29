/** Dev override key: `localStorage.setItem("circlePopup", "true")`. */
export const CIRCLE_POPUP_STORAGE_KEY = "circlePopup";

/**
 * When true, onramp uses AppKit `openWindow` instead of `mountIframe`.
 * Needed for local/ngrok hosts that are not yet on Circle’s iframe CSP allowlist.
 */
export function isCirclePopupPreferred(): boolean {
  try {
    return (
      typeof localStorage !== "undefined" &&
      localStorage.getItem(CIRCLE_POPUP_STORAGE_KEY) === "true"
    );
  } catch {
    return false;
  }
}
