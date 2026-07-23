/** Why the wallet is requesting a WebAuthn / passkey ceremony. */
export enum EPasskeyPromptReason {
  Unlock = "unlock",
  Create = "create",
  Sign = "sign",
  Encrypt = "encrypt",
  Decrypt = "decrypt",
  RelayerAuth = "relayerAuth",
  Backup = "backup",
  /** EIP-7702 wallet upgrade authorization (informational overlay during ceremony). */
  WalletUpgrade = "walletUpgrade",
}
