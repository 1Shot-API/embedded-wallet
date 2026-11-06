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

/** URL schemes of browser-extension pages. Such a host attests page origins itself. */
const EXTENSION_PROTOCOLS = new Set([
  "chrome-extension:",
  "moz-extension:",
  "safari-web-extension:",
]);

/**
 * Records the embedding host's origin from browser-attested sources only.
 *
 * `event.source` and `event.origin` are set by the browser, so a message from
 * `window.parent` identifies the Host Layer exactly as Postmate's own origin
 * check does before any RPC is handled.
 *
 * Postmate's child side accepts the first handshake from *any* window and
 * never checks `event.source`, so a window that merely holds a reference to
 * this frame (another frame on the page, or the page that opened the dapp)
 * could race the parent and become the RPC peer. This listener is registered
 * before `OWSWallet.start()` and stops a non-parent handshake before Postmate
 * sees it.
 */
export class HostOriginProvider implements IHostOriginProvider {
  private origin: OriginString | null = null;
  private relayedOrigin: OriginString | null = null;
  private relayChain: Promise<unknown> = Promise.resolve();
  private started = false;

  /** `win` is `null` outside a browser (SSR / tests): the origin stays unknown. */
  constructor(private readonly win: IHostOriginWindow | null) {}

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    if (!this.win || !this.isEmbedded()) {
      return;
    }
    this.origin = this.readAncestorOrigin();
    this.win.addEventListener("message", (event) => this.onMessage(event));
  }

  isEmbedded(): boolean {
    return this.win !== null && this.win.parent !== this.win.self;
  }

  getHostOrigin(): OriginString | null {
    return this.origin;
  }

  getRequesterOrigin(): OriginString | null {
    return this.relayedOrigin ?? this.origin;
  }

  getHostDomain(): DomainString | null {
    const origin = this.getRequesterOrigin();
    if (!origin) {
      return null;
    }
    try {
      return DomainString(new URL(origin).hostname);
    } catch {
      return null;
    }
  }

  isExtensionHost(): boolean {
    if (!this.origin) {
      return false;
    }
    try {
      return EXTENSION_PROTOCOLS.has(new URL(this.origin).protocol);
    } catch {
      return false;
    }
  }

  runForOrigin<T>(origin: OriginString, work: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      this.relayedOrigin = origin;
      try {
        return await work();
      } finally {
        this.relayedOrigin = null;
      }
    };
    const result = this.relayChain.then(run, run);
    this.relayChain = result.catch(() => undefined);
    return result;
  }

  /** Chromium and WebKit expose the embedder synchronously; Firefox does not. */
  private readAncestorOrigin(): OriginString | null {
    const ancestors = this.win?.location.ancestorOrigins;
    const direct = ancestors && ancestors.length > 0 ? ancestors[0] : undefined;
    return direct && direct !== "null" ? OriginString(direct) : null;
  }

  private onMessage(event: MessageEvent): void {
    if (!this.win || !isPostmateHandshake(event.data)) {
      return;
    }
    if (event.source !== this.win.parent) {
      // Only the embedder may become the RPC peer. Postmate's listener runs
      // after this one, so stopping the event here closes the race.
      event.stopImmediatePropagation();
      return;
    }
    // Opaque origins (sandboxed frames) serialize as "null" and cannot host a wallet.
    if (!event.origin || event.origin === "null") {
      return;
    }
    this.origin = OriginString(event.origin);
  }
}

function isPostmateHandshake(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { postmate?: unknown }).postmate === POSTMATE_HANDSHAKE
  );
}
