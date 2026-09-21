import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LiFiUtils,
  LIFI_SWAP_ENFORCER_PROXY,
} from "@/lib/implementations/business/utils/LiFiUtils.ts";
import { EChain } from "@/lib/types/enum/EChain.ts";

describe("LiFiUtils.resolveSwapEnforcer", () => {
  const utils = new LiFiUtils();

  it("returns v3 proxy on Arc, Base, and Ethereum", () => {
    for (const chainId of [EChain.Arc, EChain.Base, EChain.Ethereum]) {
      assert.equal(utils.resolveSwapEnforcer(chainId), LIFI_SWAP_ENFORCER_PROXY);
    }
  });

  it("matches chain id case-insensitively", () => {
    assert.equal(
      utils.resolveSwapEnforcer("0x2105"),
      LIFI_SWAP_ENFORCER_PROXY,
    );
    assert.equal(
      utils.resolveSwapEnforcer("0X2105"),
      LIFI_SWAP_ENFORCER_PROXY,
    );
  });

  it("returns null for unsupported chains", () => {
    assert.equal(utils.resolveSwapEnforcer(EChain.Polygon), null);
    assert.equal(utils.resolveSwapEnforcer("0x89"), null);
  });
});

describe("LiFiUtils.encodeTerms", () => {
  const utils = new LiFiUtils();

  it("packs 284-byte terms", () => {
    const encoded = utils.encodeTerms({
      lifiDiamond: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
      inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      outputAssetId:
        "0x0000000000000000000000000000000000000000000000000000000000000002",
      outputRecipient:
        "0x0000000000000000000000000000000000000000000000000000000000000001",
      destinationChainId: 8453n,
      quoteSigner: "0x0000000000000000000000000000000000000001",
      periodAmount: 1_000_000n,
      periodDuration: 86_400n,
      startDate: 1_700_000_000n,
      slippageBps: 50n,
    });
    assert.equal((encoded.length - 2) / 2, 284);
  });
});
