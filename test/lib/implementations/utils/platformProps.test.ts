import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { collectPlatformProps } from "@/lib/implementations/utils/platformProps.ts";

describe("collectPlatformProps", () => {
  it("detects Windows Chrome", () => {
    const props = collectPlatformProps({
      platform: "Win32",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    });
    assert.equal(props.platform, "Win32");
    assert.equal(props.os, "Windows");
    assert.equal(props.browser, "Chrome");
    assert.equal(props.isMobile, false);
  });

  it("detects iPhone Safari", () => {
    const props = collectPlatformProps({
      platform: "iPhone",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    });
    assert.equal(props.os, "iOS");
    assert.equal(props.browser, "Safari");
    assert.equal(props.isMobile, true);
  });

  it("detects Android Chrome and macOS Edge", () => {
    const android = collectPlatformProps({
      platform: "Linux armv8l",
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
    });
    assert.equal(android.os, "Android");
    assert.equal(android.isMobile, true);

    const edge = collectPlatformProps({
      platform: "MacIntel",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
    });
    assert.equal(edge.os, "macOS");
    assert.equal(edge.browser, "Edge");
  });
});
