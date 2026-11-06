import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveSenderOrigin,
  toWebOrigin,
} from "../../extension/src/shared/origins.ts";

describe("toWebOrigin", () => {
  it("normalizes http(s) URLs to their origin", () => {
    assert.equal(
      toWebOrigin("https://app.example.com/path?x=1"),
      "https://app.example.com",
    );
    assert.equal(
      toWebOrigin("http://localhost:5173/"),
      "http://localhost:5173",
    );
  });

  it("rejects non-web schemes, opaque origins, and junk", () => {
    assert.equal(toWebOrigin("chrome-extension://abc/page.html"), null);
    assert.equal(toWebOrigin("moz-extension://abc/page.html"), null);
    assert.equal(toWebOrigin("file:///tmp/index.html"), null);
    assert.equal(toWebOrigin("about:blank"), null);
    assert.equal(toWebOrigin("javascript:alert(1)"), null);
    assert.equal(toWebOrigin("not a url"), null);
  });
});

describe("resolveSenderOrigin", () => {
  it("prefers the browser-provided sender origin", () => {
    assert.equal(
      resolveSenderOrigin({
        origin: "https://app.example.com",
        url: "https://other.example/page",
        tab: { url: "https://third.example/" },
      }),
      "https://app.example.com",
    );
  });

  it("falls back to the sender frame URL, then the tab URL", () => {
    assert.equal(
      resolveSenderOrigin({ url: "https://app.example.com/dapp" }),
      "https://app.example.com",
    );
    assert.equal(
      resolveSenderOrigin({ tab: { url: "https://tab.example.com/x" } }),
      "https://tab.example.com",
    );
  });

  it("refuses sub-frame senders", () => {
    assert.equal(
      resolveSenderOrigin({ origin: "https://app.example.com", frameId: 7 }),
      null,
    );
    assert.equal(
      resolveSenderOrigin({ origin: "https://app.example.com", frameId: 0 }),
      "https://app.example.com",
    );
  });

  it("refuses senders without a trustworthy web origin", () => {
    assert.equal(resolveSenderOrigin({}), null);
    assert.equal(resolveSenderOrigin({ origin: "null" }), null);
    assert.equal(
      resolveSenderOrigin({ url: "chrome-extension://abc/sidepanel.html" }),
      null,
    );
  });
});
