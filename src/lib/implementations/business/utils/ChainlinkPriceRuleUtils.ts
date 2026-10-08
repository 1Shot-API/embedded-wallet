import { EVMContractAddress } from "@1shotapi/ows-types";
import {
  concatHex,
  getAddress,
  isAddress,
  pad,
  toHex,
  type Hex,
} from "viem";

/** Matches ChainlinkPriceRuleLib / CoinOperated CHAINLINK_PRICE_RULE_ENFORCER_ADDRESS. */
export const CHAINLINK_PRICE_RULE_ENFORCER = EVMContractAddress(
  "0x4dAEbF9C5813EFF2606acD41BA25e57841e7cb75",
);

/** EIP-7715 appended caveat type for host-stacked Chainlink price rules. */
export const CHAINLINK_PRICE_RULE = "chainlink-price-rule" as const;

export const RULE_KIND_DIP = 0;
export const RULE_KIND_RISE = 1;
export const RULE_KIND_ABSOLUTE_GTE = 2;
export const RULE_KIND_ABSOLUTE_LTE = 3;

export type ChainlinkPriceRuleData = {
  priceFeed: EVMContractAddress;
  ruleKind: number;
  expectedDecimals: number;
  windowSeconds: number;
  thresholdBps: number;
  maxStaleSeconds: number;
  minGapSeconds: number;
  /** Feed units as decimal string (absolute); "0" for relative. */
  triggerPrice: string;
};

type TrustedFeed = { pair: string; decimals: number };

/**
 * Hard-verified Chainlink USD feed proxies (Ethereum mainnet + Base ETH/USD).
 * Malicious feeds are rejected before signing.
 */
export const TRUSTED_CHAINLINK_USD_FEEDS: ReadonlyMap<string, TrustedFeed> =
  new Map([
    [
      "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
      { pair: "ETH/USD", decimals: 8 },
    ],
    [
      "0xf4030086522a5beea06127aa4bbe73f8b8f65a86",
      { pair: "BTC/USD", decimals: 8 },
    ],
    [
      "0x214ed9da11d2bbbe9a2747a5fa0f8156c0ed75c3",
      { pair: "PAXG/USD", decimals: 8 },
    ],
    [
      "0x71041dddad3595f9ced3dccfbe3d1f4b0a16bb70",
      { pair: "ETH/USD (Base)", decimals: 8 },
    ],
  ]);

export function resolveTrustedFeed(priceFeed: string): TrustedFeed | null {
  if (!isAddress(priceFeed)) return null;
  return (
    TRUSTED_CHAINLINK_USD_FEEDS.get(getAddress(priceFeed).toLowerCase()) ?? null
  );
}

function readInt(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }
  throw new Error(`chainlink-price-rule.${field} is required`);
}

function readTriggerPrice(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return BigInt(value.trim());
  }
  throw new Error("chainlink-price-rule.triggerPrice is required");
}

/**
 * Parse and validate host `caveats[].data` for {@link CHAINLINK_PRICE_RULE}.
 */
export function parseChainlinkPriceRuleData(
  data: Record<string, unknown>,
): ChainlinkPriceRuleData {
  const priceFeedRaw = data.priceFeed;
  if (typeof priceFeedRaw !== "string" || !isAddress(priceFeedRaw)) {
    throw new Error("chainlink-price-rule.priceFeed must be an address");
  }
  const priceFeed = EVMContractAddress(getAddress(priceFeedRaw));
  const trusted = resolveTrustedFeed(priceFeed);
  if (trusted == null) {
    throw new Error(
      `chainlink-price-rule.priceFeed is not a trusted Chainlink feed: ${priceFeed}`,
    );
  }

  const ruleKind = readInt(data.ruleKind, "ruleKind");
  if (ruleKind < 0 || ruleKind > RULE_KIND_ABSOLUTE_LTE) {
    throw new Error("chainlink-price-rule.ruleKind must be 0–3");
  }

  const expectedDecimals = readInt(data.expectedDecimals, "expectedDecimals");
  if (expectedDecimals < 1 || expectedDecimals > 18) {
    throw new Error("chainlink-price-rule.expectedDecimals must be 1–18");
  }
  if (expectedDecimals !== trusted.decimals) {
    throw new Error(
      `chainlink-price-rule.expectedDecimals must be ${trusted.decimals} for ${trusted.pair}`,
    );
  }

  const windowSeconds = readInt(data.windowSeconds, "windowSeconds");
  const thresholdBps = readInt(data.thresholdBps, "thresholdBps");
  const maxStaleSeconds = readInt(data.maxStaleSeconds, "maxStaleSeconds");
  const minGapSeconds = readInt(data.minGapSeconds, "minGapSeconds");
  if (maxStaleSeconds <= 0) {
    throw new Error("chainlink-price-rule.maxStaleSeconds must be > 0");
  }
  if (minGapSeconds < 0) {
    throw new Error("chainlink-price-rule.minGapSeconds must be >= 0");
  }

  const isRelative =
    ruleKind === RULE_KIND_DIP || ruleKind === RULE_KIND_RISE;
  if (isRelative) {
    if (windowSeconds <= 0) {
      throw new Error(
        "chainlink-price-rule.windowSeconds must be > 0 for Dip/Rise",
      );
    }
    if (thresholdBps <= 0 || thresholdBps >= 10_000) {
      throw new Error(
        "chainlink-price-rule.thresholdBps must be 1–9999 for Dip/Rise",
      );
    }
  } else {
    const trigger = readTriggerPrice(data.triggerPrice);
    if (trigger <= 0n) {
      throw new Error(
        "chainlink-price-rule.triggerPrice must be > 0 for absolute rules",
      );
    }
  }

  const triggerPrice = readTriggerPrice(data.triggerPrice ?? "0");
  if (triggerPrice < 0n) {
    throw new Error("chainlink-price-rule.triggerPrice must be >= 0");
  }

  return {
    priceFeed,
    ruleKind,
    expectedDecimals,
    windowSeconds: isRelative ? windowSeconds : 0,
    thresholdBps: isRelative ? thresholdBps : 0,
    maxStaleSeconds,
    minGapSeconds,
    triggerPrice: triggerPrice.toString(),
  };
}

/**
 * Pack 68-byte terms per ChainlinkPriceRuleLib.encodeTerms.
 */
export function encodeChainlinkPriceRuleTerms(
  data: Record<string, unknown>,
): Hex {
  const parsed = parseChainlinkPriceRuleData(data);
  const trigger = BigInt(parsed.triggerPrice);
  const terms = concatHex([
    getAddress(parsed.priceFeed) as Hex,
    toHex(parsed.ruleKind, { size: 1 }),
    toHex(parsed.expectedDecimals, { size: 1 }),
    toHex(parsed.windowSeconds, { size: 4 }),
    toHex(parsed.thresholdBps, { size: 2 }),
    toHex(parsed.maxStaleSeconds, { size: 4 }),
    toHex(parsed.minGapSeconds, { size: 4 }),
    pad(toHex(trigger), { size: 32 }),
  ]);
  if ((terms.length - 2) / 2 !== 68) {
    throw new Error(
      `chainlink-price-rule terms must be 68 bytes, got ${(terms.length - 2) / 2}`,
    );
  }
  return terms;
}

export function ruleKindDisplayLabel(ruleKind: number): string {
  switch (ruleKind) {
    case RULE_KIND_DIP:
      return "Buy the dip";
    case RULE_KIND_RISE:
      return "Buy the upswing";
    case RULE_KIND_ABSOLUTE_GTE:
      return "Price above trigger";
    case RULE_KIND_ABSOLUTE_LTE:
      return "Price below trigger";
    default:
      return `Rule ${ruleKind}`;
  }
}
