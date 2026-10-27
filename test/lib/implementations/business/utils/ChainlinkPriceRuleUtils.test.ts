import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CHAINLINK_PRICE_RULE_ENFORCER,
  encodeChainlinkPriceRuleTerms,
  parseChainlinkPriceRuleData,
  RULE_KIND_ABSOLUTE_GTE,
  RULE_KIND_DIP,
} from "@/lib/implementations/business/utils/ChainlinkPriceRuleUtils.ts";

const ARC_ETH_USD = "0x50FCDD99D6762D1C170DC6A9111db944AEE6D364";
const ARC_BTC_USD = "0xa109B535C70C8Be9995be64Bb6751AcDB27e03De";
const BASE_ETH_USD = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70";
const BASE_BTC_USD = "0xC01502b887D09B0f329981764268fC32a94cB453";
// Ethereum mainnet proxies from Chainlink's reference data directory (feeds-mainnet.json).
const ETH_BTC_USD = "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c";
const ETH_PAXG_USD = "0x9944D86CEB9160aF5C5feB251FD671923323f8C3";

describe("parseChainlinkPriceRuleData", () => {
  it("accepts a trusted Dip rule", () => {
    const parsed = parseChainlinkPriceRuleData({
      priceFeed: ARC_BTC_USD,
      ruleKind: RULE_KIND_DIP,
      expectedDecimals: 8,
      windowSeconds: 86400,
      thresholdBps: 1000,
      maxStaleSeconds: 3600,
      minGapSeconds: 60,
      triggerPrice: "0",
    });
    assert.equal(parsed.ruleKind, RULE_KIND_DIP);
    assert.equal(parsed.thresholdBps, 1000);
    assert.equal(parsed.triggerPrice, "0");
  });

  it("accepts Base BTC/USD", () => {
    const parsed = parseChainlinkPriceRuleData({
      priceFeed: BASE_BTC_USD,
      ruleKind: RULE_KIND_DIP,
      expectedDecimals: 8,
      windowSeconds: 86400,
      thresholdBps: 500,
      maxStaleSeconds: 3600,
      minGapSeconds: 60,
      triggerPrice: "0",
    });
    assert.equal(parsed.priceFeed.toLowerCase(), BASE_BTC_USD.toLowerCase());
  });

  for (const [pair, feed] of [
    ["BTC/USD", ETH_BTC_USD],
    ["PAXG/USD", ETH_PAXG_USD],
  ] as const) {
    it(`accepts Ethereum ${pair}`, () => {
      const parsed = parseChainlinkPriceRuleData({
        priceFeed: feed,
        ruleKind: RULE_KIND_DIP,
        expectedDecimals: 8,
        windowSeconds: 86400,
        thresholdBps: 500,
        maxStaleSeconds: 3600,
        minGapSeconds: 60,
        triggerPrice: "0",
      });
      assert.equal(parsed.priceFeed.toLowerCase(), feed.toLowerCase());
    });
  }

  it("rejects an untrusted feed", () => {
    assert.throws(
      () =>
        parseChainlinkPriceRuleData({
          priceFeed: "0x" + "1".repeat(40),
          ruleKind: RULE_KIND_DIP,
          expectedDecimals: 8,
          windowSeconds: 86400,
          thresholdBps: 1000,
          maxStaleSeconds: 3600,
          minGapSeconds: 60,
          triggerPrice: "0",
        }),
      /not a trusted Chainlink feed/,
    );
  });

  it("rejects wrong expectedDecimals for a known feed", () => {
    assert.throws(
      () =>
        parseChainlinkPriceRuleData({
          priceFeed: BASE_ETH_USD,
          ruleKind: RULE_KIND_DIP,
          expectedDecimals: 18,
          windowSeconds: 86400,
          thresholdBps: 1000,
          maxStaleSeconds: 3600,
          minGapSeconds: 60,
          triggerPrice: "0",
        }),
      /expectedDecimals must be 8/,
    );
  });
});

describe("encodeChainlinkPriceRuleTerms", () => {
  it("packs exactly 68 bytes for a Dip rule", () => {
    const terms = encodeChainlinkPriceRuleTerms({
      priceFeed: ARC_BTC_USD,
      ruleKind: RULE_KIND_DIP,
      expectedDecimals: 8,
      windowSeconds: 86400,
      thresholdBps: 1000,
      maxStaleSeconds: 3600,
      minGapSeconds: 60,
      triggerPrice: "0",
    });
    assert.equal((terms.length - 2) / 2, 68);
    assert.equal(terms.slice(0, 42).toLowerCase(), ARC_BTC_USD.toLowerCase());
    assert.equal(terms.slice(42, 44), "00"); // ruleKind DIP
    assert.equal(terms.slice(44, 46), "08"); // decimals
  });

  it("packs absolute triggerPrice in the last 32 bytes", () => {
    const trigger = 4000n * 10n ** 8n;
    const terms = encodeChainlinkPriceRuleTerms({
      priceFeed: BASE_ETH_USD,
      ruleKind: RULE_KIND_ABSOLUTE_GTE,
      expectedDecimals: 8,
      windowSeconds: 0,
      thresholdBps: 0,
      maxStaleSeconds: 120,
      minGapSeconds: 0,
      triggerPrice: trigger.toString(),
    });
    assert.equal((terms.length - 2) / 2, 68);
    const triggerHex = terms.slice(2 + 36 * 2);
    assert.equal(BigInt("0x" + triggerHex), trigger);
  });
});

describe("CHAINLINK_PRICE_RULE_ENFORCER", () => {
  it("matches CREATE2 deployment", () => {
    assert.equal(
      CHAINLINK_PRICE_RULE_ENFORCER.toLowerCase(),
      "0x4daebf9c5813eff2606acd41ba25e57841e7cb75",
    );
  });
});
