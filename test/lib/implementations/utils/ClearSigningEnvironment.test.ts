import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EVMAccountAddress,
  EVMChainId,
  EVMContractAddress,
} from "@1shotapi/ows-types";
import type { IBlockchainProvider } from "@1shotapi/ows-wallet-utils";

import { ClearSigningEnvironment } from "@/lib/implementations/utils/ClearSigningEnvironment.ts";
import type { IChainRepository } from "@/lib/interfaces/data/IChainRepository.ts";
import type { IKnownAssetRepository } from "@/lib/interfaces/data/IKnownAssetRepository.ts";
import type { ITrackedAssetRepository } from "@/lib/interfaces/data/ITrackedAssetRepository.ts";

const BASE = EVMChainId("0x2105");
const TOKEN = EVMContractAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

const chainRepository = {
  getCatalog: () => [
    {
      chainId: BASE,
      label: "Base",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    },
  ],
} as unknown as IChainRepository;

function trackedRepository(
  assets: { address: string; name: string; symbol: string; decimals: number }[],
): ITrackedAssetRepository {
  return { list: async () => assets } as unknown as ITrackedAssetRepository;
}

function knownRepository(
  asset: { name: string; symbol: string; decimals: number } | null,
): IKnownAssetRepository {
  return {
    getKnownAsset: async () => asset,
  } as unknown as IKnownAssetRepository;
}

function blockchain(
  readContract: (args: { functionName: string }) => Promise<unknown>,
): IBlockchainProvider & { reads: number } {
  const provider = {
    reads: 0,
    getPublicClient: () => ({
      readContract: (args: { functionName: string }) => {
        provider.reads += 1;
        return readContract(args);
      },
    }),
  };
  return provider as unknown as IBlockchainProvider & { reads: number };
}

const onchainUsdc = () =>
  blockchain(async ({ functionName }) =>
    functionName === "symbol" ? "USDC" : 6,
  );

describe("ClearSigningEnvironment.getTokenMetadata", () => {
  it("prefers the tracked asset over the catalog and chain", async () => {
    const chain = onchainUsdc();
    const environment = new ClearSigningEnvironment(
      chainRepository,
      knownRepository({ name: "Known", symbol: "KNOWN", decimals: 2 }),
      trackedRepository([
        {
          address: TOKEN.toLowerCase(),
          name: "Tracked",
          symbol: "TRK",
          decimals: 4,
        },
      ]),
      chain,
    );
    assert.deepEqual(await environment.getTokenMetadata(BASE, TOKEN), {
      symbol: "TRK",
      decimals: 4,
    });
    assert.equal(chain.reads, 0);
  });

  it("falls back to the catalog, then to an on-chain read", async () => {
    const known = new ClearSigningEnvironment(
      chainRepository,
      knownRepository({ name: "USD Coin", symbol: "USDC", decimals: 6 }),
      trackedRepository([]),
      onchainUsdc(),
    );
    assert.deepEqual(await known.getTokenMetadata(BASE, TOKEN), {
      symbol: "USDC",
      decimals: 6,
    });

    const chain = onchainUsdc();
    const onchain = new ClearSigningEnvironment(
      chainRepository,
      knownRepository(null),
      trackedRepository([]),
      chain,
    );
    assert.deepEqual(await onchain.getTokenMetadata(BASE, TOKEN), {
      symbol: "USDC",
      decimals: 6,
    });
    assert.equal(chain.reads, 2);
  });

  it("returns null when the on-chain read fails, and caches that answer", async () => {
    const chain = blockchain(async () => {
      throw new Error("execution reverted");
    });
    const environment = new ClearSigningEnvironment(
      chainRepository,
      knownRepository(null),
      trackedRepository([]),
      chain,
    );
    assert.equal(await environment.getTokenMetadata(BASE, TOKEN), null);
    assert.equal(await environment.getTokenMetadata(BASE, TOKEN), null);
    assert.equal(chain.reads, 2);
  });

  it("returns null when the on-chain read times out", async () => {
    const environment = new ClearSigningEnvironment(
      chainRepository,
      knownRepository(null),
      trackedRepository([]),
      blockchain(() => new Promise(() => undefined)),
      { onchainTimeoutMs: 20 },
    );
    assert.equal(await environment.getTokenMetadata(BASE, TOKEN), null);
  });
});

describe("ClearSigningEnvironment chain lookups", () => {
  const environment = new ClearSigningEnvironment(
    chainRepository,
    knownRepository(null),
    trackedRepository([]),
    onchainUsdc(),
  );

  it("uses the catalog native currency and label", () => {
    assert.deepEqual(environment.getNativeCurrency(BASE), {
      symbol: "ETH",
      decimals: 18,
    });
    assert.equal(environment.getChainName(BASE), "Base");
  });

  it("falls back for chains outside the catalog", () => {
    const unknown = EVMChainId("0x539");
    assert.deepEqual(environment.getNativeCurrency(unknown), {
      symbol: "ETH",
      decimals: 18,
    });
    assert.equal(environment.getChainName(unknown), null);
  });

  it("names token contracts and nothing else", async () => {
    const named = new ClearSigningEnvironment(
      chainRepository,
      knownRepository({ name: "USD Coin", symbol: "USDC", decimals: 6 }),
      trackedRepository([]),
      onchainUsdc(),
    );
    assert.equal(
      await named.getAddressName(BASE, EVMAccountAddress(TOKEN)),
      "USD Coin",
    );
    assert.equal(
      await environment.getAddressName(
        BASE,
        EVMAccountAddress(`0x${"55".repeat(20)}`),
      ),
      null,
    );
  });
});
