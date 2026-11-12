import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getCapabilitiesParamsSchema,
  sendCallsParamsSchema,
  unsupportedCapabilityName,
} from "../../../src/lib/eip5792/schema.ts";

const ACCOUNT = "0x0000000000000000000000000000000000000001";

function sendBody(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    version: "2.0.0",
    chainId: "0x1",
    atomicRequired: false,
    calls: [{ to: ACCOUNT }],
    ...overrides,
  };
}

describe("EIP-5792 params", () => {
  it("rejects a chain id with leading zeros", () => {
    const parsed = sendCallsParamsSchema.safeParse([sendBody({ chainId: "0x01" })]);
    assert.equal(parsed.success, false);
  });

  it("rejects a version other than 2.0.0", () => {
    const parsed = sendCallsParamsSchema.safeParse([
      sendBody({ version: "1.0" }),
    ]);
    assert.equal(parsed.success, false);
  });

  it("accepts 0x1 and an optional capability", () => {
    const parsed = sendCallsParamsSchema.safeParse([
      sendBody({
        capabilities: { paymasterService: { optional: true } },
      }),
    ]);
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal(parsed.data[0].chainId, "0x1");
    assert.equal(
      unsupportedCapabilityName(parsed.data[0].capabilities),
      undefined,
    );
  });

  it("names a required capability so the handler can return 5700", () => {
    assert.equal(
      unsupportedCapabilityName({
        paymasterService: { optional: false },
      }),
      "paymasterService",
    );
    assert.equal(
      unsupportedCapabilityName({ dataSuffix: {} }),
      "dataSuffix",
    );
  });

  it("rejects getCapabilities chain ids with leading zeros", () => {
    const parsed = getCapabilitiesParamsSchema.safeParse([
      ACCOUNT,
      ["0x01"],
    ]);
    assert.equal(parsed.success, false);
  });
});
