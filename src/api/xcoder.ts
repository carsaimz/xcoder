/**
 * The global `xcoder` object — single entry point for plugins.
 */
import { requireModule, moduleNames } from './registry';
import { setPluginInit, setPluginUnmount } from './plugins/lifecycle';
import pkg from '../../package.json';

export interface XCoderGlobal {
  require<T = unknown>(name: string): T;
  setPluginInit(id: string, init: Parameters<typeof setPluginInit>[1]): void;
  setPluginUnmount(id: string, unmount: () => void): void;
  readonly version: string;
  readonly isAndroid: boolean;
}

export const xcoder: XCoderGlobal = {
  require: requireModule,
  setPluginInit,
  setPluginUnmount,
  get version(): string {
    return (pkg as { version: string }).version;
  },
  get isAndroid(): boolean {
    return typeof window !== 'undefined' && !!(window as { cordova?: unknown }).cordova;
  }
};

/** Attach to window (boot step). */
export function installGlobal(): void {
  (window as unknown as { xcoder: XCoderGlobal }).xcoder = xcoder;
  if (typeof console !== 'undefined') {
    console.info(`[xcoder] v${xcoder.version} — modules: ${moduleNames().join(', ')}`);
  }
}
