import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  datetimeLocalInputToUnixSeconds,
  formatPermissionAmount,
  formatSlippageBpsLabel,
  formatUnixSecondsLabel,
  humanizePeriodDuration,
  humanizeStreamDuration,
  parsePeriodDurationSeconds,
  resolvePermissionEndUnixSeconds,
  unixSecondsToDatetimeLocalInput,
} from "@/lib/utils/delegationDisplay.ts";

describe("humanizePeriodDuration", () => {
  it("maps common periods", () => {
    assert.equal(humanizePeriodDuration(86_400), "Daily");
    assert.equal(humanizePeriodDuration(604_800), "Weekly");
  });

  it("handles multi-day periods", () => {
    assert.equal(humanizePeriodDuration(172_800), "Every 2 days");
  });
});

describe("humanizeStreamDuration", () => {
  it("formats hours without Every prefix", () => {
    assert.equal(humanizeStreamDuration(10_000), "2.8 hours");
  });

  it("formats whole days and hours with singular labels", () => {
    assert.equal(humanizeStreamDuration(86_400), "1 day");
    assert.equal(humanizeStreamDuration(3600), "1 hour");
  });
});

describe("formatPermissionAmount", () => {
  it("formats valid amounts", () => {
    assert.equal(formatPermissionAmount("1.5", "USDC", 6), "1.5 USDC");
  });

  it("returns null for invalid input", () => {
    assert.equal(formatPermissionAmount("", "USDC", 6), null);
    assert.equal(formatPermissionAmount("abc", "USDC", 6), null);
  });
});

describe("parsePeriodDurationSeconds", () => {
  it("parses integer seconds", () => {
    assert.equal(parsePeriodDurationSeconds("86400"), 86_400);
  });
});

describe("formatUnixSecondsLabel", () => {
  it("formats unix seconds", () => {
    const label = formatUnixSecondsLabel(1_700_000_000, "en-US");
    assert.ok(label && label.length > 0);
  });

  it("returns null for empty", () => {
    assert.equal(formatUnixSecondsLabel(""), null);
  });
});

describe("formatSlippageBpsLabel", () => {
  it("formats basis points as percent", () => {
    assert.equal(formatSlippageBpsLabel(50), "0.5%");
    assert.equal(formatSlippageBpsLabel(100), "1%");
  });

  it("returns null for invalid bps", () => {
    assert.equal(formatSlippageBpsLabel(10_000), null);
  });
});

describe("resolvePermissionEndUnixSeconds", () => {
  it("reads expiry rule", () => {
    assert.equal(
      resolvePermissionEndUnixSeconds({
        rules: [{ type: "expiry", data: { expiry: 1_700_100_000 } }],
      }),
      1_700_100_000,
    );
  });

  it("computes start plus lifetime on permission data", () => {
    assert.equal(
      resolvePermissionEndUnixSeconds({
        permissionData: {
          startDate: 1_700_000_000,
          lifetimeSeconds: 86_400,
        },
      }),
      1_700_086_400,
    );
  });

  it("returns null when no finite end is specified", () => {
    assert.equal(resolvePermissionEndUnixSeconds({}), null);
  });
});

describe("datetime-local start helpers", () => {
  it("round-trips through datetime-local input", () => {
    const unix = 1_700_004_000;
    const local = unixSecondsToDatetimeLocalInput(unix);
    assert.ok(local.includes("T"));
    assert.equal(datetimeLocalInputToUnixSeconds(local), unix);
  });
});
