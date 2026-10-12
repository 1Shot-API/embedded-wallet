import {
  type Base64UrlEncodedString,
  type CredentialId,
  type HexString,
} from "@1shotapi/ows-types";

import type { ChallengeId } from "../primitives";

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
  /** Opaque payload (AES envelope or plaintext JSON). */
  payload: string;
  /** When false, `payload` is already plaintext JSON (e.g. trackedAssets). */
  encrypted: boolean;
  createdTimestamp: number;
}

export type ICredentialStoreItem = {
  payload: string;
  encrypted: boolean;
};

export interface IRelayerCredentialsErrorBody {
  error: string;
  message: string;
}
