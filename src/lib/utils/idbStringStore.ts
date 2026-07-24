/**
 * Tiny IndexedDB string KV — used for values that must not live in
 * `localStorage` / `sessionStorage` (XSS-readable by default scrapers).
 */

const DB_NAME = "oneshot-wallet";
const STORE_NAME = "kv";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("indexedDB open failed"));
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
      request.onerror = () => reject(request.error ?? new Error("indexedDB get failed"));
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
      request.onerror = () => reject(request.error ?? new Error("indexedDB put failed"));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("indexedDB transaction failed"));
    });
  } finally {
    db.close();
  }
}
