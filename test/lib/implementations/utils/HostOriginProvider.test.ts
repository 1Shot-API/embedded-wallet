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
  const post = (source: unknown, origin: string, data: unknown) => {
    for (const listener of listeners) {
      listener({ source, origin, data } as unknown as MessageEvent);
    }
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
    assert.equal(provider.getHostOrigin(), null);
    assert.equal(provider.getHostDomain(), null);
    assert.equal(listeners.length, 0);
  });

  it("records the origin of the Postmate handshake from the parent", () => {
    const { win, parent, post } = fakeWindow({ embedded: true });
    const provider = new HostOriginProvider(win);
    provider.start();
    assert.equal(provider.getHostOrigin(), null);

    post(parent, "https://app.example.com:8443", HANDSHAKE);

    assert.equal(provider.getHostOrigin(), "https://app.example.com:8443");
    assert.equal(provider.getHostDomain(), "app.example.com");
  });

  it("ignores handshakes that do not come from the parent frame", () => {
    const { win, post } = fakeWindow({ embedded: true });
    const provider = new HostOriginProvider(win);
    provider.start();

    post({ name: "popup" }, "https://evil.example", HANDSHAKE);

    assert.equal(provider.getHostOrigin(), null);
  });

  it("ignores parent messages that are not the handshake", () => {
    const { win, parent, post } = fakeWindow({ embedded: true });
    const provider = new HostOriginProvider(win);
    provider.start();

    post(parent, "https://app.example.com", { postmate: "call" });
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
});
