/**
 * Async string KV on IndexedDB (`oneshot-wallet` / `kv`).
 *
 * Used for small caches (tracked assets, activity) and values that should not
 * live in localStorage (e.g. delegation binding). Vault plaintext lives in
 * dedicated object stores — see {@link ./idbVaultStore}.
 * Same-origin XSS can still read IDB — the win is quota and async I/O.
 */

const DB_NAME = "oneshot-wallet";
/** Bumped when vault per-item stores were added. */
export const WALLET_IDB_VERSION = 2;

export const KV_STORE_NAME = "kv";
export const CREDENTIALS_STORE_NAME = "credentials";
export const DELEGATIONS_STORE_NAME = "delegations";
export const PENDING_ENCRYPTED_STORE_NAME = "pendingEncrypted";
export const VAULT_META_STORE_NAME = "vaultMeta";

export const VAULT_OBJECT_STORES = [
  CREDENTIALS_STORE_NAME,
  DELEGATIONS_STORE_NAME,
  PENDING_ENCRYPTED_STORE_NAME,
  VAULT_META_STORE_NAME,
] as const;

/** IndexedDB key for the client delegation-binding secret. */
export const DELEGATION_BINDING_IDB_KEY = "oneshot.dbind";

/** Legacy monolithic vault blob key (migrated into object stores). */
export const VAULT_CACHE_KEY = "ows.vault.v1";
export const TRACKED_ASSETS_CACHE_KEY = "ows.tracked-assets.v2";
export const ASSET_ACTIVITY_CACHE_KEY = "ows.asset-activity.v1";

/** String keys in `kv` cleared on Change Account (vault uses object stores). */
export const WALLET_IDB_CACHE_KEYS = [
  VAULT_CACHE_KEY,
  TRACKED_ASSETS_CACHE_KEY,
  ASSET_ACTIVITY_CACHE_KEY,
  DELEGATION_BINDING_IDB_KEY,
] as const;

export type AsyncKvStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function upgradeWalletDb(db: IDBDatabase, oldVersion: number): void {
  if (!db.objectStoreNames.contains(KV_STORE_NAME)) {
    db.createObjectStore(KV_STORE_NAME);
  }
  if (oldVersion < 2) {
    if (!db.objectStoreNames.contains(CREDENTIALS_STORE_NAME)) {
      db.createObjectStore(CREDENTIALS_STORE_NAME, { keyPath: "credentialId" });
    }
    if (!db.objectStoreNames.contains(DELEGATIONS_STORE_NAME)) {
      db.createObjectStore(DELEGATIONS_STORE_NAME, { keyPath: "delegationId" });
    }
    if (!db.objectStoreNames.contains(PENDING_ENCRYPTED_STORE_NAME)) {
      db.createObjectStore(PENDING_ENCRYPTED_STORE_NAME, { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains(VAULT_META_STORE_NAME)) {
      db.createObjectStore(VAULT_META_STORE_NAME);
    }
  }
}

/** Shared IndexedDB connection for the wallet origin. */
export function openWalletDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("indexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, WALLET_IDB_VERSION);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error ?? new Error("indexedDB open failed"));
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onupgradeneeded = (event) => {
        upgradeWalletDb(
          request.result,
          (event as IDBVersionChangeEvent).oldVersion,
        );
      };
    });
  }
  return dbPromise;
}

/** @deprecated Prefer {@link openWalletDb}; kept for call-site clarity. */
export function openDb(): Promise<IDBDatabase> {
  return openWalletDb();
}

export async function idbGetString(key: string): Promise<string | undefined> {
  const db = await openWalletDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KV_STORE_NAME, "readonly");
    const request = tx.objectStore(KV_STORE_NAME).get(key);
    request.onerror = () =>
      reject(request.error ?? new Error("indexedDB get failed"));
    request.onsuccess = () => {
      const value = request.result;
      resolve(typeof value === "string" ? value : undefined);
    };
  });
}

export async function idbSetString(key: string, value: string): Promise<void> {
  const db = await openWalletDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(KV_STORE_NAME, "readwrite");
    const request = tx.objectStore(KV_STORE_NAME).put(value, key);
    request.onerror = () =>
      reject(request.error ?? new Error("indexedDB put failed"));
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("indexedDB transaction failed"));
  });
}

export async function idbRemoveString(key: string): Promise<void> {
  const db = await openWalletDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(KV_STORE_NAME, "readwrite");
    const request = tx.objectStore(KV_STORE_NAME).delete(key);
    request.onerror = () =>
      reject(request.error ?? new Error("indexedDB delete failed"));
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("indexedDB transaction failed"));
  });
}

export async function idbClearKeys(keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return;
  const db = await openWalletDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(KV_STORE_NAME, "readwrite");
    const store = tx.objectStore(KV_STORE_NAME);
    for (const key of keys) {
      store.delete(key);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("indexedDB clearKeys failed"));
  });
}

/** Production backend: IndexedDB string KV. */
export function createIdbKvBackend(): AsyncKvStore {
  return {
    async getItem(key: string): Promise<string | null> {
      const value = await idbGetString(key);
      return value === undefined ? null : value;
    },
    async setItem(key: string, value: string): Promise<void> {
      await idbSetString(key, value);
    },
    async removeItem(key: string): Promise<void> {
      await idbRemoveString(key);
    },
  };
}

/** In-memory async Map for tests / SSR. */
export function createMemoryAsyncKvStore(
  initial?: Iterable<readonly [string, string]>,
): AsyncKvStore {
  const map = new Map<string, string>(initial);
  return {
    async getItem(key: string): Promise<string | null> {
      return map.has(key) ? map.get(key)! : null;
    },
    async setItem(key: string, value: string): Promise<void> {
      map.set(key, value);
    },
    async removeItem(key: string): Promise<void> {
      map.delete(key);
    },
  };
}

/**
 * If IndexedDB has no value for `key` but localStorage does, copy once and
 * remove the localStorage entry.
 */
export async function migrateLocalStorageKeyToIdb(
  store: AsyncKvStore,
  key: string,
): Promise<void> {
  const existing = await store.getItem(key);
  if (existing != null) return;
  if (typeof localStorage === "undefined") return;
  try {
    const legacy = localStorage.getItem(key);
    if (legacy == null) return;
    await store.setItem(key, legacy);
    localStorage.removeItem(key);
  } catch {
    // localStorage may be unavailable
  }
}
