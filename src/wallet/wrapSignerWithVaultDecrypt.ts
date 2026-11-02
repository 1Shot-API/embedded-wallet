import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import {
  AES256CipherTextEnvelope,
  type DigestSignedData,
  type ExecuteBatchParams,
  type ExecuteBatchResult,
  type HexString,
} from "@1shotapi/ows-types";

import type { IVaultPendingDecrypt } from "../lib/interfaces/data/IVaultPendingDecrypt";
import type { ChallengeId } from "../lib/types/primitives/ChallengeId";

/**
 * Upgrade signDigest / executeBatch to also decrypt pending vault ciphertexts
 * and/or mint RelayerAuth (tracked-assets upload or prefetch cache) in the
 * same ceremony. Tracked-assets blobs are unencrypted — prefetch only needs
 * an assertion for a later store HTTP call.
 */
export function wrapSignerWithVaultDecrypt(
  signer: OWSSigner,
  vault: IVaultPendingDecrypt,
): OWSSigner {
  const signDigest = signer.signDigest.bind(signer);
  const executeBatch = signer.executeBatch.bind(signer);

  signer.signDigest = (async (digests, options) => {
    await vault.ensurePendingStateLoaded();
    const pending = vault.peekPendingEncrypted();
    const needUpload = vault.hasPendingTrackedAssetsUpload();
    const needPrefetch = vault.hasRelayerAuthPrefetch();
    if (pending.length === 0 && !needUpload && !needPrefetch) {
      return signDigest(digests, options);
    }

    let challenge: HexString | undefined;
    let challengeId: ChallengeId | null = null;
    if (needUpload || needPrefetch) {
      const minted = await vault.mintRelayerVaultChallenge();
      challengeId = minted.challengeId;
      challenge = minted.challenge;
    }

    const batchResult = await executeBatch({
      digests: digests as ExecuteBatchParams["digests"],
      ...(pending.length > 0
        ? {
            ciphertexts: pending.map((p) =>
              String(AES256CipherTextEnvelope(p.payload)),
            ),
          }
        : {}),
      ...(challenge ? { challenge: challenge as `0x${string}` } : {}),
      explanationHeader: options?.explanationHeader,
      explanationText: options?.explanationText,
      confirmButtonText: options?.confirmButtonText,
      denyButtonText: options?.denyButtonText,
      ...(options?.credentialId
        ? { credentialId: options.credentialId as ExecuteBatchParams["credentialId"] }
        : {}),
    } as ExecuteBatchParams);

    await applyBatchSideEffects(vault, pending, batchResult, challengeId);
    return (batchResult.results ?? []) as DigestSignedData[];
  }) as OWSSigner["signDigest"];

  signer.executeBatch = (async (params: ExecuteBatchParams) => {
    await vault.ensurePendingStateLoaded();
    const pending = vault.peekPendingEncrypted();
    const needUpload = vault.hasPendingTrackedAssetsUpload();
    const needPrefetch = vault.hasRelayerAuthPrefetch();
    if (pending.length === 0 && !needUpload && !needPrefetch) {
      return executeBatch(params);
    }

    let challenge = params.challenge;
    let challengeId: ChallengeId | null = null;
    if ((needUpload || needPrefetch) && !challenge) {
      const minted = await vault.mintRelayerVaultChallenge();
      challengeId = minted.challengeId;
      challenge = minted.challenge;
    }

    const existingCiphertexts = (params.ciphertexts ?? []).map(String);
    const pendingCiphertexts = pending.map((p) =>
      String(AES256CipherTextEnvelope(p.payload)),
    );
    const batchResult = await executeBatch({
      ...params,
      ...(challenge ? { challenge } : {}),
      ...(pendingCiphertexts.length > 0 || existingCiphertexts.length > 0
        ? {
            ciphertexts: [...existingCiphertexts, ...pendingCiphertexts],
          }
        : {}),
    });

    if (pending.length > 0 && batchResult.plaintexts) {
      const offset = existingCiphertexts.length;
      const pendingPlaintexts = batchResult.plaintexts.slice(
        offset,
        offset + pending.length,
      );
      await vault.applyDecryptedPayloads(
        pendingPlaintexts,
        pending.map((p) => p.id),
      );
    }

    if (batchResult.assertion && challengeId) {
      await settleRelayerAssertion(vault, challengeId, batchResult.assertion);
    } else {
      vault.clearRelayerAuthPrefetch();
    }

    return batchResult;
  }) as OWSSigner["executeBatch"];

  return signer;
}

async function applyBatchSideEffects(
  vault: IVaultPendingDecrypt,
  pending: ReturnType<IVaultPendingDecrypt["peekPendingEncrypted"]>,
  batchResult: ExecuteBatchResult,
  challengeId: ChallengeId | null,
): Promise<void> {
  if (pending.length > 0 && batchResult.plaintexts) {
    await vault.applyDecryptedPayloads(
      batchResult.plaintexts,
      pending.map((p) => p.id),
    );
  }
  if (batchResult.assertion && challengeId) {
    await settleRelayerAssertion(vault, challengeId, batchResult.assertion);
  } else {
    vault.clearRelayerAuthPrefetch();
  }
}

async function settleRelayerAssertion(
  vault: IVaultPendingDecrypt,
  challengeId: ChallengeId,
  assertion: NonNullable<ExecuteBatchResult["assertion"]>,
): Promise<void> {
  if (vault.hasPendingTrackedAssetsUpload()) {
    await vault.flushTrackedAssetsUpload(challengeId, assertion);
  } else {
    vault.cacheRelayerVaultAssertion(challengeId, assertion);
  }
  vault.clearRelayerAuthPrefetch();
}
