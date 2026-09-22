import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Hex, SmartAccountsEnvironment } from "@metamask/smart-accounts-kit";
import type { IAppendedCaveatConfiguration } from "@1shotapi/ows-types";
import {
  APPENDED_CAVEAT_TYPES,
  buildAppendedCaveatBuilder,
  buildErc20PeriodicAttenuatedPermission,
  validateAppendedCaveats,
} from "@/lib/implementations/business/DelegationService.ts";
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

const ALL_9: IAppendedCaveatConfiguration[] = [
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

describe("validateAppendedCaveats", () => {
  it("returns [] for undefined", () => {
    assert.deepEqual(validateAppendedCaveats(undefined), []);
  });

  it("accepts all 9 allowlisted types", () => {
    const result = validateAppendedCaveats(ALL_9);
    assert.equal(result.length, 9);
    assert.deepEqual(
      result.map((c) => c.type),
      [...APPENDED_CAVEAT_TYPES],
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
    const builder = buildAppendedCaveatBuilder(environment, ALL_9);
    const built = builder.build();
    assert.equal(built.length, 9);
    const enforcers = new Set(built.map((c) => c.enforcer));
    for (const addr of [
      enforcer(1), enforcer(2), enforcer(3), enforcer(4),
      enforcer(5), enforcer(6), enforcer(7), enforcer(8), enforcer(9),
    ]) {
      assert.ok(enforcers.has(addr), `missing enforcer ${addr}`);
    }
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
