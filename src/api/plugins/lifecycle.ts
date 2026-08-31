/**
 * Plugin lifecycle registry. A plugin's main.js registers its hooks via
 * `xcoder.setPluginInit(id, init)` / `xcoder.setPluginUnmount(id, unmount)`;
 * the manager waits for them after script evaluation.
 */
export type PluginInitFn = (baseUrl: string, page: PluginPage, cache: PluginCache) => void | Promise<void>;

export interface PluginPage extends HTMLElement {
  setTitle(title: string): void;
  show(): void;
  close(): void;
}

export interface PluginCache {
  cacheFileUrl: string;
  cacheFile: { write(content: string): Promise<void>; read(): Promise<string> };
  firstInit: boolean;
}

const inits = new Map<string, PluginInitFn>();
const unmounts = new Map<string, () => void>();

export function setPluginInit(id: string, init: PluginInitFn): void {
  inits.set(id, init);
}

export function setPluginUnmount(id: string, unmount: () => void): void {
  unmounts.set(id, unmount);
}

export function getPluginInit(id: string): PluginInitFn | undefined {
  return inits.get(id);
}

export function getPluginUnmount(id: string): (() => void) | undefined {
  return unmounts.get(id);
}

export function clearPluginHooks(id: string): void {
  inits.delete(id);
  unmounts.delete(id);
}

/** Resolve after the plugin registered its init hook (classic scripts are async). */
export function waitForInit(id: string, timeoutMs = 4000): Promise<PluginInitFn> {
  return new Promise((resolve, reject) => {
    const existing = inits.get(id);
    if (existing) {
      resolve(existing);
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => {
      const fn = inits.get(id);
      if (fn) {
        clearInterval(timer);
        resolve(fn);
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error(`[plugins] "${id}" did not call xcoder.setPluginInit within ${timeoutMs}ms`));
      }
    }, 50);
  });
}
