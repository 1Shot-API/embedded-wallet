import type { WebAuthnAssertionFields } from "@1shotapi/ows-types";
import type { IWalletCredentialChallengeResponse } from "../../types/domain/RelayerCredentials";
import type { ChallengeId } from "../../types/primitives/ChallengeId";

export type IPendingEncryptedBlob = {
  id: string;
  payload: string;
  createdTimestamp: number;
};

/**
 * Pending encrypted vault decrypt + opportunistic ceremony hooks.
 * Implemented by {@link CachedRelayerVaultRepository}.
 */
export interface IVaultPendingDecrypt {
  /**
   * Load the local vault cache so {@link peekPendingEncrypted} /
   * {@link hasPendingEncrypted} are authoritative (IndexedDB is async).
   */
  ensurePendingStateLoaded(): Promise<void>;
  hasPendingEncrypted(): boolean;
  peekPendingEncrypted(): IPendingEncryptedBlob[];
  /**
   * Apply plaintexts from a Signing Layer decrypt / executeBatch and clear
   * the matching pending rows.
   */
  applyDecryptedPayloads(plaintexts: string[], ids: string[]): Promise<void>;
  /** Force a decrypt ceremony when pending encrypted blobs exist. */
  ensureDecrypted(): Promise<void>;
  /**
   * When true, the next signing ceremony should mint a relayer challenge so
   * an assertion can upload queued unencrypted tracked-assets.
   */
  hasPendingTrackedAssetsUpload(): boolean;
  /**
   * Upload queued tracked-assets under an existing assertion (same ceremony).
   */
  flushTrackedAssetsUpload(
    challengeId: ChallengeId,
    assertion: WebAuthnAssertionFields,
  ): Promise<void>;
  mintRelayerVaultChallenge(): Promise<IWalletCredentialChallengeResponse>;
  cacheRelayerVaultAssertion(
    challengeId: ChallengeId,
    assertion: WebAuthnAssertionFields,
  ): void;
}

export const IVaultPendingDecryptType = Symbol.for("IVaultPendingDecrypt");
