import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  domainFieldEntries,
  formatEip712Primitive,
  humanizeEip712Key,
  isEvmAddressString,
  readDomainChainId,
  readVerifyingContract,
} from "@/lib/utils/eip712Display.ts";

describe("humanizeEip712Key", () => {
  it("splits camelCase", () => {
    assert.equal(humanizeEip712Key("verifyingContract"), "Verifying contract");
  });
});

describe("isEvmAddressString", () => {
  it("matches 20-byte hex addresses", () => {
    assert.equal(
      isEvmAddressString("0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826"),
      true,
    );
    assert.equal(isEvmAddressString("not-an-address"), false);
  });
});

describe("formatEip712Primitive", () => {
  it("stringifies bigint", () => {
    assert.equal(formatEip712Primitive(421614n), "421614");
  });
});

describe("readDomainChainId", () => {
  it("reads numeric chain id", () => {
    assert.equal(readDomainChainId({ chainId: 421614 }), "421614");
  });
});

describe("domainFieldEntries", () => {
  it("omits chainId and empty fields", () => {
    const entries = domainFieldEntries({
      name: "Ether Mail",
      version: "1",
      chainId: 421614,
      verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
    });
    assert.deepEqual(
      entries.map((entry) => entry.key),
      ["name", "version", "verifyingContract"],
    );
  });
});

describe("readVerifyingContract", () => {
  it("returns trimmed contract address", () => {
    assert.equal(
      readVerifyingContract({
        verifyingContract: " 0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC ",
      }),
      "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
    );
  });
});
