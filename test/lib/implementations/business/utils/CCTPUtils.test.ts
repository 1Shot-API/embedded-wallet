import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeFunctionData, erc20Abi, pad, padHex } from "viem";
import { EVMAccountAddress, type EVMChainId } from "@1shotapi/ows-types";
import {
  CCTPUtils,
  tokenMessengerV2Abi,
} from "@/lib/implementations/business/utils/CCTPUtils.ts";
import { SupportedChain } from "@/lib/types/domain/SupportedChain.ts";
import { EChain } from "@/lib/types/enum/EChain.ts";
import { EChainNetworkType } from "@/lib/types/enum/EChainNetworkType.ts";
import { ECircleDomainId } from "@/lib/types/enum/ECircleDomainId.ts";
import { ECctpTransferSpeed } from "@/lib/types/enum/ECctpTransferSpeed.ts";

const cctp = new CCTPUtils();

const owner = EVMAccountAddress("0x1111111111111111111111111111111111111111");
const usdc = EVMAccountAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
const messenger = EVMAccountAddress(
  "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
);

function chain(
  id: EVMChainId,
  network: EChainNetworkType,
  dest: boolean,
  useRelayer = true,
): SupportedChain {
  return new SupportedChain(
    id,
    network,
    "https://relayer.example",
    useRelayer,
    "/logo.png",
    true,
    "https://rpc.example",
    String(id),
    "https://explorer.example",
    dest,
  );
}

describe("CCTPUtils", () => {
  describe("routes", () => {
    it("maps Base mainnet to Circle domain 6 and mainnet Iris", () => {
      const route = cctp.getRoute(EChain.Base);
      assert.ok(route);
      assert.equal(route.domain, ECircleDomainId.Base);
      assert.equal(route.networkType, EChainNetworkType.Mainnet);
      assert.equal(route.irisBaseUrl, cctp.irisApiMainnet);
    });

    it("maps Sepolia to Ethereum domain 0 and sandbox Iris", () => {
      const route = cctp.getRoute(EChain.Sepolia);
      assert.ok(route);
      assert.equal(route.domain, ECircleDomainId.Ethereum);
      assert.equal(route.networkType, EChainNetworkType.Testnet);
      assert.equal(route.irisBaseUrl, cctp.irisApiTestnet);
    });

    it("maps Arc Testnet to Arc domain 26", () => {
      const route = cctp.requireRoute(EChain.ArcTestnet);
      assert.equal(route.domain, ECircleDomainId.Arc);
      assert.equal(route.networkType, EChainNetworkType.Testnet);
    });

    it("returns null for Arc mainnet (not a CCTP wallet source)", () => {
      assert.equal(cctp.getRoute(EChain.Arc), null);
    });

    it("maps Fast to finality 1000 and Slow to 2000", () => {
      assert.equal(
        cctp.finalityThresholdForSpeed(ECctpTransferSpeed.Fast),
        cctp.fastFinalityThreshold,
      );
      assert.equal(
        cctp.finalityThresholdForSpeed(ECctpTransferSpeed.Slow),
        cctp.slowFinalityThreshold,
      );
    });
  });

  describe("fee math", () => {
    it("adds forwardFee.med and protocol fee into totalBurn", () => {
      const amount = 10_000_000n; // 10 USDC
      const fees = cctp.computeBurnFees(amount, {
        finalityThreshold: 1000,
        minimumFee: 1,
        forwardFee: { low: "1000", med: "8000", high: "12000" },
      });
      // protocolFee = amount * round(1 * 100) / 1_000_000 = 10_000_000 * 100 / 1e6 = 1000
      assert.equal(fees.forwardFee, 8000n);
      assert.equal(fees.protocolFee, 1000n);
      assert.equal(fees.maxFee, 9000n);
      assert.equal(fees.totalBurn, 10_009_000n);
    });

    it("uses zero protocol fee when minimumFee is 0", () => {
      const fees = cctp.computeBurnFees(5_000_000n, {
        finalityThreshold: 2000,
        minimumFee: 0,
        forwardFee: { low: "0", med: "2500", high: "4000" },
      });
      assert.equal(fees.protocolFee, 0n);
      assert.equal(fees.maxFee, 2500n);
      assert.equal(fees.totalBurn, 5_002_500n);
    });
  });

  describe("encoding", () => {
    it("encodes depositForBurnWithHook with padded recipient and cctp-forward hook", () => {
      const data = cctp.encodeDepositForBurnWithHook({
        totalBurn: 10_008_000n,
        destDomain: ECircleDomainId.Arc,
        mintRecipient: owner,
        burnToken: usdc,
        maxFee: 8000n,
        minFinalityThreshold: 1000,
      });
      const decoded = decodeFunctionData({
        abi: tokenMessengerV2Abi,
        data,
      });
      assert.equal(decoded.functionName, "depositForBurnWithHook");
      assert.deepEqual(decoded.args, [
        10_008_000n,
        ECircleDomainId.Arc,
        pad(owner, { size: 32 }),
        usdc,
        padHex("0x", { size: 32 }),
        8000n,
        1000,
        cctp.forwardHookData,
      ]);
      assert.equal(
        cctp.forwardHookData,
        "0x636374702d666f72776172640000000000000000000000000000000000000000",
      );
    });

    it("skips the approve work item when allowance covers totalBurn", () => {
      const approveData = cctp.encodeUsdcApprove(messenger, 100n);
      const burnData = cctp.encodeDepositForBurnWithHook({
        totalBurn: 100n,
        destDomain: ECircleDomainId.Base,
        mintRecipient: owner,
        burnToken: usdc,
        maxFee: 1n,
        minFinalityThreshold: 1000,
      });
      assert.equal(cctp.shouldSkipUsdcApprove(100n, 100n), true);
      const skipped = cctp.buildRelayerWork({
        allowance: 100n,
        totalBurn: 100n,
        usdcAddress: usdc,
        tokenMessenger: messenger,
        approveData,
        burnData,
      });
      assert.equal(skipped.length, 1);
      assert.equal(skipped[0]?.to, messenger);

      const needed = cctp.buildRelayerWork({
        allowance: 99n,
        totalBurn: 100n,
        usdcAddress: usdc,
        tokenMessenger: messenger,
        approveData,
        burnData,
      });
      assert.equal(needed.length, 2);
      assert.equal(needed[0]?.to, usdc);
      const approveDecoded = decodeFunctionData({
        abi: erc20Abi,
        data: needed[0]?.data ?? "0x",
      });
      assert.equal(approveDecoded.functionName, "approve");
    });
  });

  describe("destinations", () => {
    const base = chain(EChain.Base, EChainNetworkType.Mainnet, true);
    const ethereum = chain(EChain.Ethereum, EChainNetworkType.Mainnet, true);
    const sepolia = chain(EChain.Sepolia, EChainNetworkType.Testnet, true);
    const bsc = chain(EChain.Bsc, EChainNetworkType.Mainnet, false);
    const arcMainnet = chain(EChain.Arc, EChainNetworkType.Mainnet, false, false);

    it("allows a same-network CCTP destination other than source", () => {
      assert.equal(cctp.isValidDestination(base, ethereum), true);
    });

    it("rejects the source chain, other networks, and non-CCTP dests", () => {
      assert.equal(cctp.isValidDestination(base, base), false);
      assert.equal(cctp.isValidDestination(base, sepolia), false);
      assert.equal(cctp.isValidDestination(base, bsc), false);
      assert.equal(cctp.isValidDestination(base, arcMainnet), false);
    });

    it("filters the catalog to valid destinations", () => {
      const dests = cctp.listDestinations(
        [base, ethereum, sepolia, bsc, arcMainnet],
        base,
      );
      assert.deepEqual(
        dests.map((entry) => String(entry.chainId)),
        [String(EChain.Ethereum)],
      );
    });
  });

  describe("contracts", () => {
    it("returns shared mainnet TokenMessengerV2 for Base", () => {
      const contracts = cctp.getContracts(
        ECircleDomainId.Base,
        EChainNetworkType.Mainnet,
      );
      assert.equal(
        String(contracts.tokenMessengerV2).toLowerCase(),
        "0x28b5a0e9c621a5badaa536219b3a228c8168cf5d",
      );
    });
  });
});
