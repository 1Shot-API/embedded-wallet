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

/** `data.postmate` value of the handshake the Host Layer `OWSProxy` posts. */
const POSTMATE_HANDSHAKE = "handshake";

/**
 * Records the embedding host's origin from browser-attested sources only.
 *
 * `event.source` and `event.origin` are set by the browser, so a message from
 * `window.parent` identifies the Host Layer exactly as Postmate's own origin
 * check does before any RPC is handled.
 */
export class HostOriginProvider implements IHostOriginProvider {
  private origin: OriginString | null = null;
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

  private isEmbedded(): boolean {
    return this.win !== null && this.win.parent !== this.win.self;
  }

  /** Chromium and WebKit expose the embedder synchronously; Firefox does not. */
  private readAncestorOrigin(): OriginString | null {
    const ancestors = this.win?.location.ancestorOrigins;
    const direct = ancestors && ancestors.length > 0 ? ancestors[0] : undefined;
    return direct && direct !== "null" ? OriginString(direct) : null;
  }

  private onMessage(event: MessageEvent): void {
    if (!this.win || event.source !== this.win.parent) {
      return;
    }
    if (!isPostmateHandshake(event.data)) {
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
