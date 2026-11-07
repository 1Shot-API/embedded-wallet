import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HostOriginProvider,
  type IHostOriginWindow,
} from "@/lib/implementations/utils/HostOriginProvider.ts";
import { OriginString } from "@/lib/types/primitives/OriginString.ts";

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
  return { win, parent, listeners, post };
}

const HANDSHAKE = {
  postmate: "handshake",
  type: "application/x-postmate-v1+json",
};

describe("HostOriginProvider", () => {
  it("knows nothing when the wallet runs top-level", () => {
    const { win, listeners } = fakeWindow({ embedded: false });
    const provider = new HostOriginProvider(win);
    provider.start();
    assert.equal(provider.isEmbedded(), false);
    assert.equal(provider.getHostOrigin(), null);
    assert.equal(provider.getHostDomain(), null);
    assert.equal(listeners.length, 0);
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
    const { win, parent, post, listeners } = fakeWindow({ embedded: true });
    const provider = new HostOriginProvider(win);
    provider.start();
    let postmateSawHandshake = 0;
    // Postmate's child listener registers after ours (wallet.start()).
    listeners.push((event) => {
      if ((event.data as { postmate?: string }).postmate === "handshake") {
        postmateSawHandshake += 1;
      }
    });

    const racer = post({ name: "opener" }, "https://evil.example", HANDSHAKE);
    assert.equal(racer.stopped, true);
    assert.equal(postmateSawHandshake, 0);
    assert.equal(provider.getHostOrigin(), null);

    const real = post(parent, "https://app.example.com", HANDSHAKE);
    assert.equal(real.stopped, false);
    assert.equal(postmateSawHandshake, 1);
    assert.equal(provider.getHostOrigin(), "https://app.example.com");
  });

  it("ignores parent messages that are not the handshake", () => {
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

  it("ignores opaque origins", () => {
    const { win, parent, post } = fakeWindow({ embedded: true });
    const provider = new HostOriginProvider(win);
    provider.start();

    post(parent, "null", HANDSHAKE);

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
    const { win, listeners } = fakeWindow({ embedded: true });
    const provider = new HostOriginProvider(win);
    provider.start();
    provider.start();
    assert.equal(listeners.length, 1);
  });

  it("recognizes browser-extension embedders", () => {
    const { win, parent, post } = fakeWindow({ embedded: true });
    const provider = new HostOriginProvider(win);
    provider.start();
    assert.equal(provider.isExtensionHost(), false);

    post(parent, "https://app.example.com", HANDSHAKE);
    assert.equal(provider.isExtensionHost(), false);

    const {
      win: chromeWin,
      parent: chromeParent,
      post: chromePost,
    } = fakeWindow({ embedded: true });
    const chromeProvider = new HostOriginProvider(chromeWin);
    chromeProvider.start();
    chromePost(chromeParent, "chrome-extension://abcdefghijklmnop", HANDSHAKE);
    assert.equal(chromeProvider.isExtensionHost(), true);
    assert.equal(chromeProvider.getHostDomain(), "abcdefghijklmnop");

    const { win: mozWin } = fakeWindow({
      embedded: true,
      ancestorOrigins: ["moz-extension://0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0"],
    });
    const mozProvider = new HostOriginProvider(mozWin);
    mozProvider.start();
    assert.equal(mozProvider.isExtensionHost(), true);
  });

  it("attributes work to the relayed origin and restores the host afterwards", async () => {
    const { win, parent, post } = fakeWindow({ embedded: true });
    const provider = new HostOriginProvider(win);
    provider.start();
    post(parent, "chrome-extension://abcdefghijklmnop", HANDSHAKE);

    const seen: Array<string | null> = [];
    const result = await provider.runForOrigin(
      OriginString("https://dapp.example"),
      async () => {
        seen.push(provider.getHostDomain());
        await Promise.resolve();
        seen.push(provider.getRequesterOrigin());
        return 42;
      },
    );

    assert.equal(result, 42);
    assert.deepEqual(seen, ["dapp.example", "https://dapp.example"]);
    assert.equal(provider.getHostDomain(), "abcdefghijklmnop");
    assert.equal(
      provider.getRequesterOrigin(),
      "chrome-extension://abcdefghijklmnop",
    );
    assert.equal(
      provider.getHostOrigin(),
      "chrome-extension://abcdefghijklmnop",
    );
  });

  it("serializes relayed work so the requester never changes mid-request", async () => {
    const { win, parent, post } = fakeWindow({ embedded: true });
    const provider = new HostOriginProvider(win);
    provider.start();
    post(parent, "chrome-extension://abcdefghijklmnop", HANDSHAKE);

    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const log: string[] = [];

    const first = provider.runForOrigin(
      OriginString("https://one.example"),
      async () => {
        log.push(`start:${provider.getHostDomain()}`);
        await firstGate;
        log.push(`end:${provider.getHostDomain()}`);
        throw new Error("first failed");
      },
    );
    const second = provider.runForOrigin(
      OriginString("https://two.example"),
      async () => {
        log.push(`start:${provider.getHostDomain()}`);
        return "ok";
      },
    );

    await Promise.resolve();
    assert.deepEqual(log, ["start:one.example"]);
    releaseFirst();

    await assert.rejects(first, /first failed/);
    assert.equal(await second, "ok");
    assert.deepEqual(log, [
      "start:one.example",
      "end:one.example",
      "start:two.example",
    ]);
    assert.equal(provider.getHostDomain(), "abcdefghijklmnop");
  });
});
