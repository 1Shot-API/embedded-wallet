/** Shared WebAuthn assertion fields for relayer wallet-credential routes. */
export interface IWebAuthnAssertionRequest {
  challengeId: string;
  credentialId: string;
  authenticatorData: string;
  clientDataJSON: string;
  signature: string;
}

export interface IWalletCredentialChallengeResponse {
  challengeId: string;
  challenge: string;
}

export interface IRecoveredCredentialBlob {
  id: string;
  ciphertext: string;
  createdTimestamp: number;
}

export interface IRelayerCredentialsErrorBody {
  error: string;
  message: string;
}
