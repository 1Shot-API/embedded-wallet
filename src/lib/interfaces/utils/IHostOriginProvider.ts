import type { DomainString } from "@1shotapi/ows-types";

import type { OriginString } from "../../types/primitives/OriginString";

/**
 * Identity of the page a request comes from.
 *
 * The host origin is taken from values the browser sets and the embedding
 * page cannot forge or suppress: `MessageEvent.origin` of the Postmate
 * handshake posted by `window.parent`, seeded from `location.ancestorOrigins`
 * where the browser exposes it. `document.referrer` is never used — an
 * embedder can blank it with `Referrer-Policy: no-referrer`.
 *
 * A browser-extension host (the 1Shot extension side panel) is itself the
 * party that attests page origins, so it may name the page it is acting for
 * per request via {@link runForOrigin}; that relayed origin then becomes the
 * requester for everything that reads {@link getHostDomain}.
 */
export interface IHostOriginProvider {
  /** Start observing the handshake. Idempotent; call before `OWSWallet.start()`. */
  start(): void;

  /** True when this Branding Layer runs inside another document. */
  isEmbedded(): boolean;

  /** Direct embedder origin such as `https://app.example.com`; `null` until a host connects or when top-level. */
  getHostOrigin(): OriginString | null;

  /** Origin the current request is attributed to: the relayed origin inside {@link runForOrigin}, else {@link getHostOrigin}. */
  getRequesterOrigin(): OriginString | null;

  /** Hostname of {@link getRequesterOrigin}; `null` when the origin is unknown. */
  getHostDomain(): DomainString | null;

  /** True when the embedder is a browser-extension page (`chrome-extension:`, `moz-extension:`, …). */
  isExtensionHost(): boolean;

  /**
   * Run `work` with `origin` as the requester. Calls are serialized so the
   * requester never changes underneath an in-flight request. Only meaningful
   * for an extension host; callers must check {@link isExtensionHost} first.
   */
  runForOrigin<T>(origin: OriginString, work: () => Promise<T>): Promise<T>;
}

export const IHostOriginProviderType = Symbol.for("IHostOriginProvider");
