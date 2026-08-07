import {
  Base64UrlEncodedString,
  CredentialId,
  type HexString,
} from "@1shotapi/ows-types";
import { ChallengeId } from "../primitives";

/** Relayer HTTP body — SimpleWebAuthn-style base64url assertion fields. */
export interface IWebAuthnAssertionRequest {
  challengeId: ChallengeId;
  credentialId: CredentialId;
  authenticatorData: Base64UrlEncodedString;
  clientDataJSON: Base64UrlEncodedString;
  signature: Base64UrlEncodedString;
}

/** Decoded challenge for Signing Layer / branding use (not wire base64url). */
export interface IWalletCredentialChallengeResponse {
  challengeId: ChallengeId;
  challenge: HexString;
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
