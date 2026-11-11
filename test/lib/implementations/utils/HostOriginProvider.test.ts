import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HostOriginProvider,
  type IHostOriginWindow,
} from "@/lib/implementations/utils/HostOriginProvider.ts";

type Listener = (event: MessageEvent) => void;

function fakeWindow(options: {
  embedded: boolean;
  ancestorOrigins?: readonly string[];
}) {
  const self = { name: "wallet" };
  const parent = options.embedded ? { name: "host" } : self;
  const listeners: Listener[] = [];
  const ancestors = options.ancestorOrigins;
  const win: IHostOriginWindow = {
    self,
    parent,
    location: {
      ancestorOrigins: ancestors
        ? ({
            length: ancestors.length,
            0: ancestors[0],
          } as unknown as DOMStringList)
        : undefined,
    },
    addEventListener: (_type, listener) => {
      listeners.push(listener);
    },
  };
  /** Dispatches like the browser: later listeners are skipped once stopped. */
  const post = (source: unknown, origin: string, data: unknown) => {
    let stopped = false;
    const event = {
      source,
      origin,
      data,
      stopImmediatePropagation: () => {
        stopped = true;
      },
    } as unknown as MessageEvent;
    for (const listener of listeners) {
      if (stopped) break;
      listener(event);
    }
    return { stopped };
  };
  /** Stand-in for Postmate's child listener, registered after ours (`wallet.start()`). */
  const watchPostmate = () => {
    const seen = { handshakes: 0 };
    listeners.push((event) => {
      if (
        (event.data as { postmate?: string } | null)?.postmate === "handshake"
      ) {
        seen.handshakes += 1;
      }
    });
    return seen;
  };
  return { win, parent, listeners, post, watchPostmate };
}

const HANDSHAKE = {
  postmate: "handshake",
  type: "application/x-postmate-v1+json",
};

describe("HostOriginProvider", () => {
  it("refuses every handshake when the wallet runs top-level", () => {
    const { win, parent, post, watchPostmate } = fakeWindow({
      embedded: false,
    });
    const provider = new HostOriginProvider(win);
    provider.start();
    const postmate = watchPostmate();

    // A page that window.open()s the wallet posts from its own window.
    const opener = post({ name: "opener" }, "https://evil.example", HANDSHAKE);
    // Even a message whose source is the wallet's own window.
    const self = post(parent, "https://wallet.1shotapi.com", HANDSHAKE);

    assert.equal(opener.stopped, true);
    assert.equal(self.stopped, true);
    assert.equal(postmate.handshakes, 0);
    assert.equal(provider.isEmbedded(), false);
    assert.equal(provider.getHostOrigin(), null);
    assert.equal(provider.getHostDomain(), null);
  });

  it("records the origin of the Postmate handshake from the parent", () => {
    const { win, parent, post } = fakeWindow({ embedded: true });
    const provider = new HostOriginProvider(win);
    provider.start();
    assert.equal(provider.isEmbedded(), true);
    assert.equal(provider.getHostOrigin(), null);

    const { stopped } = post(parent, "https://app.example.com:8443", HANDSHAKE);

    assert.equal(stopped, false);
    assert.equal(provider.getHostOrigin(), "https://app.example.com:8443");
    assert.equal(provider.getHostDomain(), "app.example.com");
  });

  it("stops a handshake from any window other than the parent before Postmate sees it", () => {
    const { win, parent, post, watchPostmate } = fakeWindow({ embedded: true });
    const provider = new HostOriginProvider(win);
    provider.start();
    const postmate = watchPostmate();

    const racer = post({ name: "opener" }, "https://evil.example", HANDSHAKE);
    assert.equal(racer.stopped, true);
    assert.equal(postmate.handshakes, 0);
    assert.equal(provider.getHostOrigin(), null);

    const real = post(parent, "https://app.example.com", HANDSHAKE);
    assert.equal(real.stopped, false);
    assert.equal(postmate.handshakes, 1);
    assert.equal(provider.getHostOrigin(), "https://app.example.com");
  });

  it("refuses browser-extension embedders, even as the parent", () => {
    for (const origin of [
      "chrome-extension://abcdefghijklmnop",
      "moz-extension://0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0",
      "safari-web-extension://ABCDEF",
    ]) {
      const { win, parent, post, watchPostmate } = fakeWindow({
        embedded: true,
        ancestorOrigins: [origin],
      });
      const provider = new HostOriginProvider(win);
      provider.start();
      const postmate = watchPostmate();
      assert.equal(provider.getHostOrigin(), null, `${origin} seed`);

      const result = post(parent, origin, HANDSHAKE);

      assert.equal(result.stopped, true, origin);
      assert.equal(postmate.handshakes, 0, origin);
      assert.equal(provider.getHostOrigin(), null, origin);
      assert.equal(provider.getHostDomain(), null, origin);
    }
  });

  it("refuses opaque origins and drops an ancestorOrigins seed when the parent is refused", () => {
    const { win, parent, post, watchPostmate } = fakeWindow({
      embedded: true,
      ancestorOrigins: ["https://host.example"],
    });
    const provider = new HostOriginProvider(win);
    provider.start();
    const postmate = watchPostmate();
    assert.equal(provider.getHostOrigin(), "https://host.example");

    assert.equal(post(parent, "null", HANDSHAKE).stopped, true);

    assert.equal(postmate.handshakes, 0);
    assert.equal(provider.getHostOrigin(), null);
  });

  it("ignores messages that are not the handshake", () => {
    const { win, parent, post } = fakeWindow({ embedded: true });
    const provider = new HostOriginProvider(win);
    provider.start();

    assert.equal(
      post(parent, "https://app.example.com", { postmate: "call" }).stopped,
      false,
    );
    assert.equal(
      post({ name: "other" }, "https://x.example", { postmate: "call" })
        .stopped,
      false,
    );
    post(parent, "https://app.example.com", "handshake");
    post(parent, "https://app.example.com", null);

    assert.equal(provider.getHostOrigin(), null);
  });

  it("seeds from ancestorOrigins before the handshake arrives", () => {
    const { win } = fakeWindow({
      embedded: true,
      ancestorOrigins: ["https://host.example", "https://outer.example"],
    });
    const provider = new HostOriginProvider(win);
    provider.start();

    assert.equal(provider.getHostOrigin(), "https://host.example");
    assert.equal(provider.getHostDomain(), "host.example");
  });

  it("registers a single listener even when started twice", () => {
    for (const embedded of [true, false]) {
      const { win, listeners } = fakeWindow({ embedded });
      const provider = new HostOriginProvider(win);
      provider.start();
      provider.start();
      assert.equal(listeners.length, 1);
    }
  });
});
