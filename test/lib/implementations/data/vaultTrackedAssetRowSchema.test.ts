import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { vaultTrackedAssetRowSchema } from "@/lib/implementations/data/CachedRelayerVaultRepository.ts";
import { EAssetType } from "@/lib/types/enum/EAssetType.ts";

/** Rows exactly as the relayer `trackedAssets` blob returns them. */
const LINK_ROW = {
  chainId: "0x13b2",
  address: "0x76a443768A5e3B8d1AED0105FC250877841Deb40",
  type: "erc20",
  name: "ChainLink Token",
  symbol: "LINK",
  decimals: 18,
  id: "0x13b2:0x76a443768a5e3b8d1aed0105fc250877841deb40",
};

const DEVNET_USDC_ROW = {
  chainId: "solana:devnet",
  address: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  type: "spl",
  name: "USD Coin",
  symbol: "USDC",
  decimals: 6,
  id: "solana:devnet:4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  iconUrl: "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'/%3e",
  ataAddress: "96KATXNg9E2ZqoWccVyZdfMwWuDPVkjYfyJs6H4Pm5F6",
  ataRentPaid: true,
};

describe("vaultTrackedAssetRowSchema", () => {
  it("accepts an EVM row", () => {
    const parsed = vaultTrackedAssetRowSchema.parse(LINK_ROW);
    assert.equal(parsed.chainId, "0x13b2");
    assert.equal(parsed.type, EAssetType.Erc20);
    assert.equal(parsed.symbol, "LINK");
  });

  it("accepts a Solana SPL row and keeps the ATA fields", () => {
    const parsed = vaultTrackedAssetRowSchema.parse(DEVNET_USDC_ROW);
    assert.equal(parsed.chainId, "solana:devnet");
    assert.equal(parsed.address, DEVNET_USDC_ROW.address);
    assert.equal(parsed.type, EAssetType.Spl);
    assert.equal(parsed.iconUrl, DEVNET_USDC_ROW.iconUrl);
    assert.ok("ataAddress" in parsed);
    assert.equal(parsed.ataAddress, DEVNET_USDC_ROW.ataAddress);
    assert.equal(parsed.ataRentPaid, true);
  });

  it("accepts mainnet SPL rows without ATA fields", () => {
    const parsed = vaultTrackedAssetRowSchema.parse({
      ...DEVNET_USDC_ROW,
      chainId: "solana:mainnet",
      address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      id: "solana:mainnet:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      iconUrl: undefined,
      ataAddress: undefined,
      ataRentPaid: undefined,
    });
    assert.equal(parsed.chainId, "solana:mainnet");
    assert.equal(parsed.iconUrl, undefined);
  });

  it("rejects rows that belong to neither chain family", () => {
    for (const row of [
      { ...LINK_ROW, address: "not-an-address" },
      {
        ...DEVNET_USDC_ROW,
        address: "0x76a443768A5e3B8d1AED0105FC250877841Deb40",
      },
      { ...DEVNET_USDC_ROW, chainId: "solana:localnet" },
      { ...LINK_ROW, chainId: "solana:devnet" },
    ]) {
      assert.equal(
        vaultTrackedAssetRowSchema.safeParse(row).success,
        false,
        JSON.stringify(row),
      );
    }
  });
});
