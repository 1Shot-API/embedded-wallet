import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type {
  IClearSigningEnvironment,
  IClearSigningTypedData,
} from "@1shotapi/ows-clear-signing";
import {
  ClearSigningLookupResultSchema,
  EVMAccountAddress,
  EVMChainId,
  EVMContractAddress,
  HexString,
  type IClearSigningLookupFound,
} from "@1shotapi/ows-types";
import { encodeFunctionData, parseAbiItem } from "viem";

import { ClearSigningService } from "@/lib/implementations/business/ClearSigningService.ts";
import type { IClearSigningRepository } from "@/lib/interfaces/data/IClearSigningRepository.ts";

function fixture(name: string): IClearSigningLookupFound {
  const parsed = ClearSigningLookupResultSchema.parse(
    JSON.parse(
      readFileSync(
        new URL(`../../../fixtures/clear-signing/${name}`, import.meta.url),
        "utf8",
      ),
    ),
  );
  assert.ok(parsed.found);
  return parsed;
}

const SWAP = fixture("lookup-1inch-clipperSwap-base.json");
const PERMIT = fixture("lookup-usdc-permit-optimism.json");

const BASE = EVMChainId("0x2105");
const ONEINCH = EVMContractAddress("0x111111125421cA6dc452d289314280a0f8842A65");
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_OPTIMISM = "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85";
const SIGNER = EVMAccountAddress("0x1111111111111111111111111111111111111111");
const SPENDER = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

const environment: IClearSigningEnvironment = {
  getTokenMetadata: async (_chainId, address) =>
    [USDC_BASE, USDC_OPTIMISM]
      .map((a) => a.toLowerCase())
      .includes(address.toLowerCase())
      ? { symbol: "USDC", decimals: 6 }
      : null,
  getNativeCurrency: () => ({ symbol: "ETH", decimals: 18 }),
  getChainName: () => null,
  getAddressName: async () => null,
};

class FakeRepository implements IClearSigningRepository {
  public calldataCalls = 0;
  public eip712Calls = 0;
  constructor(private readonly answer: IClearSigningLookupFound | null) {}
  async lookupCalldata() {
    this.calldataCalls += 1;
    return this.answer;
  }
  async lookupEip712() {
    this.eip712Calls += 1;
    return this.answer;
  }
}

const clipperSwapData = HexString(
  encodeFunctionData({
    abi: [
      parseAbiItem(
        "function clipperSwap(address clipperExchange, uint256 srcToken, address dstToken, uint256 inputAmount, uint256 outputAmount, uint256 goodUntil, bytes32 r, bytes32 vs)",
      ),
    ],
    args: [
      "0x3333333333333333333333333333333333333333",
      BigInt(USDC_BASE),
      "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      1_500_250_000n,
      420_000_000_000_000_000n,
      1767225600n,
      `0x${"11".repeat(32)}`,
      `0x${"22".repeat(32)}`,
    ],
  }),
);

function permitTypedData(
  domain: Record<string, unknown>,
): IClearSigningTypedData {
  return {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    domain,
    message: {
      owner: SIGNER,
      spender: SPENDER,
      value: "25000000",
      nonce: "0",
      deadline: "1767225600",
    },
  };
}

describe("ClearSigningService.describeTransaction", () => {
  it("renders a 1inch swap from the relayer descriptor", async () => {
    const service = new ClearSigningService(
      new FakeRepository(SWAP),
      environment,
    );
    const presentation = await service.describeTransaction(
      BASE,
      SIGNER,
      ONEINCH,
      clipperSwapData,
      HexString("0x0"),
    );
    assert.ok(presentation);
    assert.equal(presentation.display.intent, "Swap");
    assert.ok(
      presentation.display.fields.some((f) => f.value === "1,500.25 USDC"),
    );
    assert.equal(presentation.path, SWAP.path);
    assert.equal(presentation.registrySha, SWAP.registrySha);
  });

  it("returns null when the descriptor is not bound to the called contract", async () => {
    const service = new ClearSigningService(
      new FakeRepository(SWAP),
      environment,
    );
    const presentation = await service.describeTransaction(
      BASE,
      SIGNER,
      EVMContractAddress(`0x${"44".repeat(20)}`),
      clipperSwapData,
      HexString("0x0"),
    );
    assert.equal(presentation, null);
  });

  it("does not look up calls without a selector", async () => {
    const repository = new FakeRepository(SWAP);
    const service = new ClearSigningService(repository, environment);
    assert.equal(
      await service.describeTransaction(
        BASE,
        SIGNER,
        ONEINCH,
        HexString("0x"),
        HexString("0x1"),
      ),
      null,
    );
    assert.equal(repository.calldataCalls, 0);
  });

  it("returns null on a registry miss", async () => {
    const service = new ClearSigningService(
      new FakeRepository(null),
      environment,
    );
    assert.equal(
      await service.describeTransaction(
        BASE,
        SIGNER,
        ONEINCH,
        clipperSwapData,
        HexString("0x0"),
      ),
      null,
    );
  });
});

describe("ClearSigningService.describeTypedData", () => {
  it("renders USDC Permit spender, amount and deadline", async () => {
    const service = new ClearSigningService(
      new FakeRepository(PERMIT),
      environment,
    );
    const presentation = await service.describeTypedData(
      permitTypedData({
        name: "USD Coin",
        version: "2",
        chainId: 10,
        verifyingContract: USDC_OPTIMISM,
      }),
      SIGNER,
    );
    assert.ok(presentation);
    assert.equal(presentation.display.intent, "Authorize spending of tokens");
    const byLabel = new Map(
      presentation.display.fields.map((f) => [f.label, f.value]),
    );
    assert.equal(byLabel.get("Spender"), SPENDER);
    assert.equal(byLabel.get("Max spending amount"), "25 USDC");
    assert.equal(byLabel.get("Owner"), "You");
    assert.ok(byLabel.get("Valid until"));
    assert.equal(byLabel.has("Nonce"), false);
  });

  it("does not look up typed data without a verifying contract", async () => {
    const repository = new FakeRepository(PERMIT);
    const service = new ClearSigningService(repository, environment);
    assert.equal(
      await service.describeTypedData(
        permitTypedData({ name: "USD Coin", version: "2", chainId: 10 }),
        SIGNER,
      ),
      null,
    );
    assert.equal(repository.eip712Calls, 0);
  });

  it("returns null when the message domain does not match the descriptor", async () => {
    const service = new ClearSigningService(
      new FakeRepository(PERMIT),
      environment,
    );
    assert.equal(
      await service.describeTypedData(
        permitTypedData({
          name: "Not USD Coin",
          version: "2",
          chainId: 10,
          verifyingContract: USDC_OPTIMISM,
        }),
        SIGNER,
      ),
      null,
    );
  });
});
