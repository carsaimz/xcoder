/**
 * Plugin system — zip packages (JSZip), sandboxed-ish loading through the
 * `xcoder` facade, lifecycle hooks, page registration and enable/disable.
 *
 * plugin.json shape:
 * {
 *   "id": "my-plugin", "name": "My Plugin", "version": "0.1.0",
 *   "main": "main.js", "activationEvents": ["onLoad"]
 * }
 */

import JSZip from 'jszip';
import { storage } from '../lib/storage';
import { bus } from '../lib/events';
import { t } from '../lib/i18n';
import { toast } from './toast';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  main: string;
  description?: string;
  activationEvents?: string[];
}

export interface PluginRecord {
  manifest: PluginManifest;
  enabled: boolean;
  installedAt: number;
}

export interface PluginContext {
  /** module facade — same object as xcoder.require */
  require(name: string): unknown;
  /** register a full-screen page (iframe html) shown in the main area */
  registerPage(id: string, html: string): void;
  log(...args: unknown[]): void;
}

interface LoadedPlugin {
  record: PluginRecord;
  instance?: {
    onLoad?: (ctx: PluginContext) => void;
    onUnload?: () => void;
    dispose?: () => void;
  };
  pages: string[];
}

const PAGES: Map<string, string> = new Map();

export class PluginManager {
  private plugins = new Map<string, LoadedPlugin>();

  async loadInstalled(): Promise<void> {
    const records = (await storage.get<PluginRecord[]>('plugins')) ?? [];
    for (const record of records) {
      const loaded: LoadedPlugin = { record, pages: [] };
      this.plugins.set(record.manifest.id, loaded);
      if (record.enabled) await this.activate(record.manifest.id);
    }
    bus.emit('plugins:changed', this.list());
  }

  list(): PluginRecord[] {
    return [...this.plugins.values()].map((p) => p.record);
  }

  getPageHtml(id: string): string | undefined {
    return PAGES.get(id);
  }

  private async saveRecords(): Promise<void> {
    await storage.set('plugins', this.list());
  }

  private async activate(id: string): Promise<boolean> {
    const loaded = this.plugins.get(id);
    if (!loaded || loaded.instance) return false;
    try {
      const codeKey = `plugin:code:${id}`;
      const code = (await storage.get<string>(codeKey)) ?? '';
      const ctx: PluginContext = {
        require: (name: string) => {
          // lazy import to avoid a cycle at module init
          const { xcoder } = requireFacade();
          return xcoder.require(name);
        },
        registerPage: (pageId: string, html: string) => {
          PAGES.set(`${id}:${pageId}`, html);
          loaded.pages.push(`${id}:${pageId}`);
        },
        log: (...args: unknown[]) => console.info(`[plugin:${id}]`, ...args),
      };
      const factory = new Function('xcoder', 'plugin', `"use strict";\n${code}\nreturn typeof plugin !== 'undefined' ? plugin : null;`);
      const instance = factory(undefined, undefined) as LoadedPlugin['instance'];
      loaded.instance = instance ?? {};
      loaded.instance?.onLoad?.(ctx);
      bus.emit('plugin:activated', id);
      return true;
    } catch (err) {
      console.error(`[plugins] failed to activate ${id}`, err);
      toast(`Plugin ${id}: ${(err as Error).message}`, 'error');
      return false;
    }
  }

  private deactivate(id: string): void {
    const loaded = this.plugins.get(id);
    if (!loaded) return;
    try {
      loaded.instance?.onUnload?.();
      loaded.instance?.dispose?.();
    } catch (err) {
      console.warn(`[plugins] unload error for ${id}`, err);
    }
    for (const page of loaded.pages) PAGES.delete(page);
    loaded.instance = undefined;
    bus.emit('plugin:deactivated', id);
  }

  /** Install a plugin from a zip archive. */
  async installFromZip(data: ArrayBuffer | Blob): Promise<PluginRecord> {
    const zip = await JSZip.loadAsync(data);
    const manifestFile = zip.file('plugin.json');
    if (!manifestFile) {
      throw new Error(t('plugins.invalidPluginJson'));
    }
    let manifest: PluginManifest;
    try {
      manifest = JSON.parse(await manifestFile.async('string')) as PluginManifest;
    } catch {
      throw new Error(t('plugins.invalidPluginJson'));
    }
    if (!manifest.id || !manifest.main) throw new Error(t('plugins.invalidPluginJson'));
    const mainFile = zip.file(manifest.main);
    if (!mainFile) throw new Error(`main file not found: ${manifest.main}`);
    const code = await mainFile.async('string');

    const record: PluginRecord = {
      manifest,
      enabled: true,
      installedAt: Date.now(),
    };
    await storage.set(`plugin:code:${manifest.id}`, code);
    this.plugins.set(manifest.id, { record, pages: [] });
    await this.saveRecords();
    await this.activate(manifest.id);
    bus.emit('plugins:changed', this.list());
    return record;
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const loaded = this.plugins.get(id);
    if (!loaded) return;
    loaded.record.enabled = enabled;
    await this.saveRecords();
    if (enabled) await this.activate(id);
    else this.deactivate(id);
    bus.emit('plugins:changed', this.list());
  }

  async uninstall(id: string): Promise<void> {
    this.deactivate(id);
    this.plugins.delete(id);
    await storage.delete(`plugin:code:${id}`);
    await this.saveRecords();
    bus.emit('plugins:changed', this.list());
  }

  /** Dev helper: install a plugin from a source string (used by tests). */
  async installFromSource(manifest: PluginManifest, code: string): Promise<PluginRecord> {
    const record: PluginRecord = { manifest, enabled: true, installedAt: Date.now() };
    await storage.set(`plugin:code:${manifest.id}`, code);
    this.plugins.set(manifest.id, { record, pages: [] });
    await this.saveRecords();
    await this.activate(manifest.id);
    bus.emit('plugins:changed', this.list());
    return record;
  }
}

// Late-bound to avoid an import cycle (registry → plugins → registry).
let facadeGetter: (() => { xcoder: { require(name: string): unknown } }) | null = null;
export function bindFacade(getter: () => { xcoder: { require(name: string): unknown } }): void {
  facadeGetter = getter;
}
function requireFacade() {
  if (!facadeGetter) throw new Error('facade not bound');
  return facadeGetter();
}

export const plugins = new PluginManager();
