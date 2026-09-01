import {
  Base64UrlEncodedString,
  ConversionUtils,
  type COSEPublicKey,
  type CredentialId,
  type WebAuthnAssertionFields,
} from "@1shotapi/ows-types";
import type { IRelayerCredentialsClient } from "../../../interfaces/data/IRelayerCredentialsClient";
import type { IConfigProvider } from "../../../interfaces/utils/IConfigProvider";
import type { IOWSProvider } from "../../../interfaces/utils/IOWSProvider";
import type {
  IRecoveredCredentialBlob,
  IRelayerCredentialsErrorBody,
  IWalletCredentialChallengeResponse,
  IWebAuthnAssertionRequest,
} from "../../../types/domain/RelayerCredentials";
import { ChallengeId } from "../../../types/primitives/ChallengeId";

export class RelayerCredentialsError extends Error {
  readonly status: number;
  readonly errorCode: string;

  constructor(status: number, errorCode: string, message: string) {
    super(message);
    this.name = "RelayerCredentialsError";
    this.status = status;
    this.errorCode = errorCode;
  }
}

export type IRelayerCredentialsClientDeps = {
  configProvider: IConfigProvider;
  owsProvider: IOWSProvider;
};

type IWireChallengeResponse = {
  challengeId: string;
  challenge: string;
};

/**
 * Thin REST client for 1Shot Relayer wallet credential endpoints
 * (`/wallet/credentials/*`, `/wallet/passkeys/register`).
 *
 * Holds a one-shot cached assertion so unlock can piggyback a relayer
 * challenge onto `getPublicKey` and vault recover can reuse it.
 * Wire base64url stays inside this repository; callers see HexString.
 */
export class RelayerCredentialsClient implements IRelayerCredentialsClient {
  private cachedAssertion: IWebAuthnAssertionRequest | null = null;

  constructor(private readonly deps: IRelayerCredentialsClientDeps) {}

  async getChallenge(): Promise<IWalletCredentialChallengeResponse> {
    const wire = await this.postJson<IWireChallengeResponse>(
      "/wallet/credentials/challenge",
    );
    return {
      challengeId: ChallengeId(wire.challengeId),
      challenge: ConversionUtils.bytesToHex(
        ConversionUtils.base64UrlToBytes(
          Base64UrlEncodedString(wire.challenge),
        ),
      ),
    };
  }

  setAssertion(
    challengeId: ChallengeId,
    assertion: WebAuthnAssertionFields,
  ): void {
    this.cachedAssertion = toRelayerAssertionRequest(challengeId, assertion);
  }

  takeAssertion(): IWebAuthnAssertionRequest | null {
    const cached = this.cachedAssertion;
    this.cachedAssertion = null;
    return cached;
  }

  hasCachedAssertion(): boolean {
    return this.cachedAssertion !== null;
  }

  async assert(credentialId: CredentialId): Promise<IWebAuthnAssertionRequest> {
    const cached = this.takeAssertion();
    if (cached) {
      return cached;
    }

    const { challengeId, challenge } = await this.getChallenge();
    const signer = await this.deps.owsProvider.getSigner();
    const { assertion } = await signer.getPublicKey({
      credentialId,
      challenge,
    });
    return toRelayerAssertionRequest(challengeId, assertion);
  }

  async registerPasskey(
    body: IWebAuthnAssertionRequest & { publicKey: COSEPublicKey },
  ): Promise<{ credentialId: string }> {
    return this.postJson<{ credentialId: string }>(
      "/wallet/passkeys/register",
      body,
    );
  }

  async storeCredential(
    body: IWebAuthnAssertionRequest & { ciphertext: string },
  ): Promise<{ id: string }> {
    return this.postJson<{ id: string }>("/wallet/credentials", body);
  }

  async recoverCredentials(
    body: IWebAuthnAssertionRequest,
  ): Promise<{ credentials: IRecoveredCredentialBlob[] }> {
    return this.postJson<{ credentials: IRecoveredCredentialBlob[] }>(
      "/wallet/credentials/recover",
      body,
    );
  }

  async deleteCredentials(
    body: IWebAuthnAssertionRequest & {
      credentialBlobId?: string;
      deleteAll?: boolean;
    },
  ): Promise<{ deleted: number }> {
    return this.postJson<{ deleted: number }>(
      "/wallet/credentials/delete",
      body,
    );
  }

  private async postJson<T>(path: string, body?: unknown): Promise<T> {
    const { relayerBaseUrl } = await this.deps.configProvider.getConfig();
    const response = await fetch(`${relayerBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      let errorCode = "Error";
      let message = `Relayer request failed (${response.status})`;
      try {
        const payload = (await response.json()) as IRelayerCredentialsErrorBody;
        if (typeof payload.error === "string") errorCode = payload.error;
        if (typeof payload.message === "string") message = payload.message;
      } catch {
        // keep defaults
      }
      throw new RelayerCredentialsError(response.status, errorCode, message);
    }

    return (await response.json()) as T;
  }
}

/** Re-encode OWSSigner assertion values as SimpleWebAuthn base64url fields. */
export function toRelayerAssertionRequest(
  challengeId: ChallengeId,
  assertion: WebAuthnAssertionFields,
): IWebAuthnAssertionRequest {
  return {
    challengeId,
    credentialId: assertion.credentialId,
    authenticatorData: ConversionUtils.bytesToBase64Url(
      ConversionUtils.hexToBytes(assertion.authenticatorData),
    ),
    clientDataJSON: ConversionUtils.bytesToBase64Url(
      new TextEncoder().encode(assertion.clientDataJSON),
    ),
    signature: ConversionUtils.bytesToBase64Url(
      ConversionUtils.hexToBytes(assertion.signature),
    ),
  };
}
