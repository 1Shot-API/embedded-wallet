import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit";
import { createCaveatBuilder } from "@metamask/smart-accounts-kit/utils";
import { concat, getAddress, toHex, type Hex } from "viem";

import { buildOneShotExactExecutionDelegation } from "@/lib/implementations/business/utils/TransactionUtils.ts";

const environment = getSmartAccountsEnvironment(8453);
const from = `0x${"11".repeat(20)}` as Hex;
const delegate = `0x${"22".repeat(20)}` as Hex;
const target = getAddress(`0x${"33".repeat(20)}`);
const salt = `0x${"ab".repeat(32)}` as Hex;
const transferCallData = `0xa9059cbb${"00".repeat(32)}` as Hex;
const zero = "0x0000000000000000000000000000000000000000" as Hex;

const DROPPED_ENFORCERS = [
  "AllowedTargetsEnforcer",
  "AllowedMethodsEnforcer",
  "ValueLteEnforcer",
  "ExactCalldataEnforcer",
] as const;

function enforcer(name: string): string {
  const address = environment.caveatEnforcers[name];
  assert.ok(address, `missing enforcer ${name}`);
  return address.toLowerCase();
}

function expectOneShot(
  delegation: ReturnType<typeof buildOneShotExactExecutionDelegation>,
  execution: { target: Hex; value: bigint; callData: Hex },
) {
  const exact = createCaveatBuilder(environment)
    .addCaveat("exactExecution", {
      execution: {
        target: getAddress(execution.target),
        value: execution.value,
        callData: execution.callData,
      },
    })
    .build()[0]!;
  const limited = createCaveatBuilder(environment)
    .addCaveat("limitedCalls", { limit: 1 })
    .build()[0]!;
  const expectedTerms = concat([
    getAddress(execution.target),
    toHex(execution.value, { size: 32 }),
    execution.callData,
  ]).toLowerCase();

  assert.equal(exact.terms.toLowerCase(), expectedTerms);
  assert.equal(delegation.authority.toLowerCase(), `0x${"ff".repeat(32)}`);
  assert.equal(delegation.signature, "0x");
  assert.deepEqual(
    delegation.caveats.map((caveat) => ({
      enforcer: caveat.enforcer.toLowerCase(),
      terms: caveat.terms.toLowerCase(),
    })),
    [
      {
        enforcer: exact.enforcer.toLowerCase(),
        terms: exact.terms.toLowerCase(),
      },
      {
        enforcer: limited.enforcer.toLowerCase(),
        terms: limited.terms.toLowerCase(),
      },
    ],
  );

  const present = new Set(
    delegation.caveats.map((caveat) => caveat.enforcer.toLowerCase()),
  );
  for (const name of DROPPED_ENFORCERS) {
    assert.equal(present.has(enforcer(name)), false);
  }
}

describe("buildOneShotExactExecutionDelegation", () => {
  it("pins a native transfer to target, value, and empty calldata", () => {
    const value = 1_000_000_000_000_000n;
    const delegation = buildOneShotExactExecutionDelegation({
      environment,
      from,
      delegate,
      target,
      value,
      callData: "0x",
      salt,
    });

    expectOneShot(delegation, { target, value, callData: "0x" });
  });

  it("pins a contract call, including attached ETH, the same way", () => {
    const delegation = buildOneShotExactExecutionDelegation({
      environment,
      from,
      delegate,
      target,
      value: 1n,
      callData: transferCallData,
      salt,
    });

    expectOneShot(delegation, {
      target,
      value: 1n,
      callData: transferCallData,
    });
  });

  it("pins the activation no-op to the zero address", () => {
    const delegation = buildOneShotExactExecutionDelegation({
      environment,
      from,
      delegate,
      target: zero,
      value: 0n,
      callData: "0x",
      salt,
    });

    expectOneShot(delegation, { target: zero, value: 0n, callData: "0x" });
  });
});
