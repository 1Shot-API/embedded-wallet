import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OwsRpcError, type DomainString } from "@1shotapi/ows-types";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import type { z } from "zod";

import type { IHostOriginProvider } from "@/lib/interfaces/utils/IHostOriginProvider.ts";
import { OriginString } from "@/lib/types/primitives/OriginString.ts";
import { Eip1193HandlerRegistry } from "@/wallet/Eip1193HandlerRegistry.ts";
import {
  FORWARD_EIP1193_RPC_METHOD,
  registerForwardEip1193Rpc,
} from "@/wallet/registerForwardEip1193.ts";

type RpcHandler = (params: unknown) => Promise<unknown>;

/** Minimal `OWSWallet` stand-in: records registrations, validates like the real one. */
function fakeWallet() {
  const eip1193 = new Map<string, (params: unknown[]) => Promise<unknown>>();
  const rpc = new Map<string, { handler: RpcHandler; schema?: z.ZodType }>();
  const wallet = {
    registerEip1193(
      method: string,
      handler: (params: unknown[]) => Promise<unknown>,
    ) {
      eip1193.set(method, handler);
    },
    registerRpc(method: string, handler: RpcHandler, schema?: z.ZodType) {
      rpc.set(method, { handler, schema });
    },
  } as unknown as OWSWallet;
  const call = async (method: string, params: unknown): Promise<unknown> => {
    const registration = rpc.get(method);
    assert.ok(registration, `rpc ${method} registered`);
    const parsed = registration.schema
      ? registration.schema.parse(params)
      : params;
    return registration.handler(parsed);
  };
  return { wallet, eip1193, call };
}

function fakeHostOrigin(options: {
  extension: boolean;
}): IHostOriginProvider & {
  relayed: string[];
} {
  const relayed: string[] = [];
  return {
    relayed,
    start() {},
    isEmbedded: () => true,
    getHostOrigin: () =>
      OriginString(
        options.extension
          ? "chrome-extension://abcdefghijklmnop"
          : "https://host.example",
      ),
    getRequesterOrigin: () => null,
    getHostDomain: () => null as DomainString | null,
    isExtensionHost: () => options.extension,
    async runForOrigin(origin, work) {
      relayed.push(origin);
      return work();
    },
  };
}

describe("forwardEip1193 RPC", () => {
  it("runs a registered EIP-1193 handler as the relayed page origin", async () => {
    const { wallet, call } = fakeWallet();
    const registry = new Eip1193HandlerRegistry(wallet);
    const hostOrigin = fakeHostOrigin({ extension: true });
    registerForwardEip1193Rpc(wallet, {
      hostOriginProvider: hostOrigin,
      handlers: registry,
    });

    const calls: unknown[][] = [];
    wallet.registerEip1193("eth_accounts", async (params) => {
      calls.push(params);
      return ["0x1111111111111111111111111111111111111111"];
    });

    const result = await call(FORWARD_EIP1193_RPC_METHOD, {
      origin: "https://dapp.example",
      method: "eth_accounts",
      params: [],
    });

    assert.deepEqual(result, ["0x1111111111111111111111111111111111111111"]);
    assert.deepEqual(hostOrigin.relayed, ["https://dapp.example"]);
    assert.deepEqual(calls, [[]]);
  });

  it("normalizes params like the host provider: missing → [], object → [object]", async () => {
    const { wallet, call } = fakeWallet();
    const registry = new Eip1193HandlerRegistry(wallet);
    registerForwardEip1193Rpc(wallet, {
      hostOriginProvider: fakeHostOrigin({ extension: true }),
      handlers: registry,
    });
    const calls: unknown[][] = [];
    wallet.registerEip1193("eth_accounts", async (params) => {
      calls.push(params);
      return [];
    });
    wallet.registerEip1193("wallet_custom", async (params) => {
      calls.push(params);
      return null;
    });

    await call(FORWARD_EIP1193_RPC_METHOD, {
      origin: "https://dapp.example",
      method: "eth_accounts",
    });
    await call(FORWARD_EIP1193_RPC_METHOD, {
      origin: "https://dapp.example",
      method: "wallet_custom",
      params: { key: "value" },
    });

    assert.deepEqual(calls, [[], [{ key: "value" }]]);
  });

  it("validates forwarded params the way a direct call would", async () => {
    const { wallet, call } = fakeWallet();
    const registry = new Eip1193HandlerRegistry(wallet);
    registerForwardEip1193Rpc(wallet, {
      hostOriginProvider: fakeHostOrigin({ extension: true }),
      handlers: registry,
    });
    wallet.registerEip1193("personal_sign", async () => "0xsig");

    await assert.rejects(
      call(FORWARD_EIP1193_RPC_METHOD, {
        origin: "https://dapp.example",
        method: "personal_sign",
        params: ["not-hex-message-and-no-address"],
      }),
      (error: unknown) =>
        error instanceof OwsRpcError && /Invalid params/.test(error.message),
    );
  });

  it("refuses web-page hosts, unknown methods, and non-origin values", async () => {
    const { wallet, call } = fakeWallet();
    const registry = new Eip1193HandlerRegistry(wallet);
    const web = fakeHostOrigin({ extension: false });
    registerForwardEip1193Rpc(wallet, {
      hostOriginProvider: web,
      handlers: registry,
    });
    wallet.registerEip1193("eth_accounts", async () => []);

    await assert.rejects(
      call(FORWARD_EIP1193_RPC_METHOD, {
        origin: "https://dapp.example",
        method: "eth_accounts",
      }),
      (error: unknown) => error instanceof OwsRpcError && error.code === 4100,
    );
    assert.deepEqual(web.relayed, []);

    const { wallet: extWallet, call: extCall } = fakeWallet();
    const extRegistry = new Eip1193HandlerRegistry(extWallet);
    registerForwardEip1193Rpc(extWallet, {
      hostOriginProvider: fakeHostOrigin({ extension: true }),
      handlers: extRegistry,
    });

    await assert.rejects(
      extCall(FORWARD_EIP1193_RPC_METHOD, {
        origin: "https://dapp.example",
        method: "eth_doesNotExist",
      }),
      (error: unknown) => error instanceof OwsRpcError,
    );
    for (const origin of [
      "https://dapp.example/path",
      "chrome-extension://abcdefghijklmnop",
      "javascript:alert(1)",
      "dapp.example",
    ]) {
      await assert.rejects(
        extCall(FORWARD_EIP1193_RPC_METHOD, { origin, method: "eth_accounts" }),
        undefined,
        origin,
      );
    }
  });
});
