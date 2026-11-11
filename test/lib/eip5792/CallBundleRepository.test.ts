import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CALL_BUNDLE_TTL_MS,
  CALL_RESERVATION_TTL_MS,
} from "../../../src/lib/eip5792/constants.ts";
import {
  CallBundleRepository,
  type IStoredCallBundle,
} from "../../../src/lib/implementations/data/CallBundleRepository.ts";

function reservation(id: string, createdAt: number): IStoredCallBundle {
  return {
    id,
    origin: "https://app.example",
    account: "0xabc",
    chainId: "0x1",
    relayerUrl: "https://relayer.example",
    calls: [],
    feeToken: "",
    feeCollector: "",
    atomic: true,
    createdAt,
  };
}

function bundle(id: string, createdAt: number): IStoredCallBundle {
  return {
    id,
    origin: "https://app.example",
    account: "0xabc",
    chainId: "0x1",
    relayerUrl: "https://relayer.example",
    relayerTransactionId: "task-1",
    calls: [{ to: "0xabc", data: "0x", value: "0x0" }],
    feeToken: "0x1",
    feeCollector: "0x2",
    atomic: true,
    createdAt,
  };
}

function memoryRepo(now: () => number): {
  repo: CallBundleRepository;
  keys: () => string[];
} {
  const store = new Map<string, string>();
  const repo = new CallBundleRepository(
    {
      get: async (key) => store.get(key),
      set: async (key, value) => {
        store.set(key, value);
      },
      remove: async (key) => {
        store.delete(key);
      },
    },
    now,
  );
  return { repo, keys: () => [...store.keys()] };
}

describe("call bundle store", () => {
  it("rejects a duplicate id for the same origin and account", async () => {
    let now = 1_000;
    const { repo } = memoryRepo(() => now);
    await repo.put(bundle("0x01", now));
    const existing = await repo.get(
      "https://app.example",
      "0xABC",
      "0x01",
    );
    assert.ok(existing);
    assert.equal(existing?.id, "0x01");
  });

  it("forgets a bundle after 24 hours", async () => {
    let now = 5_000;
    const { repo, keys } = memoryRepo(() => now);
    await repo.put(bundle("0xaa", now));
    now += CALL_BUNDLE_TTL_MS + 1;
    const expired = await repo.get("https://app.example", "0xabc", "0xaa");
    assert.equal(expired, null);
    assert.deepEqual(keys(), []);
  });

  it("returns a fresh reservation and drops it after 2 minutes", async () => {
    let now = 10_000;
    const { repo, keys } = memoryRepo(() => now);
    await repo.put(reservation("0x11", now));
    const fresh = await repo.get("https://app.example", "0xabc", "0x11");
    assert.equal(fresh?.relayerTransactionId, undefined);

    now += CALL_RESERVATION_TTL_MS + 1;
    const expired = await repo.get("https://app.example", "0xabc", "0x11");
    assert.equal(expired, null);
    assert.deepEqual(keys(), []);
  });

  it("keeps a submitted bundle past the reservation window", async () => {
    let now = 10_000;
    const { repo } = memoryRepo(() => now);
    await repo.put(bundle("0x22", now));
    now += CALL_RESERVATION_TTL_MS + 1;
    const kept = await repo.get("https://app.example", "0xabc", "0x22");
    assert.equal(kept?.relayerTransactionId, "task-1");
    now += CALL_BUNDLE_TTL_MS;
    const expired = await repo.get("https://app.example", "0xabc", "0x22");
    assert.equal(expired, null);
  });

  it("remove drops the row", async () => {
    const { repo, keys } = memoryRepo(() => 1);
    await repo.put(reservation("0x33", 1));
    await repo.remove("https://app.example", "0xabc", "0x33");
    assert.equal(
      await repo.get("https://app.example", "0xabc", "0x33"),
      null,
    );
    assert.deepEqual(keys(), []);
  });

  it("does not return another origin's bundle", async () => {
    const { repo } = memoryRepo(() => 1);
    await repo.put(bundle("0x01", 1));
    const other = await repo.get("https://other.example", "0xabc", "0x01");
    assert.equal(other, null);
  });
});
