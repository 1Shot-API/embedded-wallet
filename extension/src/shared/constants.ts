/** Default Branding Layer URL (production). */
export const DEFAULT_WALLET_URL = "https://wallet.1shotapi.com/";

/**
 * EIP-6963 `info.icon` must be a data: URI (or https).
 * Page CSP blocks `chrome-extension:` / `moz-extension:` icon URLs (Uniswap etc.).
 * Source: `public/icon/icon.svg` (teal target).
 */
export const PROVIDER_ICON_DATA_URI =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">' +
      '<path fill="#2499a9" d="M115.54,0H28.46C12.74,0,0,12.74,0,28.46v87.08c0,15.72,12.74,28.46,28.46,28.46h87.08c15.72,0,28.46-12.74,28.46-28.46V28.46c0-15.72-12.74-28.46-28.46-28.46ZM119.98,73.57c-.81,25.13-21.28,45.6-46.41,46.4-27.75.89-50.43-21.79-49.54-49.54.8-25.13,21.27-45.6,46.4-46.41,27.75-.89,50.44,21.8,49.55,49.55Z"/>' +
      '<path fill="#2499a9" d="M93.6,72c0,11.93-9.67,21.6-21.6,21.6s-21.6-9.67-21.6-21.6,9.67-21.6,21.6-21.6,21.6,9.67,21.6,21.6Z"/>' +
      "</svg>",
  );

/** EIP-6963 provider info. */
export const PROVIDER_INFO = {
  uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  name: "1Shot Wallet",
  rdns: "com.1shotapi.wallet",
} as const;

/** postMessage source tags (page ↔ content). */
export const INPAGE_SOURCE = "oneshot-inpage" as const;
export const CONTENT_SOURCE = "oneshot-content" as const;

/** Channel version for protocol sniffing. */
export const PROTOCOL_VERSION = 1 as const;
