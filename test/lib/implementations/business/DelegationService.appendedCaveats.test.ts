import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Hex, SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";
import type { IAppendedCaveatConfiguration } from "@1shotapi/ows-types";
import {
  APPENDED_CAVEAT_TYPES,
  HOST_RULE_TYPES,
  buildAppendedCaveatBuilder,
  buildErc20PeriodicAttenuatedPermission,
  validateAppendedCaveats,
} from "@/lib/implementations/business/DelegationService.ts";
import { CHAINLINK_PRICE_RULE } from "@/lib/implementations/business/utils/ChainlinkPriceRuleUtils.ts";
import { ERC20_TOKEN_PERIODIC } from "@/lib/interfaces/business/IDelegationService.ts";

const enforcer = (n: number): Hex =>
  `0x${n.toString(16).padStart(40, "0")}` as Hex;

const environment = {
  caveatEnforcers: {
    AllowedCalldataEnforcer: enforcer(1),
    AllowedMethodsEnforcer: enforcer(2),
    AllowedTargetsEnforcer: enforcer(3),
    ValueLteEnforcer: enforcer(4),
    TimestampEnforcer: enforcer(5),
    RedeemerEnforcer: enforcer(6),
    LimitedCallsEnforcer: enforcer(7),
    NonceEnforcer: enforcer(8),
    IdEnforcer: enforcer(9),
  },
} as unknown as SmartAccountsEnvironment;

const KIT_9: IAppendedCaveatConfiguration[] = [
  { type: "allowedCalldata", data: { startIndex: 4, value: "0xdeadbeef" } },
  { type: "allowedTargets", data: { targets: ["0x" + "1".repeat(40)] } },
  { type: "allowedMethods", data: { selectors: ["0x12345678"] } },
  { type: "valueLte", data: { maxValue: 0n } },
  { type: "timestamp", data: { afterThreshold: 0, beforeThreshold: 0 } },
  { type: "redeemer", data: { redeemers: ["0x" + "2".repeat(40)] } },
  { type: "limitedCalls", data: { limit: 1 } },
  { type: "nonce", data: { nonce: "0xabc" } },
  { type: "id", data: { id: 1 } },
];

const CHAINLINK_DIP: IAppendedCaveatConfiguration = {
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

const ALL_10: IAppendedCaveatConfiguration[] = [...KIT_9, CHAINLINK_DIP];

describe("HOST_RULE_TYPES discovery", () => {
  it("matches the full appended caveat allowlist (no fake expiry)", () => {
    assert.deepEqual([...HOST_RULE_TYPES], [...APPENDED_CAVEAT_TYPES]);
    assert.ok(HOST_RULE_TYPES.includes(CHAINLINK_PRICE_RULE));
    assert.equal(HOST_RULE_TYPES.includes("expiry" as never), false);
  });
});

describe("validateAppendedCaveats", () => {
  it("returns [] for undefined", () => {
    assert.deepEqual(validateAppendedCaveats(undefined), []);
  });

  it("accepts all allowlisted types including chainlink-price-rule", () => {
    const result = validateAppendedCaveats(ALL_10);
    assert.equal(result.length, 10);
    assert.deepEqual(
      result.map((c) => c.type),
      [...APPENDED_CAVEAT_TYPES],
    );
  });

  it("rejects chainlink-price-rule with untrusted feed", () => {
    assert.throws(
      () =>
        validateAppendedCaveats([
          {
            type: CHAINLINK_PRICE_RULE,
            data: {
              ...CHAINLINK_DIP.data,
              priceFeed: "0x" + "1".repeat(40),
            },
          },
        ]),
      /not a trusted Chainlink feed/,
    );
  });

  it("throws on an unknown type", () => {
    assert.throws(
      () =>
        validateAppendedCaveats([
          { type: "erc20TransferAmount", data: {} },
        ] as unknown as IAppendedCaveatConfiguration[]),
      /Unsupported appended caveat type/,
    );
  });

  it("throws when data is missing or not an object", () => {
    assert.throws(
      () =>
        validateAppendedCaveats([
          { type: "id", data: "not-an-object" },
        ] as unknown as IAppendedCaveatConfiguration[]),
      /requires a config object in `data`/,
    );
  });

  it("throws when input is not an array", () => {
    assert.throws(
      () =>
        validateAppendedCaveats(
          {} as unknown as IAppendedCaveatConfiguration[],
        ),
      /must be an array/,
    );
  });
});

describe("buildAppendedCaveatBuilder", () => {
  it("builds caveats with the right enforcer addresses for each type", () => {
    const builder = buildAppendedCaveatBuilder(environment, ALL_10);
    const built = builder.build();
    assert.equal(built.length, 10);
    const enforcers = new Set(built.map((c) => c.enforcer));
    for (const addr of [
      enforcer(1), enforcer(2), enforcer(3), enforcer(4),
      enforcer(5), enforcer(6), enforcer(7), enforcer(8), enforcer(9),
    ]) {
      assert.ok(enforcers.has(addr), `missing enforcer ${addr}`);
    }
    const chainlink = built.find(
      (c) =>
        c.enforcer.toLowerCase() ===
        "0x4daebf9c5813eff2606acd41ba25e57841e7cb75",
    );
    assert.ok(chainlink, "missing ChainlinkPriceRuleEnforcer");
    assert.equal((chainlink!.terms.length - 2) / 2, 68);
    assert.equal(chainlink!.args, "0x");
  });

  it("allowedCalldata caveat resolves to AllowedCalldataEnforcer", () => {
    const builder = buildAppendedCaveatBuilder(environment, [
      { type: "allowedCalldata", data: { startIndex: 4, value: "0xdeadbeef" } },
    ]);
    const built = builder.build();
    assert.equal(built.length, 1);
    assert.equal(built[0]!.enforcer, enforcer(1));
  });

  it("returns a builder with no caveats when input is empty/undefined", () => {
    assert.deepEqual(buildAppendedCaveatBuilder(environment, undefined).build(), []);
    assert.deepEqual(buildAppendedCaveatBuilder(environment, []).build(), []);
  });

  it("rejects unknown types before building", () => {
    assert.throws(
      () =>
        buildAppendedCaveatBuilder(environment, [
          { type: "nope", data: {} },
        ] as unknown as IAppendedCaveatConfiguration[]),
      /Unsupported appended caveat type/,
    );
  });
});

describe("buildErc20PeriodicAttenuatedPermission", () => {
  const basePermission = {
    type: ERC20_TOKEN_PERIODIC,
    isAdjustmentAllowed: false,
    data: {
      tokenAddress: "0x" + "a".repeat(40),
      periodAmount: "0x64",
      periodDuration: 86400,
    },
  };

  it("echoes appended caveats onto permission.data.caveats when provided", () => {
    const caveats: IAppendedCaveatConfiguration[] = [
      { type: "limitedCalls", data: { limit: 3 } },
    ];
    const result = buildErc20PeriodicAttenuatedPermission(
      basePermission,
      "0x" + "0".repeat(64),
      caveats,
    );
    const data = result.data as Record<string, unknown>;
    assert.ok(Array.isArray(data.caveats));
    assert.equal((data.caveats as unknown[]).length, 1);
  });

  it("omits the caveats key when undefined", () => {
    const result = buildErc20PeriodicAttenuatedPermission(
      basePermission,
      "0x" + "0".repeat(64),
      undefined,
    );
    const data = result.data as Record<string, unknown>;
    assert.equal("caveats" in data, false);
  });

  it("omits the caveats key when empty", () => {
    const result = buildErc20PeriodicAttenuatedPermission(
      basePermission,
      "0x" + "0".repeat(64),
      [],
    );
    const data = result.data as Record<string, unknown>;
    assert.equal("caveats" in data, false);
  });

  it("preserves scope fields", () => {
    const result = buildErc20PeriodicAttenuatedPermission(
      basePermission,
      "0x" + "0".repeat(64),
      undefined,
    );
    assert.equal(result.type, ERC20_TOKEN_PERIODIC);
    const data = result.data as Record<string, unknown>;
    assert.equal(
      String(data.tokenAddress).toLowerCase(),
      "0x" + "a".repeat(40),
    );
    assert.equal(data.periodDuration, 86400);
  });
});
