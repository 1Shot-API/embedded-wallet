import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evmChainIdFromDecimal,
  resolveBridgeSourceChainId,
} from "@/wallet/registerBridge.ts";
import { EChain } from "@/lib/types/enum/EChain.ts";

describe("resolveBridgeSourceChainId", () => {
  const session = EChain.Base;

  it("defaults to the session chain when sourceChainId is omitted", () => {
    assert.equal(resolveBridgeSourceChainId(undefined, session), session);
  });

  it("converts a decimal host chain id to branded hex", () => {
    assert.equal(evmChainIdFromDecimal(8453), EChain.Base);
    assert.equal(resolveBridgeSourceChainId(1, session), EChain.Ethereum);
  });
});
