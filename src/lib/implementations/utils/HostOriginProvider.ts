import { DomainString } from "@1shotapi/ows-types";

import type { IHostOriginProvider } from "../../interfaces/utils/IHostOriginProvider";
import { OriginString } from "../../types/primitives/OriginString";

/** Subset of `window` this provider reads; injectable for tests. */
export interface IHostOriginWindow {
  readonly self: unknown;
  readonly parent: unknown;
  readonly location: { readonly ancestorOrigins?: DOMStringList };
  addEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
  ): void;
}

/**
 * Requester shown and stored when an embedded wallet has no browser-attested
 * host origin. Never substitute the wallet's own hostname: that would make an
 * unidentified embedder look like 1Shot.
 */
export const UNKNOWN_HOST_DOMAIN = DomainString("unknown");

/** `data.postmate` value of the handshake the Host Layer `OWSProxy` posts. */
const POSTMATE_HANDSHAKE = "handshake";

/**
 * URL schemes of browser-extension pages. Embedding inside an extension is
 * refused: any installed extension could frame the wallet and the wallet
 * cannot tell which one it is. The 1Shot extension is shelved; re-enabling it
 * needs a different protection (e.g. pinned published extension ids, and a
 * Firefox story where ids are not stable) — see `extension/README.md`.
 */
const EXTENSION_PROTOCOLS = new Set([
  "chrome-extension:",
  "moz-extension:",
  "safari-web-extension:",
]);

/**
 * Records the embedding host's origin from browser-attested sources only, and
 * gates which window may complete the Postmate handshake.
 *
 * Postmate's child side accepts the first handshake from *any* window and
 * never checks `event.source`. This listener is registered before
 * `OWSWallet.start()` and calls `stopImmediatePropagation()` on a handshake
 * Postmate must not see:
 * - every handshake when the wallet is top-level (a page that `window.open`s
 *   the wallet would otherwise get an RPC channel into the user's session);
 * - a handshake from any window other than `window.parent` (a sibling frame or
 *   an opener racing the real host);
 * - a handshake from a browser-extension page or an opaque origin.
 */
export class HostOriginProvider implements IHostOriginProvider {
  private origin: OriginString | null = null;
  private started = false;

  /** `win` is `null` outside a browser (SSR / tests): the origin stays unknown. */
  constructor(private readonly win: IHostOriginWindow | null) {}

  start(): void {
    if (this.started || !this.win) {
      return;
    }
    this.started = true;
    if (this.isEmbedded()) {
      this.origin = this.readAncestorOrigin();
    }
    this.win.addEventListener("message", (event) => this.onMessage(event));
  }

  isEmbedded(): boolean {
    return this.win !== null && this.win.parent !== this.win.self;
  }

  getHostOrigin(): OriginString | null {
    return this.origin;
  }

  getHostDomain(): DomainString | null {
    if (!this.origin) {
      return null;
    }
    try {
      return DomainString(new URL(this.origin).hostname);
    } catch {
      return null;
    }
  }

  /** Chromium and WebKit expose the embedder synchronously; Firefox does not. */
  private readAncestorOrigin(): OriginString | null {
    const ancestors = this.win?.location.ancestorOrigins;
    const direct = ancestors && ancestors.length > 0 ? ancestors[0] : undefined;
    return direct && isAcceptableHostOrigin(direct)
      ? OriginString(direct)
      : null;
  }

  private onMessage(event: MessageEvent): void {
    if (!this.win || !isPostmateHandshake(event.data)) {
      return;
    }
    // Postmate's listener runs after this one, so stopping the event here
    // means it never completes the handshake.
    if (
      !this.isEmbedded() ||
      event.source !== this.win.parent ||
      !isAcceptableHostOrigin(event.origin)
    ) {
      event.stopImmediatePropagation();
      if (this.isEmbedded() && event.source === this.win.parent) {
        // The real embedder is refused (extension / opaque): forget any
        // ancestorOrigins seed so nothing is attributed to it.
        this.origin = null;
      }
      return;
    }
    this.origin = OriginString(event.origin);
  }
}

/**
 * Only web pages may host the wallet. Opaque origins (sandboxed frames)
 * serialize as "null"; extension pages are refused (see EXTENSION_PROTOCOLS).
 */
function isAcceptableHostOrigin(origin: string): boolean {
  if (!origin || origin === "null") {
    return false;
  }
  try {
    return !EXTENSION_PROTOCOLS.has(new URL(origin).protocol);
  } catch {
    return false;
  }
}

function isPostmateHandshake(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { postmate?: unknown }).postmate === POSTMATE_HANDSHAKE
  );
}
