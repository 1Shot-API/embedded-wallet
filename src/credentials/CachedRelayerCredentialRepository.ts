import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import {
  AES256CipherText,
  type CredentialFilter,
  type CredentialId,
  type CredentialSummary,
  type ICredentialRepository,
  type StoredCredential,
} from "@1shotapi/ows-types";
import type { RelayerCredentialsClient } from "../relayer/RelayerCredentialsClient";
import { createRelayerAssertion } from "../relayer/webauthnAuth";
import { loadCredentialId } from "../storage";

export const OWS_CREDENTIALS_STORAGE_KEY = "ows.credentials.v2";

/** Minimal sync key/value API (localStorage or test double). */
export type CredentialStorageBackend = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type StoredBlob = {
  credentials: Record<string, StoredCredential>;
  revoked: string[];
  blobIds: Record<string, string>;
};

export interface ICachedRelayerCredentialRepositoryDeps {
  client: RelayerCredentialsClient;
  getSigner: () => OWSSigner;
  storageKey?: string;
  storage?: CredentialStorageBackend;
}

function summarize(
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

function isStoredCredential(value: unknown): value is StoredCredential {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.credentialId === "string" &&
    typeof record.payload === "string" &&
    typeof record.issuer === "string" &&
    Array.isArray(record.type)
  );
}

/**
 * Local plaintext cache + encrypted official copies on the 1Shot Relayer.
 * `list`/`get` read the cache; `store`/`delete`/`revoke` sync to the relayer;
 * `refreshFromRelayer` replaces the cache from recover.
 */
export class CachedRelayerCredentialRepository implements ICredentialRepository {
  private readonly client: RelayerCredentialsClient;
  private readonly getSigner: () => OWSSigner;
  private readonly storageKey: string;
  private readonly storage: CredentialStorageBackend;

  constructor(deps: ICachedRelayerCredentialRepositoryDeps) {
    this.client = deps.client;
    this.getSigner = deps.getSigner;
    this.storageKey = deps.storageKey ?? OWS_CREDENTIALS_STORAGE_KEY;
    this.storage =
      deps.storage ??
      (typeof localStorage !== "undefined"
        ? localStorage
        : createMemoryStorageBackend());
  }

  async store(credential: StoredCredential): Promise<void> {
    const blob = this.readBlob();
    const previousBlobId = blob.blobIds[credential.credentialId];
    blob.credentials[credential.credentialId] = credential;
    blob.revoked = blob.revoked.filter((id) => id !== credential.credentialId);
    this.writeBlob(blob);

    try {
      const signer = this.getSigner();
      const [ciphertext] = await signer.encryptAES256([
        JSON.stringify(credential),
      ]);
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
      next.blobIds[credential.credentialId] = id;
      this.writeBlob(next);
    } catch (error: unknown) {
      // Keep the local cache so OID4 accept still succeeds; Refresh can sync later.
      console.warn(
        "[credentials] local store ok; relayer upload failed",
        error,
      );
    }
  }

  async get(credentialId: CredentialId): Promise<StoredCredential | undefined> {
    const blob = this.readBlob();
    if (blob.revoked.includes(credentialId)) {
      return undefined;
    }
    return blob.credentials[credentialId];
  }

  async list(filter?: CredentialFilter): Promise<CredentialSummary[]> {
    const blob = this.readBlob();
    const active = Object.values(blob.credentials).filter(
      (c) => !blob.revoked.includes(c.credentialId),
    );
    return summarize(active, filter);
  }

  async delete(credentialId: CredentialId): Promise<void> {
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
        console.warn(
          "[credentials] failed to delete credential blob on relayer",
          error,
        );
      }
    }
  }

  async revoke(credentialId: CredentialId): Promise<void> {
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
        console.warn(
          "[credentials] failed to revoke credential blob on relayer",
          error,
        );
      }
    }
  }

  /**
   * Register this wallet's WebAuthn passkey with the relayer.
   * Call once at account creation while `passkeyPublicKey` is still available.
   * Later store/recover/delete only need `credentialId` + assertion.
   */
  async registerPasskey(publicKey: string): Promise<void> {
    const assertion = await this.assert();
    await this.client.registerPasskey({ ...assertion, publicKey });
  }

  /**
   * Pull recover blobs from the relayer, decrypt, and replace the local cache.
   * Requires the passkey to already be registered (done at wallet create).
   */
  async refreshFromRelayer(): Promise<void> {
    const assertion = await this.assert();
    const { credentials: remote } =
      await this.client.recoverCredentials(assertion);

    if (remote.length === 0) {
      this.writeBlob({ credentials: {}, revoked: [], blobIds: {} });
      return;
    }

    const signer = this.getSigner();
    const ciphertexts = remote.map((item) =>
      AES256CipherText(item.ciphertext),
    );
    const plaintexts = await signer.decryptAES256(ciphertexts);

    const credentials: Record<string, StoredCredential> = {};
    const blobIds: Record<string, string> = {};

    for (let i = 0; i < remote.length; i += 1) {
      const item = remote[i]!;
      const raw = plaintexts[i];
      if (typeof raw !== "string") continue;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isStoredCredential(parsed)) {
          console.warn(
            "[credentials] skipping undecryptable/invalid recovered blob",
            item.id,
          );
          continue;
        }
        credentials[parsed.credentialId] = parsed;
        blobIds[parsed.credentialId] = item.id;
      } catch (error: unknown) {
        console.warn(
          "[credentials] failed to parse recovered credential",
          item.id,
          error,
        );
      }
    }

    this.writeBlob({ credentials, revoked: [], blobIds });
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

  private readBlob(): StoredBlob {
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) {
      return { credentials: {}, revoked: [], blobIds: {} };
    }

    try {
      const parsed = JSON.parse(raw) as StoredBlob;
      return {
        credentials:
          parsed && typeof parsed.credentials === "object"
            ? (parsed.credentials ?? {})
            : {},
        revoked: Array.isArray(parsed.revoked) ? parsed.revoked : [],
        blobIds:
          parsed && typeof parsed.blobIds === "object"
            ? (parsed.blobIds ?? {})
            : {},
      };
    } catch {
      return { credentials: {}, revoked: [], blobIds: {} };
    }
  }

  private writeBlob(blob: StoredBlob): void {
    const credCount = Object.keys(blob.credentials).length;
    const blobCount = Object.keys(blob.blobIds).length;
    if (credCount === 0 && blob.revoked.length === 0 && blobCount === 0) {
      this.storage.removeItem(this.storageKey);
      return;
    }
    this.storage.setItem(this.storageKey, JSON.stringify(blob));
  }
}

/** In-memory backend for Node tests and SSR fallbacks. */
export function createMemoryStorageBackend(): CredentialStorageBackend {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}
