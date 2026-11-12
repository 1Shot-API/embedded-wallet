import type { DomainString } from "@1shotapi/ows-types";

import type { OriginString } from "../../types/primitives/OriginString";

/**
 * Identity of the Host Layer page that embeds this Branding Layer, and the
 * gate that decides whether any page may become the Postmate RPC peer.
 *
 * The host origin is taken from values the browser sets and the embedding
 * page cannot forge or suppress: `MessageEvent.origin` of the Postmate
 * handshake posted by `window.parent`, seeded from `location.ancestorOrigins`
 * where the browser exposes it. `document.referrer` is never used — an
 * embedder can blank it with `Referrer-Policy: no-referrer`.
 *
 * The gate refuses every handshake when the wallet runs top-level (a page
 * that `window.open`s the wallet must not drive it) and when the embedder is
 * a browser-extension page. Extension embedding is disabled while the 1Shot
 * extension is shelved: any installed extension could frame the wallet, and
 * the wallet cannot tell which extension it is. Re-enabling it needs a new
 * trust model (for example pinned published extension ids) — see
 * `extension/README.md`.
 */
export interface IHostOriginProvider {
  /** Install the handshake gate. Idempotent; call before `OWSWallet.start()`. */
  start(): void;

  /** True when this Branding Layer runs inside another document. */
  isEmbedded(): boolean;

  /** Embedder origin such as `https://app.example.com`; `null` until a host connects, when top-level, or when the embedder was refused. */
  getHostOrigin(): OriginString | null;

  /** Hostname of {@link getHostOrigin}; `null` when the origin is unknown. */
  getHostDomain(): DomainString | null;
}

export const IHostOriginProviderType = Symbol.for("IHostOriginProvider");
