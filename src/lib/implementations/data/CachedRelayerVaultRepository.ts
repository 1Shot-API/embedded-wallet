import {
  AES256CipherTextEnvelope,
  ChainUtils,
  DomainString,
  EVMAccountAddress,
  EVMChainIdSchema,
  EVMContractAddress,
  EVMContractAddressSchema,
  HexString,
  UnixTimestamp,
  type COSEPublicKey,
  type CredentialFilter,
  type CredentialId,
  type CredentialSummary,
  type ICredentialRepository,
  type IExecutionPermissionResponse,
  type StoredCredential,
  type WebAuthnAssertionFields,
} from "@1shotapi/ows-types";
import { getAddress } from "viem";
import { z } from "zod";

import { loadCosePublicKey, loadCredentialId } from "../../../storage";
import { withCeremonyUiReason } from "../../../wallet/ceremonyUiOverrideStore";
import type { IDelegationRepository } from "../../interfaces/data/IDelegationRepository";
import type { IRelayerCredentialsClient } from "../../interfaces/data/IRelayerCredentialsClient";
import type {
  IPendingEncryptedBlob,
  IVaultPendingDecrypt,
} from "../../interfaces/data/IVaultPendingDecrypt";
import type {
  IVaultTrackedAssetRow,
  IVaultTrackedAssetSync,
} from "../../interfaces/data/IVaultTrackedAssetSync";
import type { IOWSProvider } from "../../interfaces/utils/IOWSProvider";
import type { IWalletCredentialChallengeResponse } from "../../types/domain/RelayerCredentials";
import type {
  IDelegationCaveat,
  IDelegationSummary,
  ISignedDelegation,
  IStoredDelegation,
} from "../../types/domain/StoredDelegation";
import { EAssetType } from "../../types/enum/EAssetType";
import { EPasskeyPromptReason } from "../../types/enum/EPasskeyPromptReason";
import type { ChallengeId } from "../../types/primitives/ChallengeId";
import {
  DelegationId,
  type DelegationId as DelegationIdType,
} from "../../types/primitives/DelegationId";
import {
  cloneVaultSnapshot,
  createIdbVaultStore,
  createMemoryVaultStore,
  emptyVaultSnapshot,
  type IVaultSnapshot,
  type IVaultStore,
} from "../../utils/idbVaultStore";

import {
  RelayerCredentialsError,
  toRelayerAssertionRequest,
} from "./utils/RelayerCredentialsClient";


export type { IVaultStore, IVaultSnapshot };

/** Logical id for the single replaceable tracked-assets vault blob. */
export const TRACKED_ASSETS_LOGICAL_ID = "trackedAssets";

const vaultTrackedAssetRowSchema = z.object({
  chainId: EVMChainIdSchema,
  address: EVMContractAddressSchema,
  type: z.enum(EAssetType).catch(EAssetType.Erc20),
  name: z.string(),
  symbol: z.string(),
  decimals: z.number(),
  id: z.string(),
  iconUrl: z
    .string()
    .optional()
    .transform((value) =>
      value != null && value.length > 0 ? value : undefined,
    ),
});

/** Relayer payload — encrypted (credential/delegation) or plaintext (trackedAssets). */
export type VaultRemoteBlob =
  | {
      type: "credential";
      timestamp: UnixTimestamp;
      data: StoredCredential;
    }
  | {
      type: "delegation";
      timestamp: UnixTimestamp;
      hostDomain: DomainString;
      memo: string;
      data: IStoredDelegation;
    }
  | {
      type: "trackedAssets";
      timestamp: UnixTimestamp;
      data: { assets: IVaultTrackedAssetRow[] };
    };

type LocalVaultBlob = IVaultSnapshot;

export interface ICachedRelayerVaultRepositoryDeps {
  client: IRelayerCredentialsClient;
  owsProvider: IOWSProvider;
  /** Per-item IndexedDB vault store (defaults to IDB or in-memory). */
  vaultStore?: IVaultStore;
  trackedAssetSync?: IVaultTrackedAssetSync;
}

/**
 * Local plaintext vault + official copies on the 1Shot Relayer.
 * Holds credentials, ERC-7715 delegations, and unencrypted tracked assets.
 *
 * Local cache lives in IndexedDB object stores (credentials / delegations /
 * pendingEncrypted / vaultMeta). `list`/`get` read the in-memory mirror;
 * mutative methods sync to the relayer; `refreshFromRelayer` recovers blobs,
 * hydrates unencrypted immediately, and queues encrypted payloads for
 * opportunistic or forced decrypt.
 */
export class CachedRelayerVaultRepository
  implements ICredentialRepository, IDelegationRepository, IVaultPendingDecrypt
{
  private readonly client: IRelayerCredentialsClient;
  private readonly owsProvider: IOWSProvider;
  private readonly vaultStore: IVaultStore;
  private readonly trackedAssetSync: IVaultTrackedAssetSync | null;
  private cachedBlob: LocalVaultBlob | null = null;
  /** Last snapshot written to IDB — used to persist only changed rows. */
  private lastPersistedBlob: LocalVaultBlob | null = null;
  private blobLoaded = false;
  private blobLoadInFlight: Promise<void> | null = null;
  private refreshInFlight: Promise<void> | null = null;
  private ensureDecryptInFlight: Promise<void> | null = null;
  private trackedAssetsSyncInFlight: Promise<void> | null = null;
  /** Another local add/remove landed while a sync assert was in flight. */
  private trackedAssetsDirtyDuringSync = false;

  constructor(deps: ICachedRelayerVaultRepositoryDeps) {
    this.client = deps.client;
    this.owsProvider = deps.owsProvider;
    this.trackedAssetSync = deps.trackedAssetSync ?? null;
    this.vaultStore =
      deps.vaultStore ??
      (typeof indexedDB !== "undefined"
        ? createIdbVaultStore()
        : createMemoryVaultStore());
    this.trackedAssetSync?.setChangeListener(() => {
      void this.onTrackedAssetsChanged();
    });
  }

  /** Drop the in-memory vault mirror (e.g. after Change Account clears IDB). */
  invalidateLocalCache(): void {
    this.cachedBlob = null;
    this.lastPersistedBlob = null;
    this.blobLoaded = false;
    this.blobLoadInFlight = null;
  }

  private async ensureBlobLoaded(): Promise<void> {
    if (this.blobLoaded) return;
    if (this.blobLoadInFlight) {
      await this.blobLoadInFlight;
      return;
    }
    this.blobLoadInFlight = (async () => {
      const loaded = await this.vaultStore.loadAll();
      // Re-hydrate branded nested fields after IDB structured clone.
      const delegations: Record<string, IStoredDelegation> = {};
      for (const [key, value] of Object.entries(loaded.delegations)) {
        if (this.isStoredDelegation(value)) {
          delegations[key] = this.hydrateStoredDelegation(value);
        }
      }
      const snapshot: LocalVaultBlob = {
        ...loaded,
        delegations,
      };
      this.cachedBlob = snapshot;
      this.lastPersistedBlob = cloneVaultSnapshot(snapshot);
      this.blobLoaded = true;
    })().finally(() => {
      this.blobLoadInFlight = null;
    });
    await this.blobLoadInFlight;
  }

  // --- ICredentialRepository -------------------------------------------------

  async store(credential: StoredCredential): Promise<void> {
    await this.ensureBlobLoaded();
    const blob = this.readBlob();
    const previousBlobId = blob.blobIds[credential.credentialId];
    blob.credentials[credential.credentialId] = credential;
    blob.revoked = blob.revoked.filter((id) => id !== credential.credentialId);
    await this.writeBlob(blob);

    const wrapper: VaultRemoteBlob = {
      type: "credential",
      timestamp: UnixTimestamp(Math.floor(Date.now() / 1000)),
      data: credential,
    };

    try {
      await this.uploadWrapper(
        credential.credentialId,
        wrapper,
        previousBlobId,
      );
    } catch (error: unknown) {
      console.warn("[vault] local credential store ok; relayer upload failed", error);
    }
  }

  async get(credentialId: CredentialId): Promise<StoredCredential | undefined> {
    await this.ensureBlobLoaded();
    const blob = this.readBlob();
    if (blob.revoked.includes(credentialId)) {
      return undefined;
    }
    return blob.credentials[credentialId];
  }

  async list(filter?: CredentialFilter): Promise<CredentialSummary[]> {
    await this.ensureBlobLoaded();
    const blob = this.readBlob();
    const revoked = new Set(blob.revoked);
    const active = Object.values(blob.credentials).filter(
      (c) => !revoked.has(c.credentialId),
    );
    return this.summarizeCredentials(active, filter);
  }

  async delete(credentialId: CredentialId): Promise<void> {
    await this.ensureBlobLoaded();
    const blob = this.readBlob();
    const blobId = blob.blobIds[credentialId];
    delete blob.credentials[credentialId];
    delete blob.blobIds[credentialId];
    blob.revoked = blob.revoked.filter((id) => id !== credentialId);
    await this.writeBlob(blob);

    if (blobId) {
      try {
        await this.deleteRelayerBlob(blobId);
      } catch (error: unknown) {
        console.warn("[vault] failed to delete credential blob on relayer", error);
      }
    }
  }

  async revoke(credentialId: CredentialId): Promise<void> {
    await this.ensureBlobLoaded();
    const blob = this.readBlob();
    if (blob.credentials[credentialId] && !blob.revoked.includes(credentialId)) {
      blob.revoked.push(credentialId);
      await this.writeBlob(blob);
    }

    const blobId = blob.blobIds[credentialId];
    if (blobId) {
      try {
        await this.deleteRelayerBlob(blobId);
        const next = this.readBlob();
        delete next.blobIds[credentialId];
        await this.writeBlob(next);
      } catch (error: unknown) {
        console.warn("[vault] failed to revoke credential blob on relayer", error);
      }
    }
  }

  // --- IDelegationRepository -------------------------------------------------

  async storeDelegation(delegation: IStoredDelegation): Promise<void> {
    await this.storeDelegations([delegation]);
  }

  async storeDelegations(delegations: IStoredDelegation[]): Promise<void> {
    if (delegations.length === 0) return;
    await this.ensureBlobLoaded();
    const blob = this.readBlob();
    const uploads: Array<{
      logicalId: string;
      wrapper: VaultRemoteBlob;
      previousBlobId: string | undefined;
    }> = [];

    for (const delegation of delegations) {
      const id = delegation.delegationId;
      const previousBlobId = blob.blobIds[id];
      blob.delegations[id] = delegation;
      uploads.push({
        logicalId: id,
        previousBlobId,
        wrapper: {
          type: "delegation",
          timestamp: UnixTimestamp(Math.floor(Date.now() / 1000)),
          hostDomain: delegation.hostDomain,
          memo: delegation.memo,
          data: delegation,
        },
      });
    }
    await this.writeBlob(blob);

    try {
      await this.uploadWrappers(uploads);
    } catch (error: unknown) {
      console.warn(
        "[vault] local delegation store ok; relayer upload failed",
        error,
      );
    }
  }

  async getDelegation(
    delegationId: DelegationIdType,
  ): Promise<IStoredDelegation | undefined> {
    await this.ensureBlobLoaded();
    return this.readBlob().delegations[delegationId];
  }

  async getDelegationByHash(
    delegationHash: HexString,
  ): Promise<IStoredDelegation | undefined> {
    await this.ensureBlobLoaded();
    const hash = String(delegationHash).toLowerCase();
    return Object.values(this.readBlob().delegations).find(
      (d) => String(d.delegationHash).toLowerCase() === hash,
    );
  }

  async listDelegations(): Promise<IDelegationSummary[]> {
    await this.ensureBlobLoaded();
    return this.summarizeDelegations(Object.values(this.readBlob().delegations));
  }

  async deleteDelegation(delegationId: DelegationIdType): Promise<void> {
    await this.deleteDelegations([delegationId]);
  }

  async deleteDelegations(
    delegationIds: readonly DelegationIdType[],
  ): Promise<void> {
    if (delegationIds.length === 0) return;
    await this.ensureBlobLoaded();
    const blob = this.readBlob();
    const remoteBlobIds: string[] = [];
    for (const delegationId of delegationIds) {
      const blobId = blob.blobIds[delegationId];
      if (blobId) {
        remoteBlobIds.push(blobId);
      }
      delete blob.delegations[delegationId];
      delete blob.blobIds[delegationId];
    }
    await this.writeBlob(blob);

    if (remoteBlobIds.length === 0) return;
    try {
      await this.deleteRelayerBlobs(remoteBlobIds);
    } catch (error: unknown) {
      console.warn("[vault] failed to delete delegation blob(s) on relayer", error);
    }
  }

  async mintRelayerVaultChallenge(): Promise<IWalletCredentialChallengeResponse> {
    return this.client.getChallenge();
  }

  cacheRelayerVaultAssertion(
    challengeId: ChallengeId,
    assertion: WebAuthnAssertionFields,
  ): void {
    this.client.setAssertion(challengeId, assertion);
  }

  // --- Shared vault ops ------------------------------------------------------

  /**
   * Register this wallet's WebAuthn passkey with the relayer.
   * Call once at account creation while `cosePublicKey` is still available.
   */
  async registerPasskey(publicKey: COSEPublicKey): Promise<void> {
    const assertion = await this.assert();
    await this.client.registerPasskey({ ...assertion, publicKey });
  }

  /**
   * Pull recover blobs from the relayer. Unencrypted payloads hydrate
   * immediately; encrypted payloads are queued for opportunistic decrypt.
   * Concurrent callers share one in-flight recover.
   */
  async refreshFromRelayer(): Promise<void> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }
    this.refreshInFlight = this.runRefreshFromRelayer().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  async ensurePendingStateLoaded(): Promise<void> {
    await this.ensureBlobLoaded();
  }

  hasPendingEncrypted(): boolean {
    if (!this.blobLoaded) return false;
    return this.readBlob().pendingEncrypted.length > 0;
  }

  peekPendingEncrypted(): IPendingEncryptedBlob[] {
    if (!this.blobLoaded) return [];
    return [...this.readBlob().pendingEncrypted];
  }

  hasPendingTrackedAssetsUpload(): boolean {
    if (!this.blobLoaded) return false;
    return this.readBlob().pendingTrackedAssetsUpload;
  }

  async applyDecryptedPayloads(
    plaintexts: string[],
    ids: string[],
  ): Promise<void> {
    if (ids.length === 0) return;
    await this.ensureBlobLoaded();
    const blob = this.readBlob();
    const credentials = { ...blob.credentials };
    const delegations = { ...blob.delegations };
    const blobIds = { ...blob.blobIds };
    const applied = new Set<string>();

    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i]!;
      const raw = plaintexts[i];
      if (typeof raw !== "string") continue;
      // Always drop from pending once ciphertext decrypted — otherwise a parse
      // failure re-prompts on every Credentials / Delegations tab open.
      applied.add(id);
      const wrapper = this.parseVaultRemoteBlob(raw);
      if (!wrapper) {
        console.warn("[vault] skipping invalid decrypted blob", id);
        continue;
      }
      if (wrapper.type === "credential") {
        credentials[wrapper.data.credentialId] = wrapper.data;
        blobIds[wrapper.data.credentialId] = id;
      } else if (wrapper.type === "delegation") {
        delegations[wrapper.data.delegationId] = wrapper.data;
        blobIds[wrapper.data.delegationId] = id;
      }
    }

    await this.writeBlob({
      ...blob,
      credentials,
      delegations,
      blobIds,
      pendingEncrypted: blob.pendingEncrypted.filter((p) => !applied.has(p.id)),
    });
  }

  async ensureDecrypted(): Promise<void> {
    await this.ensureBlobLoaded();
    if (this.readBlob().pendingEncrypted.length === 0) {
      if (this.readBlob().pendingTrackedAssetsUpload) {
        await this.uploadPendingTrackedAssetsStandalone();
      }
      return;
    }
    if (this.ensureDecryptInFlight) {
      return this.ensureDecryptInFlight;
    }
    this.ensureDecryptInFlight = this.runEnsureDecrypted().finally(() => {
      this.ensureDecryptInFlight = null;
    });
    return this.ensureDecryptInFlight;
  }

  async flushTrackedAssetsUpload(
    challengeId: ChallengeId,
    assertion: WebAuthnAssertionFields,
  ): Promise<void> {
    await this.ensureBlobLoaded();
    if (!this.trackedAssetSync || !this.readBlob().pendingTrackedAssetsUpload) {
      this.cacheRelayerVaultAssertion(challengeId, assertion);
      return;
    }
    try {
      await this.uploadTrackedAssetsWithAssertion(challengeId, assertion);
    } catch (error: unknown) {
      console.warn("[vault] tracked-assets upload after ceremony failed", error);
      this.cacheRelayerVaultAssertion(challengeId, assertion);
    }
  }

  private async runEnsureDecrypted(): Promise<void> {
    const pending = this.readBlob().pendingEncrypted;
    if (pending.length === 0) return;
    const signer = await this.owsProvider.getSigner();
    const needUpload = this.readBlob().pendingTrackedAssetsUpload;
    if (needUpload) {
      const { challengeId, challenge } = await this.client.getChallenge();
      const batchResult = await withCeremonyUiReason(
        EPasskeyPromptReason.Decrypt,
        () =>
          signer.executeBatch({
            challenge,
            ciphertexts: pending.map((p) =>
              AES256CipherTextEnvelope(p.payload),
            ),
          }),
      );
      const plaintexts = batchResult.plaintexts ?? [];
      await this.applyDecryptedPayloads(
        plaintexts,
        pending.map((p) => p.id),
      );
      if (batchResult.assertion) {
        await this.flushTrackedAssetsUpload(challengeId, batchResult.assertion);
      }
      return;
    }

    const plaintexts = await withCeremonyUiReason(
      EPasskeyPromptReason.Decrypt,
      () =>
        signer.decryptAES256(
          pending.map((p) => AES256CipherTextEnvelope(p.payload)),
        ),
    );
    await this.applyDecryptedPayloads(
      plaintexts,
      pending.map((p) => p.id),
    );
  }

  private async runRefreshFromRelayer(): Promise<void> {
    await this.ensureBlobLoaded();
    const { credentials: remote } = await this.recoverRemoteBlobs();
    const prior = this.readBlob();

    if (remote.length === 0) {
      await this.writeBlob({
        credentials: {},
        delegations: {},
        revoked: [],
        blobIds: {},
        pendingEncrypted: [],
        pendingTrackedAssetsUpload: prior.pendingTrackedAssetsUpload,
      });
      return;
    }

    const credentials: Record<string, StoredCredential> = {};
    const delegations: Record<string, IStoredDelegation> = {};
    const blobIds: Record<string, string> = {};
    const pendingEncrypted: IPendingEncryptedBlob[] = [];
    let trackedAssetsHydrated = false;

    // Remote blob id → logical id for plaintext already decrypted locally.
    // Refresh must not re-queue those or wipe the in-memory vault.
    const priorLogicalByBlobId = new Map<string, string>();
    for (const [logicalId, remoteId] of Object.entries(prior.blobIds)) {
      priorLogicalByBlobId.set(remoteId, logicalId);
    }

    for (const item of remote) {
      if (item.encrypted) {
        const logicalId = priorLogicalByBlobId.get(item.id);
        if (logicalId) {
          const localCredential = prior.credentials[logicalId];
          if (localCredential) {
            credentials[logicalId] = localCredential;
            blobIds[logicalId] = item.id;
            continue;
          }
          const localDelegation = prior.delegations[logicalId];
          if (localDelegation) {
            delegations[logicalId] = localDelegation;
            blobIds[logicalId] = item.id;
            continue;
          }
        }
        pendingEncrypted.push({
          id: item.id,
          payload: item.payload,
          createdTimestamp: item.createdTimestamp,
        });
        continue;
      }
      const wrapper = this.parseVaultRemoteBlob(item.payload);
      if (!wrapper) {
        console.warn(
          "[vault] skipping invalid unencrypted recovered blob",
          item.id,
        );
        continue;
      }
      if (wrapper.type === "trackedAssets") {
        trackedAssetsHydrated = true;
        blobIds[TRACKED_ASSETS_LOGICAL_ID] = item.id;
        await this.trackedAssetSync?.replaceUserAssetsFromVault(
          wrapper.data.assets,
        );
      } else if (wrapper.type === "credential") {
        // Unencrypted credentials are not expected; treat as hydrate if present.
        credentials[wrapper.data.credentialId] = wrapper.data;
        blobIds[wrapper.data.credentialId] = item.id;
      } else if (wrapper.type === "delegation") {
        delegations[wrapper.data.delegationId] = wrapper.data;
        blobIds[wrapper.data.delegationId] = item.id;
      }
    }

    await this.writeBlob({
      credentials,
      delegations,
      revoked: [],
      blobIds,
      pendingEncrypted,
      // Remote hydrate wins over local pending upload unless we still have
      // local-only changes that never reached the relayer.
      pendingTrackedAssetsUpload: trackedAssetsHydrated
        ? false
        : prior.pendingTrackedAssetsUpload,
    });
  }

  /**
   * Recover vault blobs. If the passkey was never registered on this relayer
   * but we still have create-time COSE locally, register then retry once.
   */
  private async recoverRemoteBlobs(): Promise<{
    credentials: Awaited<
      ReturnType<IRelayerCredentialsClient["recoverCredentials"]>
    >["credentials"];
  }> {
    try {
      const assertion = await this.assert();
      return await this.client.recoverCredentials(assertion);
    } catch (error: unknown) {
      if (!this.isPasskeyUnregisteredError(error)) {
        throw error;
      }
      const cosePublicKey = loadCosePublicKey();
      if (!cosePublicKey) {
        throw error;
      }
      console.info(
        "[vault] passkey unregistered on relayer — registering stored COSE and retrying recover",
      );
      await this.registerPasskey(cosePublicKey);
      const assertion = await this.assert();
      return await this.client.recoverCredentials(assertion);
    }
  }

  private isPasskeyUnregisteredError(error: unknown): boolean {
    return (
      error instanceof RelayerCredentialsError &&
      error.status === 404 &&
      /passkey not registered/i.test(error.message)
    );
  }

  private async markTrackedAssetsUploadPending(): Promise<void> {
    await this.ensureBlobLoaded();
    const blob = this.readBlob();
    if (blob.pendingTrackedAssetsUpload) return;
    await this.writeBlob({ ...blob, pendingTrackedAssetsUpload: true });
  }

  /**
   * Local add/remove: mark pending and push an unencrypted vault blob to the
   * relayer (one RelayerAuth ceremony). Concurrent edits coalesce into one
   * follow-up sync after the in-flight assert finishes.
   */
  private async onTrackedAssetsChanged(): Promise<void> {
    await this.markTrackedAssetsUploadPending();
    if (this.trackedAssetsSyncInFlight) {
      this.trackedAssetsDirtyDuringSync = true;
      return;
    }
    await this.syncTrackedAssetsToRelayer();
  }

  /**
   * Assert + store the current user-added tracked-assets list (unencrypted).
   * Safe to call when {@link hasPendingTrackedAssetsUpload} is true.
   */
  async syncTrackedAssetsToRelayer(): Promise<void> {
    await this.ensureBlobLoaded();
    if (!this.trackedAssetSync) return;
    if (!this.readBlob().pendingTrackedAssetsUpload) return;
    if (this.trackedAssetsSyncInFlight) {
      return this.trackedAssetsSyncInFlight;
    }

    this.trackedAssetsSyncInFlight = this.uploadPendingTrackedAssetsStandalone()
      .catch((error: unknown) => {
        console.warn("[vault] tracked-assets sync to relayer failed", error);
      })
      .finally(() => {
        this.trackedAssetsSyncInFlight = null;
      });

    await this.trackedAssetsSyncInFlight;

    if (this.trackedAssetsDirtyDuringSync) {
      this.trackedAssetsDirtyDuringSync = false;
      await this.markTrackedAssetsUploadPending();
      await this.syncTrackedAssetsToRelayer();
    }
  }

  private async uploadPendingTrackedAssetsStandalone(): Promise<void> {
    if (!this.trackedAssetSync) return;
    const assertion = await this.assert();
    // assert() already consumed a challenge; we need store with that assertion.
    // RelayerCredentialsClient.assert returns a full IWebAuthnAssertionRequest.
    await this.uploadTrackedAssetsWithWireAssertion(assertion);
  }

  private async uploadTrackedAssetsWithAssertion(
    challengeId: ChallengeId,
    assertion: WebAuthnAssertionFields,
  ): Promise<void> {
    await this.uploadTrackedAssetsWithWireAssertion(
      toRelayerAssertionRequest(challengeId, assertion),
    );
  }

  private async uploadTrackedAssetsWithWireAssertion(
    assertion: Awaited<ReturnType<IRelayerCredentialsClient["assert"]>>,
  ): Promise<void> {
    if (!this.trackedAssetSync) return;
    const assets = await this.trackedAssetSync.exportUserAssetsForVault();
    const wrapper: VaultRemoteBlob = {
      type: "trackedAssets",
      timestamp: UnixTimestamp(Math.floor(Date.now() / 1000)),
      data: { assets },
    };
    const blob = this.readBlob();
    const previousBlobId = blob.blobIds[TRACKED_ASSETS_LOGICAL_ID];
    const { ids } = await this.client.storeCredentials({
      ...assertion,
      items: [{ payload: JSON.stringify(wrapper), encrypted: false }],
    });
    const id = ids[0];
    if (!id) {
      throw new Error("storeCredentials: trackedAssets id missing");
    }
    const next = this.readBlob();
    next.blobIds[TRACKED_ASSETS_LOGICAL_ID] = id;
    next.pendingTrackedAssetsUpload = false;
    await this.writeBlob(next);
    if (previousBlobId && previousBlobId !== id) {
      try {
        await this.deleteRelayerBlob(previousBlobId);
      } catch (error: unknown) {
        console.warn(
          "[vault] failed to delete previous trackedAssets blob",
          error,
        );
      }
    }
  }

  private async uploadWrapper(
    logicalId: string,
    wrapper: VaultRemoteBlob,
    previousBlobId: string | undefined,
  ): Promise<void> {
    await this.uploadWrappers([{ logicalId, wrapper, previousBlobId }]);
  }

  private async uploadWrappers(
    items: Array<{
      logicalId: string;
      wrapper: VaultRemoteBlob;
      previousBlobId: string | undefined;
      encrypted?: boolean;
    }>,
  ): Promise<void> {
    if (items.length === 0) return;
    const signer = await this.owsProvider.getSigner();
    const { challengeId, challenge } = await this.client.getChallenge();

    const encryptedItems = items.filter((item) => item.encrypted !== false);
    const plaintextItems = items.filter((item) => item.encrypted === false);

    let assertionFields: WebAuthnAssertionFields | undefined;
    let ciphertexts: string[] = [];

    if (encryptedItems.length > 0) {
      const batchResult = await withCeremonyUiReason(
        EPasskeyPromptReason.Encrypt,
        () =>
          signer.executeBatch({
            challenge,
            plaintexts: encryptedItems.map((item) =>
              JSON.stringify(item.wrapper),
            ),
          }),
      );
      if (!batchResult.assertion) {
        throw new Error("executeBatch: relayer auth assertion missing");
      }
      assertionFields = batchResult.assertion;
      if (
        !batchResult.ciphertexts ||
        batchResult.ciphertexts.length !== encryptedItems.length
      ) {
        throw new Error("executeBatch: encrypt ciphertext count mismatch");
      }
      ciphertexts = batchResult.ciphertexts.map((c) => String(c));
    } else {
      const { assertion } = await withCeremonyUiReason(
        EPasskeyPromptReason.RelayerAuth,
        () =>
          signer.getPublicKey({
            challenge,
            credentialId: loadCredentialId() ?? undefined,
          }),
      );
      assertionFields = assertion;
    }

    if (!assertionFields) {
      throw new Error("relayer auth assertion missing");
    }

    const storeItems: Array<{ payload: string; encrypted: boolean }> = [];
    // Preserve request order matching `items`.
    let encIdx = 0;
    for (const item of items) {
      if (item.encrypted === false) {
        storeItems.push({
          payload: JSON.stringify(item.wrapper),
          encrypted: false,
        });
      } else {
        storeItems.push({
          payload: ciphertexts[encIdx]!,
          encrypted: true,
        });
        encIdx += 1;
      }
    }

    const assertion = toRelayerAssertionRequest(challengeId, assertionFields);
    const { ids } = await this.client.storeCredentials({
      ...assertion,
      items: storeItems,
    });
    if (ids.length !== items.length) {
      throw new Error("storeCredentials: blob id count mismatch");
    }

    const next = this.readBlob();
    for (let i = 0; i < items.length; i++) {
      next.blobIds[items[i]!.logicalId] = ids[i]!;
    }
    await this.writeBlob(next);

    for (const item of items) {
      if (item.previousBlobId) {
        await this.deleteRelayerBlob(item.previousBlobId);
      }
    }

    // Silence unused when only encrypted (plaintextItems used for clarity).
    void plaintextItems;
  }

  private async assert() {
    const credentialId = loadCredentialId();
    if (!credentialId) {
      throw new Error("WebAuthn credential id missing");
    }
    return this.client.assert(credentialId);
  }

  private async deleteRelayerBlob(blobId: string): Promise<void> {
    await this.deleteRelayerBlobs([blobId]);
  }

  /** One WebAuthn assertion for one or many relayer blob deletes. */
  private async deleteRelayerBlobs(blobIds: string[]): Promise<void> {
    if (blobIds.length === 0) return;
    const assertion = await this.assert();
    await this.client.deleteCredentials({
      ...assertion,
      credentialBlobIds: blobIds,
    });
  }

  private summarizeCredentials(
    credentials: Iterable<StoredCredential>,
    filter?: CredentialFilter,
  ): CredentialSummary[] {
    const filtered = [...credentials].filter((c) => {
      if (filter?.type && !c.type.includes(filter.type)) {
        return false;
      }
      if (filter?.issuer && c.issuer !== filter.issuer) {
        return false;
      }
      return true;
    });

    return filtered.map((c) => ({
      credentialId: c.credentialId,
      type: c.type,
      issuer: c.issuer,
      format: c.format,
      issuedAt: c.issuedAt,
      validUntil: c.validUntil,
    }));
  }

  private summarizeDelegations(
    delegations: Iterable<IStoredDelegation>,
  ): IDelegationSummary[] {
    return [...delegations].map((d) => {
      const data = d.permissionResponse.permission.data;
      const tokenRaw = data.tokenAddress ?? data.token ?? data.inputToken;
      const amountRaw = data.periodAmount ?? data.amount;
      const durationRaw = data.periodDuration ?? data.period ?? data.duration;
      const duration =
        typeof durationRaw === "number"
          ? durationRaw
          : typeof durationRaw === "string" && durationRaw.trim() !== ""
            ? Number(durationRaw)
            : undefined;
      const destRaw = data.destinationChainId;
      const destinationChainId =
        typeof destRaw === "number"
          ? String(destRaw)
          : typeof destRaw === "string" && destRaw.trim() !== ""
            ? destRaw
            : undefined;
      const spenderRaw = data.spender ?? data.lifiDiamond;
      const slippageRaw = data.slippageBps;
      const slippageBps =
        typeof slippageRaw === "number"
          ? slippageRaw
          : typeof slippageRaw === "string" && slippageRaw.trim() !== ""
            ? Number(slippageRaw)
            : undefined;
      return {
        delegationId: d.delegationId,
        delegationHash: d.delegationHash,
        chainId: d.chainId,
        hostDomain: d.hostDomain,
        memo: d.memo,
        createdAt: d.createdAt,
        permissionType: d.permissionResponse.permission.type,
        to: d.permissionResponse.to,
        ...(typeof tokenRaw === "string"
          ? { tokenAddress: EVMContractAddress(getAddress(tokenRaw)) }
          : {}),
        ...(typeof amountRaw === "string"
          ? { periodAmount: HexString(this.asHex(amountRaw)) }
          : {}),
        ...(typeof duration === "number" &&
        Number.isFinite(duration) &&
        duration > 0
          ? { periodDuration: duration }
          : {}),
        ...(destinationChainId ? { destinationChainId } : {}),
        ...(typeof spenderRaw === "string"
          ? { spender: EVMAccountAddress(this.asHex(spenderRaw)) }
          : {}),
        ...(typeof slippageBps === "number" &&
        Number.isFinite(slippageBps) &&
        slippageBps >= 0
          ? { slippageBps }
          : {}),
      };
    });
  }

  private isStoredCredential(value: unknown): value is StoredCredential {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    return (
      typeof record.credentialId === "string" &&
      typeof record.payload === "string" &&
      typeof record.issuer === "string" &&
      Array.isArray(record.type)
    );
  }

  private isSignedDelegationShape(value: unknown): boolean {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    if (
      typeof record.delegate !== "string" ||
      typeof record.delegator !== "string" ||
      typeof record.authority !== "string" ||
      typeof record.salt !== "string" ||
      typeof record.signature !== "string" ||
      !Array.isArray(record.caveats)
    ) {
      return false;
    }
    return record.caveats.every((caveat) => {
      if (!caveat || typeof caveat !== "object") return false;
      const c = caveat as Record<string, unknown>;
      return (
        typeof c.enforcer === "string" &&
        typeof c.terms === "string" &&
        typeof c.args === "string"
      );
    });
  }

  private isPermissionResponseShape(value: unknown): boolean {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    if (
      typeof record.chainId !== "string" ||
      typeof record.to !== "string" ||
      typeof record.context !== "string" ||
      typeof record.delegationManager !== "string" ||
      !Array.isArray(record.dependencies) ||
      record.permission === null ||
      typeof record.permission !== "object"
    ) {
      return false;
    }
    return record.dependencies.every((dep) => {
      if (!dep || typeof dep !== "object") return false;
      const d = dep as Record<string, unknown>;
      return typeof d.factory === "string" && typeof d.factoryData === "string";
    });
  }

  private isStoredDelegation(value: unknown): value is IStoredDelegation {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    return (
      typeof record.delegationId === "string" &&
      typeof record.delegationHash === "string" &&
      typeof record.chainId === "string" &&
      typeof record.hostDomain === "string" &&
      typeof record.memo === "string" &&
      typeof record.createdAt === "number" &&
      this.isSignedDelegationShape(record.delegation) &&
      this.isPermissionResponseShape(record.permissionResponse)
    );
  }

  private asHex(value: unknown): `0x${string}` {
    return value as `0x${string}`;
  }

  private hydrateSignedDelegation(raw: unknown): ISignedDelegation {
    const record = raw as Record<string, unknown>;
    const caveats = (
      record.caveats as ReadonlyArray<Record<string, unknown>>
    ).map(
      (c): IDelegationCaveat => ({
        enforcer: EVMContractAddress(this.asHex(c.enforcer)),
        terms: HexString(this.asHex(c.terms)),
        args: HexString(this.asHex(c.args)),
      }),
    );
    return {
      delegate: EVMAccountAddress(this.asHex(record.delegate)),
      delegator: EVMAccountAddress(this.asHex(record.delegator)),
      authority: HexString(this.asHex(record.authority)),
      caveats,
      salt: HexString(this.asHex(record.salt)),
      signature: HexString(this.asHex(record.signature)),
    };
  }

  private hydratePermissionResponse(
    raw: unknown,
  ): IExecutionPermissionResponse {
    const record = raw as Record<string, unknown>;
    const dependenciesRaw = record.dependencies as ReadonlyArray<
      Record<string, unknown>
    >;
    const response: IExecutionPermissionResponse = {
      chainId: ChainUtils.asEVMChainId(this.asHex(record.chainId)),
      to: EVMAccountAddress(this.asHex(record.to)),
      permission:
        record.permission as IExecutionPermissionResponse["permission"],
      context: HexString(this.asHex(record.context)),
      dependencies: dependenciesRaw.map((dep) => ({
        factory: EVMContractAddress(this.asHex(dep.factory)),
        factoryData: HexString(this.asHex(dep.factoryData)),
      })),
      delegationManager: EVMContractAddress(
        this.asHex(record.delegationManager),
      ),
    };
    if (typeof record.from === "string") {
      response.from = EVMAccountAddress(this.asHex(record.from));
    }
    if (Array.isArray(record.rules)) {
      response.rules = record.rules as IExecutionPermissionResponse["rules"];
    }
    return response;
  }

  /** Re-brand nested fields after JSON round-trip (relayer or localStorage). */
  private hydrateStoredDelegation(raw: IStoredDelegation): IStoredDelegation {
    return {
      delegationId: DelegationId(raw.delegationId),
      delegationHash: HexString(raw.delegationHash),
      chainId: ChainUtils.asEVMChainId(raw.chainId),
      hostDomain: DomainString(raw.hostDomain),
      memo: raw.memo,
      createdAt: UnixTimestamp(raw.createdAt),
      delegation: this.hydrateSignedDelegation(raw.delegation),
      permissionResponse: this.hydratePermissionResponse(
        raw.permissionResponse,
      ),
    };
  }

  private parseVaultRemoteBlob(raw: string): VaultRemoteBlob | null {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const record = parsed as Record<string, unknown>;
      if (record.type === "credential" && this.isStoredCredential(record.data)) {
        return {
          type: "credential",
          timestamp: UnixTimestamp(
            typeof record.timestamp === "number"
              ? record.timestamp
              : Math.floor(Date.now() / 1000),
          ),
          data: record.data,
        };
      }
      if (record.type === "delegation" && this.isStoredDelegation(record.data)) {
        return {
          type: "delegation",
          timestamp: UnixTimestamp(
            typeof record.timestamp === "number"
              ? record.timestamp
              : Math.floor(Date.now() / 1000),
          ),
          hostDomain: DomainString(
            typeof record.hostDomain === "string" ? record.hostDomain : "",
          ),
          memo: typeof record.memo === "string" ? record.memo : "",
          data: this.hydrateStoredDelegation(record.data),
        };
      }
      if (record.type === "trackedAssets") {
        const data = record.data;
        if (!data || typeof data !== "object") return null;
        const assetsRaw = (data as Record<string, unknown>).assets;
        if (!Array.isArray(assetsRaw)) return null;
        const assets: IVaultTrackedAssetRow[] = [];
        for (const row of assetsRaw) {
          const parsedRow = this.parseTrackedAssetRow(row);
          if (parsedRow) assets.push(parsedRow);
        }
        return {
          type: "trackedAssets",
          timestamp: UnixTimestamp(
            typeof record.timestamp === "number"
              ? record.timestamp
              : Math.floor(Date.now() / 1000),
          ),
          data: { assets },
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private parseTrackedAssetRow(value: unknown): IVaultTrackedAssetRow | null {
    const parsed = vaultTrackedAssetRowSchema.safeParse(value);
    if (!parsed.success) return null;
    return parsed.data;
  }

  private emptyBlob(): LocalVaultBlob {
    return emptyVaultSnapshot();
  }

  /** Sync read of the in-memory mirror (call after {@link ensureBlobLoaded}). */
  private readBlob(): LocalVaultBlob {
    return this.cachedBlob ?? this.emptyBlob();
  }

  /**
   * Update the in-memory mirror and persist only rows that changed vs the
   * last IndexedDB snapshot (per-item object stores).
   */
  private async writeBlob(blob: LocalVaultBlob): Promise<void> {
    const prev = this.lastPersistedBlob ?? this.emptyBlob();
    this.cachedBlob = blob;
    this.blobLoaded = true;
    await this.vaultStore.persistDiff(prev, blob);
    this.lastPersistedBlob = cloneVaultSnapshot(blob);
  }
}

export { createMemoryVaultStore, createIdbVaultStore };
