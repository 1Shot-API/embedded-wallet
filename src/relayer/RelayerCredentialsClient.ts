import { RELAYER_BASE_URL } from "./constants";
import type {
  IRecoveredCredentialBlob,
  IRelayerCredentialsErrorBody,
  IWalletCredentialChallengeResponse,
  IWebAuthnAssertionRequest,
} from "./types";

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

/**
 * Thin REST client for 1Shot Relayer wallet credential endpoints
 * (`/wallet/credentials/*`, `/wallet/passkeys/register`).
 */
export class RelayerCredentialsClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = RELAYER_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async createChallenge(): Promise<IWalletCredentialChallengeResponse> {
    return this.postJson<IWalletCredentialChallengeResponse>(
      "/wallet/credentials/challenge",
    );
  }

  async registerPasskey(
    body: IWebAuthnAssertionRequest & { publicKey: string },
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
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
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
