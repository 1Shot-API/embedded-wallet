import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";

import { ClearSigningUtils } from "@1shotapi/ows-clear-signing";
import {
  EVMChainId,
  EVMContractAddress,
  HexString,
  type IClearSigningCalldataLookupKey,
} from "@1shotapi/ows-types";

import { RelayerClearSigningRepository } from "@/lib/implementations/data/RelayerClearSigningRepository.ts";
import type { IConfigProvider } from "@/lib/interfaces/utils/IConfigProvider.ts";
import type { WalletConfig } from "@/lib/types/domain/WalletConfig.ts";

const SWAP_LOOKUP = readFileSync(
  new URL(
    "../../../fixtures/clear-signing/lookup-1inch-clipperSwap-base.json",
    import.meta.url,
  ),
  "utf8",
);

const configProvider: IConfigProvider = {
  getConfig: async () =>
    ({ relayerBaseUrl: "https://relayer.test" }) as unknown as WalletConfig,
};

const KEY = ClearSigningUtils.calldataLookupKey(
  EVMChainId("0x2105"),
  EVMContractAddress("0x111111125421cA6dc452d289314280a0f8842A65"),
  HexString(`0xd2d374e5${"00".repeat(32)}`),
) as IClearSigningCalldataLookupKey;

type FetchStub = (url: string, init?: RequestInit) => Promise<Response>;

const realFetch = globalThis.fetch;
let calls: string[] = [];

function stubFetch(impl: FetchStub): void {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(input));
    return impl(String(input), init);
  }) as typeof fetch;
}

const json = (body: string, status = 200) =>
  Promise.resolve(
    new Response(body, {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );

describe("RelayerClearSigningRepository", () => {
  beforeEach(() => {
    calls = [];
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("requests the calldata route and returns a parsed hit", async () => {
    stubFetch(() => json(SWAP_LOOKUP));
    const found = await new RelayerClearSigningRepository(
      configProvider,
    ).lookupCalldata(KEY);
    assert.ok(found);
    assert.equal(found.path, "registry/1inch/calldata-AggregationRouterV6.json");
    assert.equal(found.descriptor.format.intent, "Swap");
    assert.equal(calls.length, 1);
    const url = new URL(calls[0]!);
    assert.equal(url.origin + url.pathname, "https://relayer.test/clear-signing/calldata");
    assert.equal(url.searchParams.get("chainId"), "0x2105");
    assert.equal(url.searchParams.get("selector"), "0xd2d374e5");
  });

  it("returns null for { found: false } and caches the miss", async () => {
    stubFetch(() => json(`{"found":false}`));
    const repository = new RelayerClearSigningRepository(configProvider);
    assert.equal(await repository.lookupCalldata(KEY), null);
    assert.equal(await repository.lookupCalldata(KEY), null);
    assert.equal(calls.length, 1);
  });

  it("serves a repeated hit from the session cache", async () => {
    stubFetch(() => json(SWAP_LOOKUP));
    const repository = new RelayerClearSigningRepository(configProvider);
    await repository.lookupCalldata(KEY);
    assert.ok(await repository.lookupCalldata(KEY));
    assert.equal(calls.length, 1);
  });

  it("coalesces concurrent lookups for the same key", async () => {
    stubFetch(() => json(SWAP_LOOKUP));
    const repository = new RelayerClearSigningRepository(configProvider);
    const [a, b] = await Promise.all([
      repository.lookupCalldata(KEY),
      repository.lookupCalldata(KEY),
    ]);
    assert.ok(a && b);
    assert.equal(calls.length, 1);
  });

  for (const [name, impl] of [
    ["an HTTP 500", () => json(`{"error":"boom"}`, 500)],
    ["a malformed body", () => json(`{"found":true,"descriptor":{}}`)],
    ["a network error", () => Promise.reject(new TypeError("Failed to fetch"))],
  ] as const) {
    it(`returns null on ${name} without caching it`, async () => {
      stubFetch(impl);
      const repository = new RelayerClearSigningRepository(configProvider);
      assert.equal(await repository.lookupCalldata(KEY), null);
      assert.equal(await repository.lookupCalldata(KEY), null);
      assert.equal(calls.length, 2);
    });
  }

  it("returns null when the relayer does not answer in time", async () => {
    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const started = Date.now();
    const found = await new RelayerClearSigningRepository(configProvider, {
      timeoutMs: 20,
    }).lookupCalldata(KEY);
    assert.equal(found, null);
    assert.ok(Date.now() - started < 1000);
  });

  it("evicts the least recently used entry past the cache limit", async () => {
    stubFetch(() => json(`{"found":false}`));
    const repository = new RelayerClearSigningRepository(configProvider, {
      cacheLimit: 1,
    });
    const other = { ...KEY, address: EVMContractAddress(`0x${"22".repeat(20)}`) };
    await repository.lookupCalldata(KEY);
    await repository.lookupCalldata(other);
    await repository.lookupCalldata(KEY);
    assert.equal(calls.length, 3);
  });
});
