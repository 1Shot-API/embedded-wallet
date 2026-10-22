import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EVMAccountAddress, EVMChainId, type IExecutionPermissionRequest } from "@1shotapi/ows-types";

import { isPermissionGrantItemValid } from "@/components/modals/permissionGrantTerms/index.tsx";
import { CHAINLINK_PRICE_RULE } from "@/lib/implementations/business/utils/ChainlinkPriceRuleUtils.ts";
import {
  ERC20_TOKEN_PERIODIC,
  FUNCTION_CALL,
  LIFI_SWAP_PERIODIC,
} from "@/lib/interfaces/business/IDelegationService.ts";

const token = "0x" + "a".repeat(40);
const diamond = "0x" + "b".repeat(40);
const signer = EVMAccountAddress("0x" + "c".repeat(40) as `0x${string}`);
const outputAssetId = "0x" + "1".repeat(64);
const outputRecipient = "0x" + "2".repeat(64);

const badChainlink = {
  type: CHAINLINK_PRICE_RULE,
  data: {
    priceFeed: "0x" + "1".repeat(40),
    ruleKind: 0,
    expectedDecimals: 8,
    windowSeconds: 86400,
    thresholdBps: 1000,
    maxStaleSeconds: 3600,
    minGapSeconds: 60,
    triggerPrice: "0",
  },
};

const goodChainlink = {
  type: CHAINLINK_PRICE_RULE,
  data: {
    priceFeed: "0x50FCDD99D6762D1C170DC6A9111db944AEE6D364",
    ruleKind: 0,
    expectedDecimals: 8,
    windowSeconds: 86400,
    thresholdBps: 1000,
    maxStaleSeconds: 3600,
    minGapSeconds: 60,
    triggerPrice: "0",
  },
};

function erc20PeriodicRequest(
  rules?: IExecutionPermissionRequest["rules"],
): IExecutionPermissionRequest {
  return {
    chainId: EVMChainId("0x2105"),
    to: signer,
    permission: {
      type: ERC20_TOKEN_PERIODIC,
      isAdjustmentAllowed: true,
      data: {
        tokenAddress: token,
        periodAmount: "0x989680",
        periodDuration: 86400,
      },
    },
    ...(rules ? { rules } : {}),
  };
}

function functionCallRequest(
  rules?: IExecutionPermissionRequest["rules"],
): IExecutionPermissionRequest {
  return {
    chainId: EVMChainId("0x2105"),
    to: signer,
    permission: {
      type: FUNCTION_CALL,
      isAdjustmentAllowed: true,
      data: {
        targets: [token],
        selectors: ["0xa9059cbb"],
      },
    },
    ...(rules ? { rules } : {}),
  };
}

function lifiSwapRequest(
  rules?: IExecutionPermissionRequest["rules"],
): IExecutionPermissionRequest {
  return {
    chainId: EVMChainId("0x2105"),
    to: signer,
    permission: {
      type: LIFI_SWAP_PERIODIC,
      isAdjustmentAllowed: true,
      data: {
        lifiDiamond: diamond,
        tokenAddress: token,
        outputAssetId,
        outputRecipient,
        destinationChainId: "8453",
        quoteSigner: signer,
        periodAmount: "0x989680",
        periodDuration: 86400,
        slippageBps: 50,
      },
    },
    ...(rules ? { rules } : {}),
  };
}

describe("isPermissionGrantItemValid host rules", () => {
  it("rejects bad chainlink-price-rule for erc20-token-periodic", () => {
    assert.equal(
      isPermissionGrantItemValid(
        "grantExecutionPermission",
        erc20PeriodicRequest([badChainlink]),
        50,
      ),
      false,
    );
  });

  it("accepts good chainlink-price-rule for erc20-token-periodic", () => {
    assert.equal(
      isPermissionGrantItemValid(
        "grantExecutionPermission",
        erc20PeriodicRequest([goodChainlink]),
        50,
      ),
      true,
    );
  });

  it("rejects bad chainlink-price-rule for function-call", () => {
    assert.equal(
      isPermissionGrantItemValid(
        "grantFunctionCallPermission",
        functionCallRequest([badChainlink]),
        50,
      ),
      false,
    );
  });

  it("accepts good chainlink-price-rule for function-call", () => {
    assert.equal(
      isPermissionGrantItemValid(
        "grantFunctionCallPermission",
        functionCallRequest([goodChainlink]),
        50,
      ),
      true,
    );
  });

  it("rejects bad chainlink-price-rule for lifi-swap-periodic", () => {
    assert.equal(
      isPermissionGrantItemValid(
        "grantLiFiSwapPermission",
        lifiSwapRequest([badChainlink]),
        50,
      ),
      false,
    );
  });

  it("accepts good chainlink-price-rule for lifi-swap-periodic", () => {
    assert.equal(
      isPermissionGrantItemValid(
        "grantLiFiSwapPermission",
        lifiSwapRequest([goodChainlink]),
        50,
      ),
      true,
    );
  });

  it("accepts scope-valid requests with no rules", () => {
    assert.equal(
      isPermissionGrantItemValid(
        "grantExecutionPermission",
        erc20PeriodicRequest(),
        50,
      ),
      true,
    );
    assert.equal(
      isPermissionGrantItemValid(
        "grantFunctionCallPermission",
        functionCallRequest(),
        50,
      ),
      true,
    );
  });
});
