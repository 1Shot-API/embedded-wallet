import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { IAppendedCaveatConfiguration } from "@1shotapi/ows-types";
import {
  createCaveat,
  type Hex,
  type SmartAccountsEnvironment,
} from "@metamask/smart-accounts-kit";
import { createCaveatBuilder } from "@metamask/smart-accounts-kit/utils";

import { appendHostCaveatsToBuilder } from "@/lib/implementations/business/DelegationService.ts";
import {
  CHAINLINK_PRICE_RULE,
  CHAINLINK_PRICE_RULE_ENFORCER,
} from "@/lib/implementations/business/utils/ChainlinkPriceRuleUtils.ts";

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

const LIFI_ENFORCER = enforcer(0xaa);
const LIFI_TERMS = ("0x" + "cd".repeat(284)) as Hex;
const DIAMOND = ("0x" + "11".repeat(20)) as Hex;

const chainlinkCaveat: IAppendedCaveatConfiguration = {
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

describe("LiFi host caveat stacking", () => {
  it("merges chainlink-price-rule onto the fixed LiFi swap stack", () => {
    const builder = createCaveatBuilder(environment, {
      allowInsecureUnrestrictedDelegation: true,
    })
      .addCaveat("allowedTargets", { targets: [DIAMOND] })
      .addCaveat("valueLte", { maxValue: 0n })
      .addCaveat(createCaveat(LIFI_ENFORCER, LIFI_TERMS, "0x"));

    appendHostCaveatsToBuilder(builder, [chainlinkCaveat]);
    const built = builder.build();

    assert.equal(built.length, 4);
    assert.equal(built[0]!.enforcer, enforcer(3)); // AllowedTargets
    assert.equal(built[1]!.enforcer, enforcer(4)); // ValueLte
    assert.equal(built[2]!.enforcer, LIFI_ENFORCER);
    assert.equal(
      built[3]!.enforcer.toLowerCase(),
      CHAINLINK_PRICE_RULE_ENFORCER.toLowerCase(),
    );
    assert.equal((built[3]!.terms.length - 2) / 2, 68);
    assert.equal(built[3]!.args, "0x");
  });

  it("leaves the LiFi stack unchanged when host caveats are empty", () => {
    const builder = createCaveatBuilder(environment, {
      allowInsecureUnrestrictedDelegation: true,
    })
      .addCaveat("allowedTargets", { targets: [DIAMOND] })
      .addCaveat("valueLte", { maxValue: 0n })
      .addCaveat(createCaveat(LIFI_ENFORCER, LIFI_TERMS, "0x"));

    appendHostCaveatsToBuilder(builder, undefined);
    assert.equal(builder.build().length, 3);
  });
});
