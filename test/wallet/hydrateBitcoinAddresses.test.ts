import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import {
  BITCOIN_MAINNET_CHAIN_ID,
  BITCOIN_TESTNET_CHAIN_ID,
  BitcoinSegwitAccountAddress,
  SECP256K1PublicKey,
  type BitcoinChainId,
  type BitcoinSegwitAccountAddress as BitcoinAddress,
} from "@1shotapi/ows-types";
import { secp256k1 } from "@noble/curves/secp256k1";

import {
  cachedSecp256k1PublicKey,
  hydrateBitcoinAddressesFromCachedSecp,
} from "@/wallet/hydrateBitcoinAddresses.ts";
import { useWalletSessionStore } from "@/wallet/sessionStore.ts";

function uncompressedPublicKey(): SECP256K1PublicKey {
  const bytes = secp256k1.getPublicKey(secp256k1.utils.randomPrivateKey(), false);
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return SECP256K1PublicKey(`0x${hex}`);
}

function signerWithEmptyBitcoinSlots(publicKey: SECP256K1PublicKey) {
  const slots = new Map<BitcoinChainId, BitcoinAddress>();
  let getPublicKeyCalls = 0;
  const signer = {
    getLastPublicKeyData: () => ({ secp256k1PublicKey: publicKey }),
    getCachedBitcoinSegwitAddress: (chainId: BitcoinChainId) => slots.get(chainId),
    setCachedBitcoinSegwitAddress: (chainId: BitcoinChainId, address: BitcoinAddress) => {
      slots.set(chainId, address);
    },
    getPublicKey: async () => {
      getPublicKeyCalls += 1;
      throw new Error("getPublicKey should not run");
    },
  };
  return {
    signer: signer as unknown as OWSSigner,
    slots,
    getPublicKeyCalls: () => getPublicKeyCalls,
  };
}

describe("cached secp256k1 Bitcoin key", () => {
  it("fills both signer address slots without getPublicKey", () => {
    const publicKey = uncompressedPublicKey();
    const { signer, slots, getPublicKeyCalls } = signerWithEmptyBitcoinSlots(publicKey);
    const key = cachedSecp256k1PublicKey(signer);
    assert.equal(key, publicKey);
    assert.equal(getPublicKeyCalls(), 0);
    assert.equal(slots.get(BITCOIN_MAINNET_CHAIN_ID)?.startsWith("bc1q"), true);
    assert.equal(slots.get(BITCOIN_TESTNET_CHAIN_ID)?.startsWith("tb1q"), true);
  });

  it("primes the signer when the session already has both addresses", () => {
    const session = useWalletSessionStore.getState();
    const previousMainnet = session.bitcoinMainnetAddress;
    const previousTestnet = session.bitcoinTestnetAddress;
    const publicKey = uncompressedPublicKey();
    const { signer, slots, getPublicKeyCalls } = signerWithEmptyBitcoinSlots(publicKey);
    session.setBitcoinAddress(
      BITCOIN_MAINNET_CHAIN_ID,
      BitcoinSegwitAccountAddress("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"),
    );
    session.setBitcoinAddress(
      BITCOIN_TESTNET_CHAIN_ID,
      BitcoinSegwitAccountAddress("tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"),
    );
    try {
      assert.equal(hydrateBitcoinAddressesFromCachedSecp(signer), false);
      assert.equal(getPublicKeyCalls(), 0);
      assert.equal(slots.get(BITCOIN_MAINNET_CHAIN_ID)?.startsWith("bc1q"), true);
      assert.equal(slots.get(BITCOIN_TESTNET_CHAIN_ID)?.startsWith("tb1q"), true);
    } finally {
      session.setAddresses(
        session.evmAddress,
        session.solanaAddress,
        previousMainnet,
        previousTestnet,
      );
    }
  });
});
