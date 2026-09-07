import {
  addressFromSecp256k1PublicKey,
  type OWSSigner,
} from "@1shotapi/ows-signer-utils";
import {
  BITCOIN_MAINNET_CHAIN_ID,
  BITCOIN_TESTNET_CHAIN_ID,
  SECP256K1PublicKey,
} from "@1shotapi/ows-types";
import {
  loadCachedSecp256k1PublicKey,
  saveCachedAddresses,
} from "../storage";
import { useWalletSessionStore } from "./sessionStore";

/**
 * Fill missing Bitcoin session addresses from the Signing Layer cache or
 * localStorage secp256k1 pubkey — no WebAuthn ceremony.
 *
 * @returns true when addresses were written
 */
export function hydrateBitcoinAddressesFromCachedSecp(
  signer?: OWSSigner | null,
): boolean {
  const session = useWalletSessionStore.getState();
  if (session.bitcoinMainnetAddress && session.bitcoinTestnetAddress) {
    return false;
  }

  const rawPk =
    signer?.getLastPublicKeyData()?.secp256k1PublicKey ??
    loadCachedSecp256k1PublicKey();
  if (!rawPk) {
    return false;
  }

  const pk = SECP256K1PublicKey(rawPk);
  const mainnet =
    session.bitcoinMainnetAddress ??
    addressFromSecp256k1PublicKey(pk, BITCOIN_MAINNET_CHAIN_ID);
  const testnet =
    session.bitcoinTestnetAddress ??
    addressFromSecp256k1PublicKey(pk, BITCOIN_TESTNET_CHAIN_ID);

  signer?.setCachedBitcoinSegwitAddress(BITCOIN_MAINNET_CHAIN_ID, mainnet);
  signer?.setCachedBitcoinSegwitAddress(BITCOIN_TESTNET_CHAIN_ID, testnet);

  session.setAddresses(session.evmAddress, session.solanaAddress, mainnet, testnet);
  saveCachedAddresses(
    session.evmAddress,
    session.solanaAddress,
    mainnet,
    testnet,
  );
  return true;
}
