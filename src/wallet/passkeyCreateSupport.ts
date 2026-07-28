/**
 * When passkey create is blocked in a cross-origin iframe (Safari / WebKit),
 * divert to the first-party `/create` host page.
 */

export function isSafariOrWebKit(): boolean {
  // Dev override: `localStorage.setItem("safariMode", "true")` forces Safari
  // path on non-Safari browsers (e.g. Windows Chrome testing the /create divert).
  try {
    if (
      typeof localStorage !== "undefined" &&
      localStorage.getItem("safariMode") === "true"
    ) {
      return true;
    }
  } catch {
    // Ignore storage access errors (private mode / partitioned iframe).
  }
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iOS Chrome/Firefox still use WebKit.
  if (/iP(hone|ad|od)/.test(ua)) return true;
  // Desktop Safari (exclude Chromium/Chrome/Android)
  if (
    /Safari/i.test(ua) &&
    !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS|Android/i.test(ua)
  ) {
    return true;
  }
  return navigator.vendor === "Apple Computer, Inc.";
}

/** True when this window is nested under a different top-level origin. */
export function isCrossOriginIframe(): boolean {
  if (typeof window === "undefined") return false;
  if (window.top === window) return false;
  try {
    return window.top!.location.origin !== window.location.origin;
  } catch {
    // Cross-origin parent throws on location access.
    return true;
  }
}

/**
 * Safari (and iOS WebKit) block WebAuthn create inside cross-origin iframes.
 * First-party `/create` (same origin as top) does not need this divert.
 */
export function needsFirstPartyPasskeyCreate(): boolean {
  return isSafariOrWebKit() && isCrossOriginIframe();
}

export function createAccountPageUrl(handoff: string): string {
  const url = new URL("/create/", window.location.origin);
  url.searchParams.set("handoff", handoff);
  return url.href;
}
