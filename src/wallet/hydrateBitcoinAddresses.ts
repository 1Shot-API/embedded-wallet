import {
  addressFromSecp256k1PublicKey,
  type OWSSigner,
} from "@1shotapi/ows-signer-utils";
import {
  BITCOIN_MAINNET_CHAIN_ID,
  BITCOIN_TESTNET_CHAIN_ID,
  SECP256K1PublicKey,
  type BitcoinChainId,
  type BitcoinSegwitAccountAddress,
} from "@1shotapi/ows-types";

import { sameBitcoinAddress } from "../lib/implementations/utils/bitcoinHostSigning";
import {
  loadCachedSecp256k1PublicKey,
  saveCachedAddresses,
  saveCachedBitcoinAddress,
  saveCachedSecp256k1PublicKey,
} from "../storage";

import { useWalletSessionStore } from "./sessionStore";

/**
 * Secp256k1 key already derived this session or stored for this browser.
 * When a signer is passed, fill any empty Bitcoin address slot from that key.
 * Does not call `getPublicKey`.
 */
export function cachedSecp256k1PublicKey(
  signer?: OWSSigner | null,
): SECP256K1PublicKey | undefined {
  const rawPk =
    signer?.getLastPublicKeyData()?.secp256k1PublicKey ??
    loadCachedSecp256k1PublicKey();
  if (!rawPk) return undefined;
  const pk = SECP256K1PublicKey(rawPk);
  if (signer) {
    if (!signer.getCachedBitcoinSegwitAddress(BITCOIN_MAINNET_CHAIN_ID)) {
      signer.setCachedBitcoinSegwitAddress(
        BITCOIN_MAINNET_CHAIN_ID,
        addressFromSecp256k1PublicKey(pk, BITCOIN_MAINNET_CHAIN_ID),
      );
    }
    if (!signer.getCachedBitcoinSegwitAddress(BITCOIN_TESTNET_CHAIN_ID)) {
      signer.setCachedBitcoinSegwitAddress(
        BITCOIN_TESTNET_CHAIN_ID,
        addressFromSecp256k1PublicKey(pk, BITCOIN_TESTNET_CHAIN_ID),
      );
    }
  }
  return pk;
}

/**
 * Fill missing Bitcoin session addresses from the Signing Layer cache or
 * localStorage secp256k1 pubkey — no WebAuthn ceremony.
 *
 * Also primes the signer address slots when the session already has both
 * networks, so a later signature does not call `getPublicKey`.
 *
 * @returns true when session addresses were written
 */
export function hydrateBitcoinAddressesFromCachedSecp(
  signer?: OWSSigner | null,
): boolean {
  const pk = cachedSecp256k1PublicKey(signer);
  const session = useWalletSessionStore.getState();
  if (session.bitcoinMainnetAddress && session.bitcoinTestnetAddress) {
    return false;
  }
  if (!pk) return false;

  const mainnet =
    session.bitcoinMainnetAddress ??
    addressFromSecp256k1PublicKey(pk, BITCOIN_MAINNET_CHAIN_ID);
  const testnet =
    session.bitcoinTestnetAddress ??
    addressFromSecp256k1PublicKey(pk, BITCOIN_TESTNET_CHAIN_ID);

  session.setAddresses(session.evmAddress, session.solanaAddress, mainnet, testnet);
  saveCachedAddresses(
    session.evmAddress,
    session.solanaAddress,
    mainnet,
    testnet,
  );
  return true;
}

function derivedBitcoinAddress(
  publicKey: SECP256K1PublicKey,
  chainId: BitcoinChainId,
): BitcoinSegwitAccountAddress {
  return addressFromSecp256k1PublicKey(publicKey, chainId);
}

/** Replace both signer slots and the stored addresses with this key. */
export function adoptSecp256k1PublicKey(
  signer: OWSSigner,
  publicKey: SECP256K1PublicKey,
): { mainnet: BitcoinSegwitAccountAddress; testnet: BitcoinSegwitAccountAddress } {
  const mainnet = derivedBitcoinAddress(publicKey, BITCOIN_MAINNET_CHAIN_ID);
  const testnet = derivedBitcoinAddress(publicKey, BITCOIN_TESTNET_CHAIN_ID);
  signer.setCachedBitcoinSegwitAddress(BITCOIN_MAINNET_CHAIN_ID, mainnet);
  signer.setCachedBitcoinSegwitAddress(BITCOIN_TESTNET_CHAIN_ID, testnet);
  const session = useWalletSessionStore.getState();
  session.setAddresses(session.evmAddress, session.solanaAddress, mainnet, testnet);
  saveCachedAddresses(session.evmAddress, session.solanaAddress, mainnet, testnet);
  const raw = (
    publicKey.startsWith("0x") ? publicKey : `0x${publicKey}`
  ) as `0x${string}`;
  saveCachedSecp256k1PublicKey(raw);
  return { mainnet, testnet };
}

/**
 * Cached key when it derives to `address`. A missing address accepts the key
 * and returns the derived one. A mismatch or a missing key calls `getPublicKey`
 * and overwrites the signer slots.
 */
export async function secpKeyForAddress(
  signer: OWSSigner,
  chainId: BitcoinChainId,
  address?: string,
): Promise<{ publicKey: SECP256K1PublicKey; address: BitcoinSegwitAccountAddress }> {
  const cached = cachedSecp256k1PublicKey(signer);
  if (cached) {
    const derived = derivedBitcoinAddress(cached, chainId);
    if (!address || sameBitcoinAddress(derived, address)) {
      if (!address) {
        useWalletSessionStore.getState().setBitcoinAddress(chainId, derived);
        saveCachedBitcoinAddress(chainId, derived);
      }
      return { publicKey: cached, address: derived };
    }
  }
  const publicKey = (await signer.getPublicKey()).secp256k1PublicKey;
  const adopted = adoptSecp256k1PublicKey(signer, publicKey);
  const fresh =
    chainId === BITCOIN_MAINNET_CHAIN_ID ? adopted.mainnet : adopted.testnet;
  return { publicKey, address: fresh };
}
