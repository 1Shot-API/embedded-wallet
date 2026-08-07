import type {
  COSEPublicKey,
  CredentialId,
  WebAuthnAssertionFields,
} from "@1shotapi/ows-types";
import type {
  IRecoveredCredentialBlob,
  IWalletCredentialChallengeResponse,
  IWebAuthnAssertionRequest,
} from "../../types/domain/RelayerCredentials";
import type { ChallengeId } from "../../types/primitives/ChallengeId";

/**
 * REST client + one-shot WebAuthn assertion cache for 1Shot Relayer
 * wallet credential endpoints. Assertions are obtained via the Signing
 * Layer ({@link IOWSProvider}), not Branding-native WebAuthn.
 */
export interface IRelayerCredentialsClient {
  getChallenge(): Promise<IWalletCredentialChallengeResponse>;

  /**
   * Cache a one-shot assertion from {@link WebAuthnAssertionFields}
   * (re-encoded to base64url for the relayer HTTP API).
   */
  setAssertion(
    challengeId: ChallengeId,
    assertion: WebAuthnAssertionFields,
  ): void;

  /**
   * Return and clear a cached assertion, or `null` if none is set.
   * Prefer {@link assert} for callers that need a usable assertion.
   */
  takeAssertion(): IWebAuthnAssertionRequest | null;

  /**
   * Consume a cached assertion when present; otherwise mint a relayer
   * challenge and complete a Signing Layer ceremony for that challenge.
   */
  assert(credentialId: CredentialId): Promise<IWebAuthnAssertionRequest>;

  registerPasskey(
    body: IWebAuthnAssertionRequest & { publicKey: COSEPublicKey },
  ): Promise<{ credentialId: string }>;

  storeCredential(
    body: IWebAuthnAssertionRequest & { ciphertext: string },
  ): Promise<{ id: string }>;

  recoverCredentials(
    body: IWebAuthnAssertionRequest,
  ): Promise<{ credentials: IRecoveredCredentialBlob[] }>;

  deleteCredentials(
    body: IWebAuthnAssertionRequest & {
      credentialBlobId?: string;
      deleteAll?: boolean;
    },
  ): Promise<{ deleted: number }>;
}

export const IRelayerCredentialsClientType = Symbol.for(
  "IRelayerCredentialsClient",
);
