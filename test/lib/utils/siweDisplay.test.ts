import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSiweUriRedundant,
  normalizeSiweHost,
  resolveSiweEvmChainId,
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
