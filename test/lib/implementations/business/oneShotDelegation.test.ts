import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit";
import { createCaveatBuilder } from "@metamask/smart-accounts-kit/utils";
import { getAddress, type Hex } from "viem";

import { buildOneShotExactCalldataDelegation } from "@/lib/implementations/business/utils/TransactionUtils.ts";

const environment = getSmartAccountsEnvironment(8453);
const from = `0x${"11".repeat(20)}` as Hex;
const delegate = `0x${"22".repeat(20)}` as Hex;
const target = getAddress(`0x${"33".repeat(20)}`);
const salt = `0x${"ab".repeat(32)}` as Hex;
const transferSelector = "0xa9059cbb" as Hex;

function builtCaveat(
  type: "limitedCalls" | "allowedTargets" | "allowedMethods" | "valueLte",
  data: Record<string, unknown>,
) {
  return createCaveatBuilder(environment, {
    allowInsecureUnrestrictedDelegation: true,
  })
    .addCaveat(type, data as never)
    .build()[0]!;
}

function hasCaveat(
  caveats: ReadonlyArray<{ enforcer: string; terms: string }>,
  expected: { enforcer: string; terms: string },
): boolean {
  return caveats.some(
    (caveat) =>
      caveat.enforcer.toLowerCase() === expected.enforcer.toLowerCase() &&
      caveat.terms.toLowerCase() === expected.terms.toLowerCase(),
  );
}

describe("buildOneShotExactCalldataDelegation", () => {
  const limited = builtCaveat("limitedCalls", { limit: 1 });
  const pinnedTarget = builtCaveat("allowedTargets", { targets: [target] });
  const methods = builtCaveat("allowedMethods", {
    selectors: [transferSelector],
  });
  const valueCap = builtCaveat("valueLte", { maxValue: 1n });

  it("signs empty calldata as a one-time native transfer to the recipient", () => {
    const delegation = buildOneShotExactCalldataDelegation({
      environment,
      from,
      delegate,
      target,
      value: 1_000_000_000_000_000n,
      callData: "0x",
      salt,
    });

    assert.equal(hasCaveat(delegation.caveats, limited), true);
    assert.equal(hasCaveat(delegation.caveats, pinnedTarget), true);
    assert.equal(hasCaveat(delegation.caveats, methods), false);
    assert.equal(hasCaveat(delegation.caveats, valueCap), false);
  });

  it("keeps a selector on FunctionCall, including attached ETH, and limits it to one call", () => {
    const delegation = buildOneShotExactCalldataDelegation({
      environment,
      from,
      delegate,
      target,
      value: 1n,
      callData: `${transferSelector}${"00".repeat(32)}`,
      salt,
    });

    assert.equal(hasCaveat(delegation.caveats, limited), true);
    assert.equal(hasCaveat(delegation.caveats, methods), true);
    assert.equal(hasCaveat(delegation.caveats, valueCap), true);
  });
});
