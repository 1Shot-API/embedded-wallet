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
  it("canonicalizes padded chain ids", () => {
    const mainnet = sendCallsParamsSchema.safeParse([
      sendBody({ chainId: "0x01" }),
    ]);
    const sepolia = sendCallsParamsSchema.safeParse([
      sendBody({ chainId: "0x0aa36a7" }),
    ]);
    assert.equal(mainnet.success, true);
    assert.equal(sepolia.success, true);
    if (!mainnet.success || !sepolia.success) return;
    assert.equal(mainnet.data[0].chainId, "0x1");
    assert.equal(sepolia.data[0].chainId, "0xaa36a7");
  });

  it("defaults a missing version to 2.0.0", () => {
    const { version: _version, ...withoutVersion } = sendBody();
    const parsed = sendCallsParamsSchema.safeParse([withoutVersion]);
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal(parsed.data[0].version, "2.0.0");
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

  it("canonicalizes a padded getCapabilities chain id", () => {
    const parsed = getCapabilitiesParamsSchema.safeParse([
      ACCOUNT,
      ["0x01", "0x0aa36a7"],
    ]);
    assert.equal(parsed.success, true);
    if (!parsed.success || parsed.data.length !== 2) return;
    assert.deepEqual(parsed.data[1], ["0x1", "0xaa36a7"]);
  });
});
