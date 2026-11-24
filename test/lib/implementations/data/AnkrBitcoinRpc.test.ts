import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BITCOIN_MAINNET_CHAIN_ID,
  BitcoinSegwitAccountAddress,
} from "@1shotapi/ows-types";

import { AnkrBitcoinRpc } from "@/lib/implementations/data/AnkrBitcoinRpc.ts";
import type { IConfigProvider } from "@/lib/interfaces/utils/IConfigProvider.ts";

const address = BitcoinSegwitAccountAddress(
  "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
);

function rpc(): AnkrBitcoinRpc {
  return new AnkrBitcoinRpc({
    getConfig: async () => ({ ankrBtcApiKey: "key" }),
  } as unknown as IConfigProvider);
}

describe("AnkrBitcoinRpc mainnet fallback", () => {
  it("uses mempool.space mainnet when Ankr returns 403", async () => {
    const urls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("btc_blockbook")) {
        return new Response("origin", { status: 403 });
      }
      return new Response(
        JSON.stringify({
          chain_stats: { funded_txo_sum: 15, spent_txo_sum: 5 },
          mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;
    try {
      const balance = await rpc().getBalance(BITCOIN_MAINNET_CHAIN_ID, address);
      assert.equal(balance.confirmed, 10n);
      assert.equal(
        urls.some((url) => url.startsWith("https://mempool.space/api/address/")),
        true,
      );
      assert.equal(
        urls.some((url) => url.includes("mempool.space/testnet")),
        false,
      );
    } finally {
      globalThis.fetch = original;
    }
  });

  it("does not fall back when Ankr returns another error", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response("nope", { status: 500 })) as typeof fetch;
    try {
      await assert.rejects(
        () => rpc().getBalance(BITCOIN_MAINNET_CHAIN_ID, address),
        /Bitcoin balance request failed \(500\)/,
      );
    } finally {
      globalThis.fetch = original;
    }
  });
});
