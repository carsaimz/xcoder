/** Small shared helpers. */

export function debounce<A extends unknown[]>(fn: (...args: A) => void, waitMs: number): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let uidCounter = 0;
export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${(uidCounter++).toString(36)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function deepMerge<T extends object>(base: T, patch: Partial<T>): T {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch)) {
    const b = out[key];
    if (
      value && typeof value === 'object' && !Array.isArray(value) &&
      b && typeof b === 'object' && !Array.isArray(b)
    ) {
      out[key] = deepMerge(b as object, value as object);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as T;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Natural sort comparison ("a2" < "a10"). */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function isMobile(): boolean {
  return /Android|iPhone|iPad|Mobile/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');
}

/** Unicode-safe base64 encode (btoa fails on multi-byte chars). */
export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
