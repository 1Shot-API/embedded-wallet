import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EVMAccountAddress,
  EVMContractAddress,
  type EVMChainId,
} from "@1shotapi/ows-types";

import { PaymentTokenUtils } from "@/lib/implementations/business/utils/PaymentTokenUtils.ts";
import { HardcodedChainRepository } from "@/lib/implementations/data/HardcodedChainRepository.ts";
import type { IPaymentTokenOption } from "@/lib/interfaces/business/ITransactionService.ts";
import type { IOneshotRelayerRepository } from "@/lib/interfaces/data/IOneshotRelayerRepository.ts";
import type { ITrackedAssetRepository } from "@/lib/interfaces/data/ITrackedAssetRepository.ts";
import {
  NewTrackedAsset,
  TrackedAsset,
} from "@/lib/types/domain/TrackedAsset.ts";
import { EAssetType } from "@/lib/types/enum/EAssetType.ts";
import { EChain } from "@/lib/types/enum/EChain.ts";

const OWNER = EVMAccountAddress("0x1111111111111111111111111111111111111111");
const ONE_USDC = 1_000_000n;

const ARC_USDC = EVMContractAddress(
  "0x3600000000000000000000000000000000000000",
);
const BASE_USDC = EVMContractAddress(
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
);
const BASE_SEPOLIA_USDC = EVMContractAddress(
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
);
const SEPOLIA_USDC = EVMContractAddress(
  "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
);

const USDC_BY_CHAIN = new Map<EVMChainId, EVMContractAddress>([
  [EChain.Arc, ARC_USDC],
  [EChain.ArcTestnet, ARC_USDC],
  [EChain.Base, BASE_USDC],
  [EChain.BaseSepolia, BASE_SEPOLIA_USDC],
  [EChain.Sepolia, SEPOLIA_USDC],
]);

function chainIds(options: readonly IPaymentTokenOption[]): Set<EVMChainId> {
  return new Set(options.map((token) => token.chainId));
}

function createUtils(
  balances: ReadonlyMap<EVMChainId, bigint>,
): PaymentTokenUtils {
  const relayerRepository = {
    async getCapabilities(_relayerUrl: string, chainId: EVMChainId) {
      const address =
        USDC_BY_CHAIN.get(chainId) ??
        EVMContractAddress("0x0000000000000000000000000000000000000001");
      return {
        feeCollector: EVMAccountAddress(
          "0x0000000000000000000000000000000000000002",
        ),
        targetAddress: EVMAccountAddress(
          "0x0000000000000000000000000000000000000003",
        ),
        tokens: [{ address, symbol: "USDC", decimals: 6 }],
      };
    },
  } as IOneshotRelayerRepository;

  const trackedAssetRepository = {
    async getBalances(
      _owner: EVMAccountAddress,
      options: { chainId: EVMChainId },
    ) {
      const balance = balances.get(options.chainId);
      const address = USDC_BY_CHAIN.get(options.chainId);
      if (balance === undefined || address === undefined) return [];
      return [
        TrackedAsset.fromNew(
          new NewTrackedAsset(
            options.chainId,
            address,
            EAssetType.Erc20,
            "USD Coin",
            "USDC",
            6,
          ),
          balance,
        ),
      ];
    },
  } as ITrackedAssetRepository;

  return new PaymentTokenUtils(
    new HardcodedChainRepository(),
    relayerRepository,
    trackedAssetRepository,
  );
}

describe("PaymentTokenUtils relayer filter", () => {
  it("omits testnet stables from a mainnet payment list", async () => {
    const utils = createUtils(
      new Map([
        [EChain.ArcTestnet, ONE_USDC],
        [EChain.Sepolia, ONE_USDC],
        [EChain.BaseSepolia, ONE_USDC],
        [EChain.Base, ONE_USDC],
      ]),
    );

    const options = await utils.listPaymentOptions(OWNER, [EChain.Arc]);
    const ids = chainIds(options);

    assert.equal(ids.has(EChain.Arc), true);
    assert.equal(ids.has(EChain.Base), true);
    assert.equal(ids.has(EChain.ArcTestnet), false);
    assert.equal(ids.has(EChain.Sepolia), false);
    assert.equal(ids.has(EChain.BaseSepolia), false);

    const payment = await utils.resolvePayment(OWNER, [EChain.Arc]);
    assert.equal(payment?.paymentChainId, EChain.Base);
  });

  it("omits mainnet stables from a testnet payment list and pick", async () => {
    const utils = createUtils(
      new Map([
        [EChain.Arc, ONE_USDC],
        [EChain.BaseSepolia, ONE_USDC],
      ]),
    );

    const options = await utils.listPaymentOptions(OWNER, [EChain.ArcTestnet]);
    const ids = chainIds(options);

    assert.equal(ids.has(EChain.ArcTestnet), true);
    assert.equal(ids.has(EChain.BaseSepolia), true);
    assert.equal(ids.has(EChain.Arc), false);

    const payment = await utils.resolvePayment(OWNER, [EChain.ArcTestnet]);
    assert.equal(payment?.paymentChainId, EChain.BaseSepolia);
    assert.equal(payment?.paymentChainName, "Base Sepolia");
  });

  it("offers Arc for a Base transaction and omits Arc Testnet", async () => {
    const utils = createUtils(
      new Map([
        [EChain.Arc, ONE_USDC],
        [EChain.ArcTestnet, ONE_USDC],
      ]),
    );

    const options = await utils.listPaymentOptions(OWNER, [EChain.Base]);
    const ids = chainIds(options);

    assert.equal(ids.has(EChain.Base), true);
    assert.equal(ids.has(EChain.Arc), true);
    assert.equal(ids.has(EChain.ArcTestnet), false);

    const payment = await utils.resolvePayment(OWNER, [EChain.Base]);
    assert.equal(payment?.paymentChainId, EChain.Arc);
    assert.equal(payment?.paymentChainName, "Arc");
  });
});
