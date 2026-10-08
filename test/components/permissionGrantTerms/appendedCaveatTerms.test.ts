import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IAppendedCaveatConfiguration } from "@1shotapi/ows-types";
import {
  isAppendedCaveatValid,
  resolveAppendedCaveatRows,
} from "@/components/modals/permissionGrantTerms/appendedCaveatUtils.ts";
import { CHAINLINK_PRICE_RULE } from "@/lib/implementations/business/utils/ChainlinkPriceRuleUtils.ts";

const addr = (n: number) => "0x" + String(n).toString(16).padStart(40, "0");

const chainlinkDip: IAppendedCaveatConfiguration = {
  type: CHAINLINK_PRICE_RULE,
  data: {
    priceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    ruleKind: 0,
    expectedDecimals: 8,
    windowSeconds: 86400,
    thresholdBps: 1000,
    maxStaleSeconds: 3600,
    minGapSeconds: 60,
    triggerPrice: "0",
  },
};

describe("isAppendedCaveatValid", () => {
  it("accepts each allowlisted type including chainlink-price-rule", () => {
    const cases: IAppendedCaveatConfiguration[] = [
      { type: "allowedCalldata", data: { startIndex: 4, value: "0xab" } },
      { type: "allowedTargets", data: { targets: [addr(1)] } },
      { type: "allowedMethods", data: { selectors: ["0x12345678"] } },
      { type: "valueLte", data: { maxValue: 0n } },
      { type: "timestamp", data: { afterThreshold: 0, beforeThreshold: 0 } },
      { type: "redeemer", data: { redeemers: [addr(2)] } },
      { type: "limitedCalls", data: { limit: 1 } },
      { type: "nonce", data: { nonce: "0xabc" } },
      { type: "id", data: { id: 1 } },
      chainlinkDip,
    ];
    for (const c of cases) {
      assert.equal(isAppendedCaveatValid(c), true, `expected valid: ${c.type}`);
    }
  });

  it("rejects chainlink-price-rule with bad feed", () => {
    assert.equal(
      isAppendedCaveatValid({
        type: CHAINLINK_PRICE_RULE,
        data: { ...chainlinkDip.data, priceFeed: addr(9) },
      }),
      false,
    );
  });

  it("rejects an unknown type", () => {
    assert.equal(
      isAppendedCaveatValid({
        type: "erc20TransferAmount",
        data: {},
      } as unknown as IAppendedCaveatConfiguration),
      false,
    );
  });

  it("rejects non-object data", () => {
    assert.equal(
      isAppendedCaveatValid({
        type: "id",
        data: "nope",
      } as unknown as IAppendedCaveatConfiguration),
      false,
    );
  });
});

describe("resolveAppendedCaveatRows", () => {
  it("allowedCalldata resolves offset + pinned value rows", () => {
    const rows = resolveAppendedCaveatRows({
      type: "allowedCalldata",
      data: { startIndex: 4, value: "0xdeadbeef" },
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.label, "Calldata offset");
    assert.equal(rows[0]!.value, "4");
    assert.equal(rows[1]!.label, "Pinned value");
  });

  it("allowedTargets joins truncated addresses", () => {
    const rows = resolveAppendedCaveatRows({
      type: "allowedTargets",
      data: { targets: [addr(1), addr(2)] },
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.label, "Allowed targets");
    assert.ok(rows[0]!.value.includes(","));
  });

  it("timestamp emits only non-zero thresholds", () => {
    const rows = resolveAppendedCaveatRows({
      type: "timestamp",
      data: { afterThreshold: 0, beforeThreshold: 1_700_000_000 },
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.label, "Valid before");
  });

  it("limitedCalls shows the limit", () => {
    const rows = resolveAppendedCaveatRows({
      type: "limitedCalls",
      data: { limit: 5 },
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.value, "5");
  });

  it("id shows the numeric id", () => {
    const rows = resolveAppendedCaveatRows({
      type: "id",
      data: { id: 42 },
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.value, "42");
  });

  it("unknown type resolves to no rows", () => {
    const rows = resolveAppendedCaveatRows({
      type: "nope",
      data: {},
    } as unknown as IAppendedCaveatConfiguration);
    assert.deepEqual(rows, []);
  });

  it("chainlink-price-rule shows pair, rule, and trigger", () => {
    const rows = resolveAppendedCaveatRows(chainlinkDip);
    assert.ok(rows.some((r) => r.label === "Price source" && r.value.includes("ETH/USD")));
    assert.ok(rows.some((r) => r.label === "Rule" && r.value === "Buy the dip"));
    assert.ok(rows.some((r) => r.label === "Trigger" && r.value.includes("10%")));
  });
});
