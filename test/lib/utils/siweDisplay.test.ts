import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isSiweUriRedundant,
  normalizeSiweHost,
  resolveSiweEvmChainId,
  siweDomainMatchesHost,
} from "@/lib/utils/siweDisplay.ts";

describe("normalizeSiweHost", () => {
  it("strips scheme and path", () => {
    assert.equal(
      normalizeSiweHost("https://app.example.com/login"),
      "app.example.com",
    );
  });

  it("normalizes bare domain", () => {
    assert.equal(normalizeSiweHost("localhost:3000"), "localhost");
  });
});

describe("isSiweUriRedundant", () => {
  it("treats matching hosts as redundant", () => {
    assert.equal(
      isSiweUriRedundant("https://example.com/login", "example.com"),
      true,
    );
    assert.equal(
      isSiweUriRedundant("https://app.example.com", "app.example.com"),
      true,
    );
  });

  it("shows URI when hosts differ", () => {
    assert.equal(
      isSiweUriRedundant("https://auth.example.com", "app.example.com"),
      false,
    );
  });
});

describe("resolveSiweEvmChainId", () => {
  it("parses decimal chain id", () => {
    assert.equal(String(resolveSiweEvmChainId("5042")), "0x13b2");
  });

  it("parses hex chain id", () => {
    assert.equal(String(resolveSiweEvmChainId("0x1")), "0x1");
  });
});

describe("siweDomainMatchesHost", () => {
  it("matches the same host ignoring case and port", () => {
    assert.equal(
      siweDomainMatchesHost("app.example.com", "app.example.com"),
      true,
    );
    assert.equal(
      siweDomainMatchesHost("App.Example.COM", "app.example.com"),
      true,
    );
    assert.equal(siweDomainMatchesHost("localhost:3000", "localhost"), true);
    assert.equal(
      siweDomainMatchesHost("https://app.example.com", "app.example.com"),
      true,
    );
  });

  it("rejects a message for another site, including subdomains", () => {
    assert.equal(siweDomainMatchesHost("bank.example", "evil.example"), false);
    assert.equal(
      siweDomainMatchesHost("example.com", "app.example.com"),
      false,
    );
    assert.equal(
      siweDomainMatchesHost("app.example.com", "example.com"),
      false,
    );
    assert.equal(
      siweDomainMatchesHost("app.example.com.evil.test", "app.example.com"),
      false,
    );
  });

  it("never matches when either side is empty", () => {
    assert.equal(siweDomainMatchesHost("", "app.example.com"), false);
    assert.equal(siweDomainMatchesHost("app.example.com", ""), false);
    assert.equal(siweDomainMatchesHost("   ", "   "), false);
  });
});
