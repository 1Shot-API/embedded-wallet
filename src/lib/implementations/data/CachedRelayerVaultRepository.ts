import {
  AES256CipherText,
  DomainString,
  EVMAccountAddress,
  EVMChainId,
  EVMContractAddress,
  HexString,
  UnixTimestamp,
  type COSEPublicKey,
  type CredentialFilter,
  type CredentialId,
  type CredentialSummary,
  type ICredentialRepository,
  type IExecutionPermissionResponse,
  type StoredCredential,
} from "@1shotapi/ows-types";
import {
  createMemoryStorageBackend,
  type CredentialStorageBackend,
} from "../../../demo/local-storage-store";
import type { IDelegationRepository } from "../../interfaces/data/IDelegationRepository";
import type { IConfigProvider } from "../../interfaces/utils/IConfigProvider";
import type { IOWSProvider } from "../../interfaces/utils/IOWSProvider";
import type {
  IDelegationCaveat,
  IDelegationSummary,
  ISignedDelegation,
  IStoredDelegation,
} from "../../types/domain/StoredDelegation";
import {
  DelegationId,
  type DelegationId as DelegationIdType,
} from "../../types/primitives/DelegationId";
import { RelayerCredentialsClient, RelayerCredentialsError } from "../../../relayer/RelayerCredentialsClient";
import { createRelayerAssertion } from "../../../relayer/webauthnAuth";
import { loadCosePublicKey, loadCredentialId } from "../../../storage";

export type { CredentialStorageBackend };

/** Encrypted relayer payload — opaque to the server. */
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
    };

type LocalVaultBlob = {
  credentials: Record<string, StoredCredential>;
  delegations: Record<string, IStoredDelegation>;
  revoked: string[];
  /** Logical id (credentialId or delegationId) → relayer blob id. */
  blobIds: Record<string, string>;
};

export interface ICachedRelayerVaultRepositoryDeps {
  client: RelayerCredentialsClient;
  owsProvider: IOWSProvider;
  configProvider: IConfigProvider;
  storage?: CredentialStorageBackend;
}

/**
 * Local plaintext vault + encrypted official copies on the 1Shot Relayer.
 * Holds credentials and ERC-7715 delegations (and future typed blobs).
 *
 * `list`/`get` read the cache; mutative methods sync to the relayer;
 * `refreshFromRelayer` replaces the cache from recover.
 *
 * Store remains two ceremonies (OWS encrypt, then Branding Relayer WebAuthn):
 * the relayer requires a full SimpleWebAuthn assertion, while OWS
 * `executeBatch` only returns `challengeSignature`.
 */
export class CachedRelayerVaultRepository
  implements ICredentialRepository, IDelegationRepository
{
  private readonly client: RelayerCredentialsClient;
  private readonly owsProvider: IOWSProvider;
  private readonly configProvider: IConfigProvider;
  private readonly storage: CredentialStorageBackend;
  private storageKey: string | null = null;
  private refreshInFlight: Promise<void> | null = null;

  constructor(deps: ICachedRelayerVaultRepositoryDeps) {
    this.client = deps.client;
    this.owsProvider = deps.owsProvider;
    this.configProvider = deps.configProvider;
    this.storage =
      deps.storage ??
      (typeof localStorage !== "undefined"
        ? localStorage
        : createMemoryStorageBackend());
  }

  private async ensureStorageKey(): Promise<string> {
    if (this.storageKey) {
      return this.storageKey;
    }
    const config = await this.configProvider.getConfig();
    this.storageKey = config.vaultStorageKey;
    return this.storageKey;
  }

  // --- ICredentialRepository -------------------------------------------------

  async store(credential: StoredCredential): Promise<void> {
    await this.ensureStorageKey();
    const blob = this.readBlob();
    const previousBlobId = blob.blobIds[credential.credentialId];
    blob.credentials[credential.credentialId] = credential;
    blob.revoked = blob.revoked.filter((id) => id !== credential.credentialId);
    this.writeBlob(blob);

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
    await this.ensureStorageKey();
    const blob = this.readBlob();
    if (blob.revoked.includes(credentialId)) {
      return undefined;
    }
    return blob.credentials[credentialId];
  }

  async list(filter?: CredentialFilter): Promise<CredentialSummary[]> {
    await this.ensureStorageKey();
    const blob = this.readBlob();
    const revoked = new Set(blob.revoked);
    const active = Object.values(blob.credentials).filter(
      (c) => !revoked.has(c.credentialId),
    );
    return this.summarizeCredentials(active, filter);
  }

  async delete(credentialId: CredentialId): Promise<void> {
    await this.ensureStorageKey();
    const blob = this.readBlob();
    const blobId = blob.blobIds[credentialId];
    delete blob.credentials[credentialId];
    delete blob.blobIds[credentialId];
    blob.revoked = blob.revoked.filter((id) => id !== credentialId);
    this.writeBlob(blob);

    if (blobId) {
      try {
        await this.deleteRelayerBlob(blobId);
      } catch (error: unknown) {
        console.warn("[vault] failed to delete credential blob on relayer", error);
      }
    }
  }

  async revoke(credentialId: CredentialId): Promise<void> {
    await this.ensureStorageKey();
    const blob = this.readBlob();
    if (blob.credentials[credentialId] && !blob.revoked.includes(credentialId)) {
      blob.revoked.push(credentialId);
      this.writeBlob(blob);
    }

    const blobId = blob.blobIds[credentialId];
    if (blobId) {
      try {
        await this.deleteRelayerBlob(blobId);
        const next = this.readBlob();
        delete next.blobIds[credentialId];
        this.writeBlob(next);
      } catch (error: unknown) {
        console.warn("[vault] failed to revoke credential blob on relayer", error);
      }
    }
  }

  // --- IDelegationRepository -------------------------------------------------

  async storeDelegation(delegation: IStoredDelegation): Promise<void> {
    await this.ensureStorageKey();
    const id = delegation.delegationId;
    const blob = this.readBlob();
    const previousBlobId = blob.blobIds[id];
    blob.delegations[id] = delegation;
    this.writeBlob(blob);

    const wrapper: VaultRemoteBlob = {
      type: "delegation",
      timestamp: UnixTimestamp(Math.floor(Date.now() / 1000)),
      hostDomain: delegation.hostDomain,
      memo: delegation.memo,
      data: delegation,
    };

    try {
      await this.uploadWrapper(id, wrapper, previousBlobId);
    } catch (error: unknown) {
      console.warn("[vault] local delegation store ok; relayer upload failed", error);
    }
  }

  async getDelegation(
    delegationId: DelegationIdType,
  ): Promise<IStoredDelegation | undefined> {
    await this.ensureStorageKey();
    return this.readBlob().delegations[delegationId];
  }

  async getDelegationByHash(
    delegationHash: HexString,
  ): Promise<IStoredDelegation | undefined> {
    await this.ensureStorageKey();
    const hash = String(delegationHash).toLowerCase();
    return Object.values(this.readBlob().delegations).find(
      (d) => String(d.delegationHash).toLowerCase() === hash,
    );
  }

  async listDelegations(): Promise<IDelegationSummary[]> {
    await this.ensureStorageKey();
    return this.summarizeDelegations(Object.values(this.readBlob().delegations));
  }

  async deleteDelegation(delegationId: DelegationIdType): Promise<void> {
    await this.ensureStorageKey();
    const blob = this.readBlob();
    const blobId = blob.blobIds[delegationId];
    delete blob.delegations[delegationId];
    delete blob.blobIds[delegationId];
    this.writeBlob(blob);

    if (blobId) {
      try {
        await this.deleteRelayerBlob(blobId);
      } catch (error: unknown) {
        console.warn("[vault] failed to delete delegation blob on relayer", error);
      }
    }
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
   * Pull recover blobs from the relayer, decrypt, and replace the local cache.
   * Concurrent callers share one in-flight recover (one RelayerAuth + Decrypt).
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

  private async runRefreshFromRelayer(): Promise<void> {
    await this.ensureStorageKey();
    const { credentials: remote } = await this.recoverRemoteBlobs();

    if (remote.length === 0) {
      this.writeBlob({
        credentials: {},
        delegations: {},
        revoked: [],
        blobIds: {},
      });
      return;
    }

    const signer = await this.owsProvider.getSigner();
    const ciphertexts = remote.map((item) =>
      AES256CipherText(item.ciphertext),
    );
    const plaintexts = await signer.decryptAES256(ciphertexts);

    const credentials: Record<string, StoredCredential> = {};
    const delegations: Record<string, IStoredDelegation> = {};
    const blobIds: Record<string, string> = {};

    for (let i = 0; i < remote.length; i += 1) {
      const item = remote[i]!;
      const raw = plaintexts[i];
      if (typeof raw !== "string") continue;
      const wrapper = this.parseVaultRemoteBlob(raw);
      if (!wrapper) {
        console.warn(
          "[vault] skipping undecryptable/invalid recovered blob",
          item.id,
        );
        continue;
      }
      if (wrapper.type === "credential") {
        credentials[wrapper.data.credentialId] = wrapper.data;
        blobIds[wrapper.data.credentialId] = item.id;
      } else {
        delegations[wrapper.data.delegationId] = wrapper.data;
        blobIds[wrapper.data.delegationId] = item.id;
      }
    }

    this.writeBlob({ credentials, delegations, revoked: [], blobIds });
  }

  /**
   * Recover vault blobs. If the passkey was never registered on this relayer
   * but we still have create-time COSE locally, register then retry once.
   */
  private async recoverRemoteBlobs(): Promise<{
    credentials: Awaited<
      ReturnType<RelayerCredentialsClient["recoverCredentials"]>
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

  private async uploadWrapper(
    logicalId: string,
    wrapper: VaultRemoteBlob,
    previousBlobId: string | undefined,
  ): Promise<void> {
    const signer = await this.owsProvider.getSigner();
    const [ciphertext] = await signer.encryptAES256([JSON.stringify(wrapper)]);
    if (!ciphertext) {
      throw new Error("encryptAES256 returned no ciphertext");
    }

    if (previousBlobId) {
      await this.deleteRelayerBlob(previousBlobId);
    }

    const assertion = await this.assert();
    const { id } = await this.client.storeCredential({
      ...assertion,
      ciphertext: String(ciphertext),
    });

    const next = this.readBlob();
    next.blobIds[logicalId] = id;
    this.writeBlob(next);
  }

  private async assert() {
    const credentialId = loadCredentialId();
    if (!credentialId) {
      throw new Error("WebAuthn credential id missing");
    }
    return createRelayerAssertion(this.client, credentialId);
  }

  private async deleteRelayerBlob(blobId: string): Promise<void> {
    const assertion = await this.assert();
    await this.client.deleteCredentials({
      ...assertion,
      credentialBlobId: blobId,
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
      const tokenRaw = data.tokenAddress ?? data.token;
      const amountRaw = data.periodAmount ?? data.amount;
      const durationRaw = data.periodDuration ?? data.period ?? data.duration;
      const duration =
        typeof durationRaw === "number"
          ? durationRaw
          : typeof durationRaw === "string" && durationRaw.trim() !== ""
            ? Number(durationRaw)
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
          ? { tokenAddress: EVMAccountAddress(this.asHex(tokenRaw)) }
          : {}),
        ...(typeof amountRaw === "string"
          ? { periodAmount: HexString(this.asHex(amountRaw)) }
          : {}),
        ...(typeof duration === "number" &&
        Number.isFinite(duration) &&
        duration > 0
          ? { periodDuration: duration }
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
      chainId: EVMChainId(this.asHex(record.chainId)),
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
      chainId: EVMChainId(raw.chainId),
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
      return null;
    } catch {
      return null;
    }
  }

  private readBlob(): LocalVaultBlob {
    const storageKey = this.storageKey;
    if (!storageKey) {
      return { credentials: {}, delegations: {}, revoked: [], blobIds: {} };
    }
    const raw = this.storage.getItem(storageKey);
    if (!raw) {
      return { credentials: {}, delegations: {}, revoked: [], blobIds: {} };
    }

    try {
      const parsed = JSON.parse(raw) as Partial<LocalVaultBlob>;
      const credentials =
        parsed && typeof parsed.credentials === "object"
          ? (parsed.credentials ?? {})
          : {};
      const delegationsRaw =
        parsed && typeof parsed.delegations === "object"
          ? (parsed.delegations ?? {})
          : {};
      const delegations: Record<string, IStoredDelegation> = {};
      for (const [key, value] of Object.entries(delegationsRaw)) {
        if (this.isStoredDelegation(value)) {
          delegations[key] = this.hydrateStoredDelegation(value);
        }
      }
      return {
        credentials,
        delegations,
        revoked: Array.isArray(parsed.revoked) ? parsed.revoked : [],
        blobIds:
          parsed && typeof parsed.blobIds === "object"
            ? (parsed.blobIds ?? {})
            : {},
      };
    } catch {
      return { credentials: {}, delegations: {}, revoked: [], blobIds: {} };
    }
  }

  private writeBlob(blob: LocalVaultBlob): void {
    const storageKey = this.storageKey;
    if (!storageKey) {
      return;
    }
    const credCount = Object.keys(blob.credentials).length;
    const delCount = Object.keys(blob.delegations).length;
    const blobCount = Object.keys(blob.blobIds).length;
    if (
      credCount === 0 &&
      delCount === 0 &&
      blob.revoked.length === 0 &&
      blobCount === 0
    ) {
      this.storage.removeItem(storageKey);
      return;
    }
    this.storage.setItem(storageKey, JSON.stringify(blob));
  }
}

export { createMemoryStorageBackend };
