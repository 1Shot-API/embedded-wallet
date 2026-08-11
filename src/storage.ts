import {
  COSEPublicKey,
  CredentialId,
  EVMAccountAddress,
  SolanaAccountAddress,
} from "@1shotapi/ows-types";

const WALLET_CREATED_KEY = "ows-wallet-created";
/** Public WebAuthn credential handle (not a bearer token / JWT). */
const PASSKEY_HANDLE_KEY = "ows-passkey-handle";
/**
 * Authenticator COSE public key (base64url) from create-time attestation.
 * Needed to call `/wallet/passkeys/register` — not available on later assertions.
 */
const COSE_PUBLIC_KEY_KEY = "ows-passkey-cose-public-key";
const EVM_ADDRESS_KEY = "ows-evm-address";
const SOLANA_ADDRESS_KEY = "ows-solana-address";
/** Cached secp256k1 public key (0x-hex) so LocalAccount builds without Unlock. */
const SECP256K1_PUBLIC_KEY_KEY = "ows-secp256k1-public-key";
/** EIP-1193 eth_accounts was approved at least once (MetaMask-style reconnect). */
const ETH_ACCOUNTS_GRANTED_KEY = "ows-eth-accounts-granted";

export function isWalletCreated(): boolean {
  return localStorage.getItem(WALLET_CREATED_KEY) === "true";
}

export function loadCredentialId(): CredentialId | undefined {
  const handle = localStorage.getItem(PASSKEY_HANDLE_KEY);
  if (handle) return CredentialId(handle);
  // Migrate legacy key name (same public WebAuthn handle value).
  const legacy = localStorage.getItem("ows-credential-id");
  if (!legacy) return undefined;
  localStorage.setItem(PASSKEY_HANDLE_KEY, legacy);
  localStorage.removeItem("ows-credential-id");
  return CredentialId(legacy);
}

export function saveWalletCreated(passkeyHandle: CredentialId): void {
  localStorage.setItem(WALLET_CREATED_KEY, "true");
  localStorage.setItem(PASSKEY_HANDLE_KEY, passkeyHandle);
}

export function loadCosePublicKey(): COSEPublicKey | undefined {
  const value = localStorage.getItem(COSE_PUBLIC_KEY_KEY);
  if (!value) return undefined;
  return COSEPublicKey(value);
}

export function saveCosePublicKey(publicKey: COSEPublicKey): void {
  localStorage.setItem(COSE_PUBLIC_KEY_KEY, publicKey);
}

export function loadCachedEvmAddress(): EVMAccountAddress | undefined {
  const value = localStorage.getItem(EVM_ADDRESS_KEY);
  if (!value) {
    return undefined;
  }
  return EVMAccountAddress(value as `0x${string}`);
}

export function loadCachedSolanaAddress(): SolanaAccountAddress | undefined {
  const value = localStorage.getItem(SOLANA_ADDRESS_KEY);
  if (!value) {
    return undefined;
  }
  return SolanaAccountAddress(value);
}

export function saveCachedAddresses(
  evm: EVMAccountAddress,
  solana?: SolanaAccountAddress,
): void {
  localStorage.setItem(EVM_ADDRESS_KEY, evm);
  if (solana) {
    localStorage.setItem(SOLANA_ADDRESS_KEY, solana);
  }
}

export function loadAccountsPermissionGranted(): boolean {
  return localStorage.getItem(ETH_ACCOUNTS_GRANTED_KEY) === "1";
}

export function saveAccountsPermissionGranted(): void {
  localStorage.setItem(ETH_ACCOUNTS_GRANTED_KEY, "1");
}

export function loadCachedSecp256k1PublicKey(): `0x${string}` | undefined {
  const value = localStorage.getItem(SECP256K1_PUBLIC_KEY_KEY);
  if (!value || !value.startsWith("0x")) {
    return undefined;
  }
  return value as `0x${string}`;
}

export function saveCachedSecp256k1PublicKey(publicKey: `0x${string}`): void {
  localStorage.setItem(SECP256K1_PUBLIC_KEY_KEY, publicKey);
}

export function clearWalletStorage(): void {
  localStorage.removeItem(WALLET_CREATED_KEY);
  localStorage.removeItem(PASSKEY_HANDLE_KEY);
  localStorage.removeItem(COSE_PUBLIC_KEY_KEY);
  localStorage.removeItem(EVM_ADDRESS_KEY);
  localStorage.removeItem(SOLANA_ADDRESS_KEY);
  localStorage.removeItem(SECP256K1_PUBLIC_KEY_KEY);
  localStorage.removeItem(ETH_ACCOUNTS_GRANTED_KEY);
  // Legacy keys from earlier passkey-public-key caching (no longer used).
  localStorage.removeItem("ows-passkey-public-key");
  localStorage.removeItem("ows-relayer-passkey-registered");
  localStorage.removeItem("ows-credential-id");
  localStorage.removeItem("ows-wallet-backup");
  // Account-scoped caches — wipe so the next passkey starts clean.
  localStorage.removeItem("ows.credentials.v2");
  localStorage.removeItem("ows.tracked-assets.v2");
  localStorage.removeItem("ows.asset-activity.v1");
}
