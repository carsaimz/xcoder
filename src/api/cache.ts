/** Tiny TTL cache used by fs metadata, LSP and AI calls. */

interface Entry<T> {
  value: T;
  expires: number;
}

export class TTLCache<T = unknown> {
  private map = new Map<string, Entry<T>>();

  constructor(private ttlMs = 30_000, private maxEntries = 200) {}

  get(key: string): T | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expires) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T, ttlMs = this.ttlMs): void {
    if (this.map.size >= this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest) this.map.delete(oldest);
    }
    this.map.set(key, { value, expires: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}

export const cache = new TTLCache(30_000);
