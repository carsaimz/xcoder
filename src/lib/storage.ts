/**
 * Tiny IndexedDB wrapper + graceful in-memory fallback (Node/tests).
 * All app persistence (settings, cache, browser FS, plugins) goes through here.
 */

const DB_NAME = 'xcoder';
const DB_VERSION = 1;

export type StoreName = 'kv' | 'fs-nodes' | 'fs-content' | 'plugins';

const memoryFallback = new Map<string, Map<string, unknown>>();
function memStore(store: string): Map<string, unknown> {
  let m = memoryFallback.get(store);
  if (!m) {
    m = new Map();
    memoryFallback.set(store, m);
  }
  return m;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const store of ['kv', 'fs-nodes', 'fs-content', 'plugins'] as StoreName[]) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store);
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn('[xcoder] IndexedDB unavailable, using memory fallback');
        resolve(null);
      };
    });
  }
  return dbPromise;
}

function tx<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (os: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        if (!db) {
          reject(new Error('no-idb'));
          return;
        }
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('idb-error'));
      })
  );
}

async function fallbackGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  return memStore(store).get(key) as T | undefined;
}
async function fallbackSet(store: StoreName, key: string, value: unknown): Promise<void> {
  memStore(store).set(key, value);
}
async function fallbackDel(store: StoreName, key: string): Promise<void> {
  memStore(store).delete(key);
}
async function fallbackKeys(store: StoreName): Promise<string[]> {
  return [...memStore(store).keys()];
}

export async function idbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  try {
    const v = await tx<T>(store, 'readonly', (os) => os.get(key));
    return v;
  } catch {
    return fallbackGet<T>(store, key);
  }
}

export async function idbSet(store: StoreName, key: string, value: unknown): Promise<void> {
  try {
    await tx(store, 'readwrite', (os) => os.put(value, key));
  } catch {
    await fallbackSet(store, key, value);
  }
}

export async function idbDel(store: StoreName, key: string): Promise<void> {
  try {
    await tx(store, 'readwrite', (os) => os.delete(key));
  } catch {
    await fallbackDel(store, key);
  }
}

export async function idbKeys(store: StoreName): Promise<string[]> {
  try {
    const keys = await tx<IDBValidKey[]>(store, 'readonly', (os) => os.getAllKeys());
    return keys.map(String);
  } catch {
    return fallbackKeys(store);
  }
}

/** Namespaced key-value store (settings, plugin data, session state). */
export class KVStore {
  constructor(private store: StoreName, private prefix = '') {}

  async get<T>(key: string, fallback?: T): Promise<T> {
    const raw = await idbGet<T>(this.store, this.prefix + key);
    return raw === undefined ? (fallback as T) : raw;
  }

  async set(key: string, value: unknown): Promise<void> {
    await idbSet(this.store, this.prefix + key, value);
  }

  async remove(key: string): Promise<void> {
    await idbDel(this.store, this.prefix + key);
  }

  async keys(): Promise<string[]> {
    const all = await idbKeys(this.store);
    return all
      .filter((k) => k.startsWith(this.prefix))
      .map((k) => k.slice(this.prefix.length));
  }

  /** Delete every entry with the prefix (or everything when no prefix). */
  async clear(): Promise<void> {
    for (const k of await this.keys()) await idbDel(this.store, this.prefix + k);
  }
}
