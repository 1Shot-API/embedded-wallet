/**
 * Per-item IndexedDB persistence for the local vault cache.
 *
 * Object stores (DB v2): credentials, delegations, pendingEncrypted, vaultMeta.
 * Legacy monolithic `kv["ows.vault.v1"]` is migrated once on first load.
 */

import type { StoredCredential } from "@1shotapi/ows-types";

import type { IPendingEncryptedBlob } from "../interfaces/data/IVaultPendingDecrypt";
import type { IStoredDelegation } from "../types/domain/StoredDelegation";

import {
  CREDENTIALS_STORE_NAME,
  DELEGATIONS_STORE_NAME,
  KV_STORE_NAME,
  PENDING_ENCRYPTED_STORE_NAME,
  VAULT_CACHE_KEY,
  VAULT_META_STORE_NAME,
  VAULT_OBJECT_STORES,
  openWalletDb,
} from "./idbStringStore";

export const VAULT_META_KEY = "default";

export type IVaultCredentialRecord = StoredCredential & {
  remoteBlobId?: string;
};

export type IVaultDelegationRecord = IStoredDelegation & {
  remoteBlobId?: string;
};

export type IVaultMetaRecord = {
  revoked: string[];
  pendingTrackedAssetsUpload: boolean;
  /** Relayer blob id for the unencrypted tracked-assets payload. */
  trackedAssetsBlobId?: string;
};

/** In-memory vault snapshot assembled from object stores. */
export type IVaultSnapshot = {
  credentials: Record<string, StoredCredential>;
  delegations: Record<string, IStoredDelegation>;
  revoked: string[];
  /** Logical id → relayer blob id (credentials, delegations, trackedAssets). */
  blobIds: Record<string, string>;
  pendingEncrypted: IPendingEncryptedBlob[];
  pendingTrackedAssetsUpload: boolean;
};

export type IVaultStore = {
  loadAll(): Promise<IVaultSnapshot>;
  /** Persist only rows that differ from `prev` (targeted puts/deletes). */
  persistDiff(prev: IVaultSnapshot, next: IVaultSnapshot): Promise<void>;
  clear(): Promise<void>;
};

const TRACKED_ASSETS_LOGICAL_ID = "trackedAssets";

function emptySnapshot(): IVaultSnapshot {
  return {
    credentials: {},
    delegations: {},
    revoked: [],
    blobIds: {},
    pendingEncrypted: [],
    pendingTrackedAssetsUpload: false,
  };
}

function emptyMeta(): IVaultMetaRecord {
  return {
    revoked: [],
    pendingTrackedAssetsUpload: false,
  };
}

function cloneSnapshot(snapshot: IVaultSnapshot): IVaultSnapshot {
  return structuredClone(snapshot);
}

function recordEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function metaFromSnapshot(snapshot: IVaultSnapshot): IVaultMetaRecord {
  const trackedAssetsBlobId = snapshot.blobIds[TRACKED_ASSETS_LOGICAL_ID];
  return {
    revoked: [...snapshot.revoked],
    pendingTrackedAssetsUpload: snapshot.pendingTrackedAssetsUpload,
    ...(trackedAssetsBlobId ? { trackedAssetsBlobId } : {}),
  };
}

function snapshotFromStores(
  credentials: IVaultCredentialRecord[],
  delegations: IVaultDelegationRecord[],
  pendingEncrypted: IPendingEncryptedBlob[],
  meta: IVaultMetaRecord,
): IVaultSnapshot {
  const credentialsMap: Record<string, StoredCredential> = {};
  const delegationsMap: Record<string, IStoredDelegation> = {};
  const blobIds: Record<string, string> = {};

  for (const row of credentials) {
    const { remoteBlobId, ...credential } = row;
    credentialsMap[credential.credentialId] = credential as StoredCredential;
    if (remoteBlobId) {
      blobIds[credential.credentialId] = remoteBlobId;
    }
  }
  for (const row of delegations) {
    const { remoteBlobId, ...delegation } = row;
    delegationsMap[String(delegation.delegationId)] =
      delegation as IStoredDelegation;
    if (remoteBlobId) {
      blobIds[String(delegation.delegationId)] = remoteBlobId;
    }
  }
  if (meta.trackedAssetsBlobId) {
    blobIds[TRACKED_ASSETS_LOGICAL_ID] = meta.trackedAssetsBlobId;
  }

  return {
    credentials: credentialsMap,
    delegations: delegationsMap,
    revoked: Array.isArray(meta.revoked) ? meta.revoked : [],
    blobIds,
    pendingEncrypted: pendingEncrypted.map((p) => ({ ...p })),
    pendingTrackedAssetsUpload: meta.pendingTrackedAssetsUpload === true,
  };
}

function parseLegacyVaultBlob(raw: string): IVaultSnapshot {
  try {
    const parsed = JSON.parse(raw) as Partial<IVaultSnapshot>;
    const credentials =
      parsed && typeof parsed.credentials === "object"
        ? (parsed.credentials ?? {})
        : {};
    const delegations =
      parsed && typeof parsed.delegations === "object"
        ? (parsed.delegations ?? {})
        : {};
    const pendingEncrypted = Array.isArray(parsed.pendingEncrypted)
      ? parsed.pendingEncrypted.filter(
          (item): item is IPendingEncryptedBlob =>
            !!item &&
            typeof item === "object" &&
            typeof (item as IPendingEncryptedBlob).id === "string" &&
            typeof (item as IPendingEncryptedBlob).payload === "string" &&
            typeof (item as IPendingEncryptedBlob).createdTimestamp ===
              "number",
        )
      : [];
    return {
      credentials,
      delegations,
      revoked: Array.isArray(parsed.revoked) ? parsed.revoked : [],
      blobIds:
        parsed && typeof parsed.blobIds === "object"
          ? (parsed.blobIds ?? {})
          : {},
      pendingEncrypted,
      pendingTrackedAssetsUpload: parsed.pendingTrackedAssetsUpload === true,
    };
  } catch {
    return emptySnapshot();
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("indexedDB request failed"));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("indexedDB transaction failed"));
    tx.onabort = () =>
      reject(tx.error ?? new Error("indexedDB transaction aborted"));
  });
}

async function getAllFromStore<T>(
  db: IDBDatabase,
  storeName: string,
): Promise<T[]> {
  const tx = db.transaction(storeName, "readonly");
  const result = await requestToPromise(
    tx.objectStore(storeName).getAll() as IDBRequest<T[]>,
  );
  await transactionDone(tx);
  return result ?? [];
}

async function getMeta(db: IDBDatabase): Promise<IVaultMetaRecord> {
  const tx = db.transaction(VAULT_META_STORE_NAME, "readonly");
  const raw = await requestToPromise(
    tx.objectStore(VAULT_META_STORE_NAME).get(VAULT_META_KEY),
  );
  await transactionDone(tx);
  if (!raw || typeof raw !== "object") {
    return emptyMeta();
  }
  const record = raw as Partial<IVaultMetaRecord>;
  return {
    revoked: Array.isArray(record.revoked) ? record.revoked : [],
    pendingTrackedAssetsUpload: record.pendingTrackedAssetsUpload === true,
    ...(typeof record.trackedAssetsBlobId === "string"
      ? { trackedAssetsBlobId: record.trackedAssetsBlobId }
      : {}),
  };
}

/**
 * If `kv[ows.vault.v1]` still exists, split into object stores and delete the
 * legacy key. Also pulls a leftover localStorage copy when IDB kv is empty.
 */
export async function migrateVaultBlobV1ToStores(
  db: IDBDatabase,
): Promise<void> {
  const txRead = db.transaction(KV_STORE_NAME, "readonly");
  let legacy = await requestToPromise(
    txRead.objectStore(KV_STORE_NAME).get(VAULT_CACHE_KEY),
  );
  await transactionDone(txRead);

  if (typeof legacy !== "string" && typeof localStorage !== "undefined") {
    try {
      const fromLs = localStorage.getItem(VAULT_CACHE_KEY);
      if (fromLs) {
        legacy = fromLs;
        localStorage.removeItem(VAULT_CACHE_KEY);
      }
    } catch {
      // ignore
    }
  }

  if (typeof legacy !== "string") {
    return;
  }

  // Skip migration if structured stores already have data (partial upgrade).
  const existingCreds = await getAllFromStore(db, CREDENTIALS_STORE_NAME);
  const existingDels = await getAllFromStore(db, DELEGATIONS_STORE_NAME);
  const existingPending = await getAllFromStore(
    db,
    PENDING_ENCRYPTED_STORE_NAME,
  );
  if (
    existingCreds.length > 0 ||
    existingDels.length > 0 ||
    existingPending.length > 0
  ) {
    const txDel = db.transaction(KV_STORE_NAME, "readwrite");
    txDel.objectStore(KV_STORE_NAME).delete(VAULT_CACHE_KEY);
    await transactionDone(txDel);
    return;
  }

  const snapshot = parseLegacyVaultBlob(legacy);
  await writeFullSnapshot(db, snapshot);

  const txCleanup = db.transaction(KV_STORE_NAME, "readwrite");
  txCleanup.objectStore(KV_STORE_NAME).delete(VAULT_CACHE_KEY);
  await transactionDone(txCleanup);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(VAULT_CACHE_KEY);
    } catch {
      // ignore
    }
  }
}

async function writeFullSnapshot(
  db: IDBDatabase,
  snapshot: IVaultSnapshot,
): Promise<void> {
  const storeNames = [...VAULT_OBJECT_STORES];
  const tx = db.transaction(storeNames, "readwrite");
  const credStore = tx.objectStore(CREDENTIALS_STORE_NAME);
  const delStore = tx.objectStore(DELEGATIONS_STORE_NAME);
  const pendingStore = tx.objectStore(PENDING_ENCRYPTED_STORE_NAME);
  const metaStore = tx.objectStore(VAULT_META_STORE_NAME);

  credStore.clear();
  delStore.clear();
  pendingStore.clear();

  for (const [id, credential] of Object.entries(snapshot.credentials)) {
    const remoteBlobId = snapshot.blobIds[id];
    const record: IVaultCredentialRecord = {
      ...credential,
      ...(remoteBlobId ? { remoteBlobId } : {}),
    };
    credStore.put(record);
  }
  for (const [id, delegation] of Object.entries(snapshot.delegations)) {
    const remoteBlobId = snapshot.blobIds[id];
    const record: IVaultDelegationRecord = {
      ...delegation,
      ...(remoteBlobId ? { remoteBlobId } : {}),
    };
    delStore.put(record);
  }
  for (const pending of snapshot.pendingEncrypted) {
    pendingStore.put(pending);
  }
  metaStore.put(metaFromSnapshot(snapshot), VAULT_META_KEY);

  await transactionDone(tx);
}

async function persistDiffToDb(
  db: IDBDatabase,
  prev: IVaultSnapshot,
  next: IVaultSnapshot,
): Promise<void> {
  const tx = db.transaction([...VAULT_OBJECT_STORES], "readwrite");
  const credStore = tx.objectStore(CREDENTIALS_STORE_NAME);
  const delStore = tx.objectStore(DELEGATIONS_STORE_NAME);
  const pendingStore = tx.objectStore(PENDING_ENCRYPTED_STORE_NAME);
  const metaStore = tx.objectStore(VAULT_META_STORE_NAME);

  for (const id of Object.keys(prev.credentials)) {
    if (!(id in next.credentials)) {
      credStore.delete(id);
    }
  }
  for (const [id, credential] of Object.entries(next.credentials)) {
    const prevCred = prev.credentials[id];
    const prevBlobId = prev.blobIds[id];
    const nextBlobId = next.blobIds[id];
    if (
      !recordEqual(prevCred, credential) ||
      prevBlobId !== nextBlobId
    ) {
      const record: IVaultCredentialRecord = {
        ...credential,
        ...(nextBlobId ? { remoteBlobId: nextBlobId } : {}),
      };
      credStore.put(record);
    }
  }

  for (const id of Object.keys(prev.delegations)) {
    if (!(id in next.delegations)) {
      delStore.delete(id);
    }
  }
  for (const [id, delegation] of Object.entries(next.delegations)) {
    const prevDel = prev.delegations[id];
    const prevBlobId = prev.blobIds[id];
    const nextBlobId = next.blobIds[id];
    if (
      !recordEqual(prevDel, delegation) ||
      prevBlobId !== nextBlobId
    ) {
      const record: IVaultDelegationRecord = {
        ...delegation,
        ...(nextBlobId ? { remoteBlobId: nextBlobId } : {}),
      };
      delStore.put(record);
    }
  }

  const prevPendingIds = new Set(prev.pendingEncrypted.map((p) => p.id));
  const nextPendingIds = new Set(next.pendingEncrypted.map((p) => p.id));
  for (const id of prevPendingIds) {
    if (!nextPendingIds.has(id)) {
      pendingStore.delete(id);
    }
  }
  for (const pending of next.pendingEncrypted) {
    const prevItem = prev.pendingEncrypted.find((p) => p.id === pending.id);
    if (!recordEqual(prevItem, pending)) {
      pendingStore.put(pending);
    }
  }

  const prevMeta = metaFromSnapshot(prev);
  const nextMeta = metaFromSnapshot(next);
  if (!recordEqual(prevMeta, nextMeta)) {
    metaStore.put(nextMeta, VAULT_META_KEY);
  }

  await transactionDone(tx);
}

async function clearVaultStores(db: IDBDatabase): Promise<void> {
  const tx = db.transaction(
    [...VAULT_OBJECT_STORES, KV_STORE_NAME],
    "readwrite",
  );
  for (const name of VAULT_OBJECT_STORES) {
    tx.objectStore(name).clear();
  }
  tx.objectStore(KV_STORE_NAME).delete(VAULT_CACHE_KEY);
  await transactionDone(tx);
}

/** Production IndexedDB-backed vault store. */
export function createIdbVaultStore(): IVaultStore {
  return {
    async loadAll(): Promise<IVaultSnapshot> {
      const db = await openWalletDb();
      await migrateVaultBlobV1ToStores(db);
      const [credentials, delegations, pendingEncrypted, meta] =
        await Promise.all([
          getAllFromStore<IVaultCredentialRecord>(db, CREDENTIALS_STORE_NAME),
          getAllFromStore<IVaultDelegationRecord>(db, DELEGATIONS_STORE_NAME),
          getAllFromStore<IPendingEncryptedBlob>(
            db,
            PENDING_ENCRYPTED_STORE_NAME,
          ),
          getMeta(db),
        ]);
      return snapshotFromStores(
        credentials,
        delegations,
        pendingEncrypted,
        meta,
      );
    },

    async persistDiff(
      prev: IVaultSnapshot,
      next: IVaultSnapshot,
    ): Promise<void> {
      const db = await openWalletDb();
      await persistDiffToDb(db, prev, next);
    },

    async clear(): Promise<void> {
      const db = await openWalletDb();
      await clearVaultStores(db);
    },
  };
}

/** In-memory vault store for tests / SSR. */
export function createMemoryVaultStore(
  initial?: IVaultSnapshot,
): IVaultStore {
  let snapshot = initial ? cloneSnapshot(initial) : emptySnapshot();
  return {
    async loadAll(): Promise<IVaultSnapshot> {
      return cloneSnapshot(snapshot);
    },
    async persistDiff(
      _prev: IVaultSnapshot,
      next: IVaultSnapshot,
    ): Promise<void> {
      snapshot = cloneSnapshot(next);
    },
    async clear(): Promise<void> {
      snapshot = emptySnapshot();
    },
  };
}

/** Clear vault object stores + legacy `ows.vault.v1` kv key (Change Account). */
export async function idbClearVaultStores(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openWalletDb();
  await clearVaultStores(db);
}

export { emptySnapshot as emptyVaultSnapshot, cloneSnapshot as cloneVaultSnapshot };
