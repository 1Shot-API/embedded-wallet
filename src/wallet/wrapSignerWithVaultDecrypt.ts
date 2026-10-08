import {
  AES256CipherTextEnvelope,
  type DigestSignedData,
  type ExecuteBatchParams,
  type ExecuteBatchResult,
  type HexString,
} from "@1shotapi/ows-types";
import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import type { IVaultPendingDecrypt } from "../lib/interfaces/data/IVaultPendingDecrypt";
import type { ChallengeId } from "../lib/types/primitives/ChallengeId";

/**
 * Upgrade signDigest / executeBatch to also decrypt pending vault ciphertexts
 * (and optionally assert for tracked-assets upload) in the same ceremony.
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
    if (pending.length === 0 && !needUpload) {
      return signDigest(digests, options);
    }

    let challenge: HexString | undefined;
    let challengeId: ChallengeId | null = null;
    if (needUpload) {
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
    if (pending.length === 0 && !needUpload) {
      return executeBatch(params);
    }

    let challenge = params.challenge;
    let challengeId: ChallengeId | null = null;
    if (needUpload && !challenge) {
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

    if (batchResult.assertion) {
      if (needUpload && challengeId) {
        await vault.flushTrackedAssetsUpload(challengeId, batchResult.assertion);
      } else if (challengeId) {
        vault.cacheRelayerVaultAssertion(challengeId, batchResult.assertion);
      }
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
    if (vault.hasPendingTrackedAssetsUpload()) {
      await vault.flushTrackedAssetsUpload(challengeId, batchResult.assertion);
    } else {
      vault.cacheRelayerVaultAssertion(challengeId, batchResult.assertion);
    }
  }
}
