import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SignTypedDataPayload } from "@1shotapi/ows-signer-utils";
import { SIWEUtils } from "@/lib/implementations/utils/SIWEUtils.ts";

const siweUtils = new SIWEUtils();

const SIWE_TYPED: SignTypedDataPayload = {
  types: {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
    ],
    SignInWithEthereum: [
      { name: "domain", type: "string" },
      { name: "address", type: "address" },
      { name: "statement", type: "string" },
      { name: "uri", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "nonce", type: "string" },
      { name: "issuedAt", type: "string" },
    ],
  },
  primaryType: "SignInWithEthereum",
  domain: { name: "example.com", version: "1", chainId: 8453 },
  message: {
    domain: "example.com",
    address: "0x0000000000000000000000000000000000000001",
    statement: "Sign in to Example",
    uri: "https://example.com/login",
    version: "1",
    chainId: 8453,
    nonce: "abc123",
    issuedAt: "2024-01-01T00:00:00.000Z",
  },
};

const PERMIT_TYPED: SignTypedDataPayload = {
  types: {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ],
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
  primaryType: "Permit",
  domain: {
    name: "USD Coin",
    version: "2",
    chainId: 8453,
    verifyingContract: "0x0000000000000000000000000000000000000002",
  },
  message: {
    owner: "0x0000000000000000000000000000000000000001",
    spender: "0x0000000000000000000000000000000000000003",
    value: "1000",
    nonce: 0,
    deadline: 1_700_000_000,
  },
};

const EIP4361_TEXT = `example.com wants you to sign in with your Ethereum account:
0x0000000000000000000000000000000000000001

Sign in to Example

URI: https://example.com/login
Version: 1
Chain ID: 8453
Nonce: abc123
Issued At: 2024-01-01T00:00:00.000Z
Resources:
- https://example.com/my-web2-claim.json`;

describe("SIWEUtils.tryParseTypedData", () => {
  it("detects SignInWithEthereum typed data", () => {
    const fields = siweUtils.tryParseTypedData(SIWE_TYPED);
    assert.ok(fields);
    assert.equal(fields.domain, "example.com");
    assert.equal(fields.uri, "https://example.com/login");
    assert.equal(fields.chainId, "8453");
    assert.equal(fields.nonce, "abc123");
    assert.equal(fields.statement, "Sign in to Example");
    assert.equal(
      fields.address,
      "0x0000000000000000000000000000000000000001",
    );
  });

  it("detects SIWE by message fields when primaryType is Login", () => {
    const fields = siweUtils.tryParseTypedData({
      ...SIWE_TYPED,
      primaryType: "Login",
    });
    assert.ok(fields);
    assert.equal(fields.domain, "example.com");
  });

  it("rejects Permit typed data", () => {
    assert.equal(siweUtils.tryParseTypedData(PERMIT_TYPED), null);
  });
});

describe("SIWEUtils.tryParsePersonalMessage", () => {
  it("parses classic EIP-4361 text", () => {
    const fields = siweUtils.tryParsePersonalMessage(EIP4361_TEXT);
    assert.ok(fields);
    assert.equal(fields.domain, "example.com");
    assert.equal(fields.uri, "https://example.com/login");
    assert.equal(fields.version, "1");
    assert.equal(fields.chainId, "8453");
    assert.equal(fields.nonce, "abc123");
    assert.equal(fields.statement, "Sign in to Example");
    assert.equal(
      fields.address,
      "0x0000000000000000000000000000000000000001",
    );
    assert.deepEqual(fields.resources, [
      "https://example.com/my-web2-claim.json",
    ]);
  });

  it("rejects unrelated personal_sign text", () => {
    assert.equal(
      siweUtils.tryParsePersonalMessage("Please sign this friendly greeting"),
      null,
    );
  });

  it("parses hex-encoded EIP-4361 payloads", () => {
    const hex = "0x" + Buffer.from(EIP4361_TEXT, "utf8").toString("hex");
    const fields = siweUtils.tryParsePersonalMessage(hex);
    assert.ok(fields);
    assert.equal(fields.domain, "example.com");
    assert.equal(fields.nonce, "abc123");
  });
});
