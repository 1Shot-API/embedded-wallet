export interface IPlatformProps {
  /** `navigator.platform` (e.g. `Win32`, `MacIntel`, `iPhone`). */
  platform: string;
  /** Coarse OS family parsed from the UA: Windows | macOS | iOS | Android | ChromeOS | Linux | Unknown. */
  os: string;
  /** Coarse browser family parsed from the UA. */
  browser: string;
  isMobile: boolean;
  userAgent: string;
}

type NavigatorLike = {
  userAgent?: string;
  platform?: string;
};

function detectOs(ua: string): string {
  if (/Windows/i.test(ua)) return "Windows";
  if (/Android/i.test(ua)) return "Android";
  if (/iP(hone|ad|od)/i.test(ua)) return "iOS";
  if (/CrOS/i.test(ua)) return "ChromeOS";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
}

function detectBrowser(ua: string): string {
  if (/Edg/i.test(ua)) return "Edge";
  if (/OPR|Opera/i.test(ua)) return "Opera";
  if (/SamsungBrowser/i.test(ua)) return "Samsung Internet";
  if (/CriOS/i.test(ua)) return "Chrome";
  if (/FxiOS|Firefox/i.test(ua)) return "Firefox";
  if (/Chrome|Chromium/i.test(ua)) return "Chrome";
  if (/Safari/i.test(ua)) return "Safari";
  return "Unknown";
}

/**
 * Platform context attached to first-party analytics (`props_json` on the
 * relayer). Derived locally at emit time — never an IP or fingerprint id.
 */
export function collectPlatformProps(
  nav: NavigatorLike | undefined = typeof navigator !== "undefined"
    ? navigator
    : undefined,
): IPlatformProps {
  const userAgent = nav?.userAgent ?? "";
  return {
    platform: nav?.platform || "Unknown",
    os: detectOs(userAgent),
    browser: detectBrowser(userAgent),
    isMobile: /Mobi|Android|iP(hone|ad|od)/i.test(userAgent),
    userAgent: userAgent.slice(0, 512),
  };
}
