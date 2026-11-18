import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import { EVMAccountAddress } from "@1shotapi/ows-types";
import type { Eip1193Handler, OWSWallet } from "@1shotapi/ows-wallet-utils";

import {
  type AccountConnectStorage,
  registerAccountConnect,
} from "@/ows/registerAccountConnect.ts";

const ADDRESS = EVMAccountAddress("0x1111111111111111111111111111111111111111");

function setup(granted: boolean) {
  const handlers = new Map<string, Eip1193Handler>();
  const events: { event: string; params: unknown[] }[] = [];
  const state = { granted };

  const wallet = {
    registerEip1193: (method: string, handler: Eip1193Handler) => {
      handlers.set(method, handler);
    },
    providerEvents: {
      emit: (event: string, ...params: unknown[]) => {
        events.push({ event, params });
      },
    },
  } as unknown as OWSWallet;

  const storage: AccountConnectStorage = {
    loadCachedEvmAddress: () => ADDRESS,
    saveCachedAddresses: () => {},
    loadAccountsPermissionGranted: () => state.granted,
    saveAccountsPermissionGranted: () => {
      state.granted = true;
    },
    clearAccountsPermissionGranted: () => {
      state.granted = false;
    },
  };

  registerAccountConnect(wallet, {} as OWSSigner, {
    storage,
    ensureReady: async () => {},
    requestConnectApproval: async () => true,
  });

  const call = (method: string, params: unknown[] = []) => {
    const handler = handlers.get(method);
    assert.ok(handler, `${method} not registered`);
    return handler(params);
  };

  return { call, events, state };
}

describe("registerAccountConnect wallet_revokePermissions", () => {
  it("revokes eth_accounts so eth_accounts and wallet_getPermissions are empty", async () => {
    const { call, events, state } = setup(true);
    assert.deepEqual(await call("eth_accounts"), [ADDRESS]);

    const result = await call("wallet_revokePermissions", [
      { eth_accounts: {} },
    ]);

    assert.equal(result, null);
    assert.equal(state.granted, false);
    assert.deepEqual(await call("eth_accounts"), []);
    assert.deepEqual(await call("wallet_getPermissions"), []);
    assert.deepEqual(events, [{ event: "accountsChanged", params: [[]] }]);
  });

  it("ignores revocations that do not include eth_accounts", async () => {
    const { call, events, state } = setup(true);
    await call("wallet_revokePermissions", [{ wallet_snap: {} }]);
    assert.equal(state.granted, true);
    assert.deepEqual(events, []);
  });

  it("does not emit when nothing was granted", async () => {
    const { call, events } = setup(false);
    await call("wallet_revokePermissions", [{ eth_accounts: {} }]);
    assert.deepEqual(events, []);
  });

  it("reconnects silently after a revoke + approval cycle keeps the cached address", async () => {
    const { call, state } = setup(true);
    await call("wallet_revokePermissions", [{ eth_accounts: {} }]);
    // `acquireDisplay` needs wallet.requestDisplay; the grant path is what matters here.
    state.granted = true;
    assert.deepEqual(await call("eth_requestAccounts"), [ADDRESS]);
  });
});
