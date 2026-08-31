/**
 * Persistent key/value storage.
 * Primary: IndexedDB. Fallback: in-memory Map (Node tests, private mode, errors).
 */

export interface KVStore {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}

class MemoryStore implements KVStore {
  readonly persistent = false;
  private map = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.map.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
  async keys(): Promise<string[]> {
    return [...this.map.keys()].sort();
  }
  async clear(): Promise<void> {
    this.map.clear();
  }
}

const DB_NAME = 'xcoder';
const STORE_NAME = 'kv';

class IndexedDBStore implements KVStore {
  readonly persistent = true;
  private db: IDBDatabase | null = null;
  private opening: Promise<IDBDatabase | null> | null = null;

  private open(): Promise<IDBDatabase | null> {
    if (this.db) return Promise.resolve(this.db);
    if (this.opening) return this.opening;
    const attempt = new Promise<IDBDatabase | null>((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore(STORE_NAME);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    this.opening = attempt.then((db) => {
      this.db = db;
      this.opening = null;
      return db;
    });
    return this.opening;
  }

  private async tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
    const db = await this.open();
    if (!db) return undefined;
    return new Promise((resolve, reject) => {
      try {
        const t = db.transaction(STORE_NAME, mode);
        const req = fn(t.objectStore(STORE_NAME));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB error'));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      return await this.tx<T>('readonly', (s) => s.get(key) as IDBRequest<T>);
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await this.tx('readwrite', (s) => s.put(value as never, key) as IDBRequest<unknown>);
    } catch (err) {
      console.warn('[storage] write failed, falling back to memory', err);
      memoryFallback.set(key, value);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.tx('readwrite', (s) => s.delete(key));
    } catch {
      /* ignore */
    }
  }

  async keys(): Promise<string[]> {
    try {
      const keys = await this.tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
      return (keys ?? []).map(String).sort();
    } catch {
      return [];
    }
  }

  async clear(): Promise<void> {
    try {
      await this.tx('readwrite', (s) => s.clear());
    } catch {
      /* ignore */
    }
  }
}

const memoryFallback = new Map<string, unknown>();
const idb = new IndexedDBStore();

/** Combined store: IndexedDB first, memory fallback on any failure. */
class HybridStore implements KVStore {
  async get<T>(key: string): Promise<T | undefined> {
    if (memoryFallback.has(key)) return memoryFallback.get(key) as T;
    const v = await idb.get<T>(key);
    if (v !== undefined) return v;
    return undefined;
  }
  async set<T>(key: string, value: T): Promise<void> {
    memoryFallback.set(key, value);
    await idb.set(key, value);
  }
  async delete(key: string): Promise<void> {
    memoryFallback.delete(key);
    await idb.delete(key);
  }
  async keys(): Promise<string[]> {
    const a = await idb.keys();
    const set = new Set([...a, ...memoryFallback.keys()]);
    return [...set].sort();
  }
  async clear(): Promise<void> {
    memoryFallback.clear();
    await idb.clear();
  }
}

/** Named store factory (each plugin / subsystem can own a namespace). */
export function createStore(namespace: string): KVStore {
  const prefix = `${namespace}::`;
  return {
    async get<T>(key: string): Promise<T | undefined> {
      return storage.get<T>(prefix + key);
    },
    async set<T>(key: string, value: T): Promise<void> {
      return storage.set(prefix + key, value);
    },
    async delete(key: string): Promise<void> {
      return storage.delete(prefix + key);
    },
    async keys(): Promise<string[]> {
      return (await storage.keys()).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
    },
    async clear(): Promise<void> {
      for (const key of await this.keys()) await storage.delete(prefix + key);
    },
  };
}

/** Global store used for settings, sessions, git state, plugins… */
export const storage: KVStore = new HybridStore();
export const memoryStore: KVStore = new MemoryStore();
