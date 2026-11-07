import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isConnectionScopedRead,
  isInteractiveMethod,
  isOriginBoundMethod,
  requiresConnectedOrigin,
} from "../../extension/src/shared/protocol.ts";

describe("extension protocol — per-origin gating", () => {
  it("treats EIP-7715 grant and revoke as prompts that need a connected origin", () => {
    for (const method of [
      "wallet_requestExecutionPermissions",
      "wallet_revokeExecutionPermission",
    ]) {
      assert.equal(isInteractiveMethod(method), true, method);
      assert.equal(requiresConnectedOrigin(method), true, method);
    }
  });

  it("hides stored grants and accounts from origins that never connected", () => {
    for (const method of [
      "eth_accounts",
      "wallet_getPermissions",
      "wallet_getGrantedExecutionPermissions",
    ]) {
      assert.equal(isConnectionScopedRead(method), true, method);
      assert.equal(requiresConnectedOrigin(method), false, method);
    }
  });

  it("does not gate the connect methods themselves", () => {
    for (const method of ["eth_requestAccounts", "wallet_requestPermissions"]) {
      assert.equal(requiresConnectedOrigin(method), false, method);
      assert.equal(isOriginBoundMethod(method), true, method);
    }
  });

  it("forwards prompts and scoped reads with the origin, passes chain reads through", () => {
    for (const method of [
      "personal_sign",
      "eth_sendTransaction",
      "wallet_requestExecutionPermissions",
      "wallet_getGrantedExecutionPermissions",
      "eth_accounts",
    ]) {
      assert.equal(isOriginBoundMethod(method), true, method);
    }
    for (const method of [
      "eth_chainId",
      "eth_call",
      "eth_blockNumber",
      "wallet_getSupportedExecutionPermissions",
    ]) {
      assert.equal(isOriginBoundMethod(method), false, method);
      assert.equal(isConnectionScopedRead(method), false, method);
    }
  });
});
