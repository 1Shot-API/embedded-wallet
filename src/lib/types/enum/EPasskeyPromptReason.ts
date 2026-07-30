/** Why the wallet is requesting a WebAuthn / passkey ceremony. */
export enum EPasskeyPromptReason {
  Unlock = "unlock",
  Create = "create",
  Sign = "sign",
  Encrypt = "encrypt",
  Decrypt = "decrypt",
  RelayerAuth = "relayerAuth",
  Backup = "backup",
  ExportPrivateKey = "exportPrivateKey",
  /** EIP-7702 wallet upgrade authorization (informational overlay during ceremony). */
  WalletUpgrade = "walletUpgrade",
  /** Relayer send: authorize transaction (may include 7702 + fee/work digests). */
  ApproveTransaction = "approveTransaction",
  /** Relayer send: re-sign fee delegation after estimate adjusts the fee. */
  AdjustFee = "adjustFee",
}
