/**
 * Persistent key-value cache. Plugin-facing docs call this the `cache` module.
 */
import { KVStore } from '@lib/storage';

const store = new KVStore('kv');

export async function get<T>(key: string, fallback?: T): Promise<T> {
  return store.get<T>(key, fallback);
}

export async function set(key: string, value: unknown): Promise<void> {
  await store.set(key, value);
}

export async function remove(key: string): Promise<void> {
  await store.remove(key);
}

export async function clear(prefix?: string): Promise<void> {
  if (prefix) {
    for (const k of await store.keys()) {
      if (k.startsWith(prefix)) await store.remove(k);
    }
  } else {
    await store.clear();
  }
}
