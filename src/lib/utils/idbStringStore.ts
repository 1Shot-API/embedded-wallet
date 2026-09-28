/**
 * Async string KV on IndexedDB (`oneshot-wallet` / `kv`).
 *
 * Used for large wallet caches (vault, tracked assets, activity) and for
 * values that should not live in localStorage (e.g. delegation binding).
 * Same-origin XSS can still read IDB — the win is quota and async I/O.
 */

const DB_NAME = "oneshot-wallet";
const STORE_NAME = "kv";
const DB_VERSION = 1;

/** IndexedDB key for the client delegation-binding secret. */
export const DELEGATION_BINDING_IDB_KEY = "oneshot.dbind";

/** Default cache keys (also used as localStorage legacy keys for migration). */
export const VAULT_CACHE_KEY = "ows.vault.v1";
export const TRACKED_ASSETS_CACHE_KEY = "ows.tracked-assets.v2";
export const ASSET_ACTIVITY_CACHE_KEY = "ows.asset-activity.v1";

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

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () =>
      reject(request.error ?? new Error("indexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function idbGetString(key: string): Promise<string | undefined> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onerror = () =>
        reject(request.error ?? new Error("indexedDB get failed"));
      request.onsuccess = () => {
        const value = request.result;
        resolve(typeof value === "string" ? value : undefined);
      };
    });
  } finally {
    db.close();
  }
}

export async function idbSetString(key: string, value: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const request = tx.objectStore(STORE_NAME).put(value, key);
      request.onerror = () =>
        reject(request.error ?? new Error("indexedDB put failed"));
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error("indexedDB transaction failed"));
    });
  } finally {
    db.close();
  }
}

export async function idbRemoveString(key: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const request = tx.objectStore(STORE_NAME).delete(key);
      request.onerror = () =>
        reject(request.error ?? new Error("indexedDB delete failed"));
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error("indexedDB transaction failed"));
    });
  } finally {
    db.close();
  }
}

export async function idbClearKeys(keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      for (const key of keys) {
        store.delete(key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error("indexedDB clearKeys failed"));
    });
  } finally {
    db.close();
  }
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
