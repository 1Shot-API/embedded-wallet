import type { DomainString } from "@1shotapi/ows-types";

import type { OriginString } from "../../types/primitives/OriginString";

/**
 * Identity of the Host Layer page that embeds this Branding Layer.
 *
 * The origin is taken from values the browser sets and the embedding page
 * cannot forge or suppress: `MessageEvent.origin` of the Postmate handshake
 * posted by `window.parent`, seeded from `location.ancestorOrigins` where the
 * browser exposes it. `document.referrer` is never used — an embedder can
 * blank it with `Referrer-Policy: no-referrer` and hide who is asking.
 */
export interface IHostOriginProvider {
  /** Start observing the handshake. Idempotent; call before `OWSWallet.start()`. */
  start(): void;

  /** Host origin such as `https://app.example.com`; `null` until a host connects or when top-level. */
  getHostOrigin(): OriginString | null;

  /** Hostname of {@link getHostOrigin}; `null` when the origin is unknown. */
  getHostDomain(): DomainString | null;
}

export const IHostOriginProviderType = Symbol.for("IHostOriginProvider");
