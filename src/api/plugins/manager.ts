/**
 * Plugin manager — install (ZIP or directory), enable/disable with classic
 * script loading, uninstall. Plugin files live in the memory FS under
 * `memory:///plugins/<id>/`; the entry file is evaluated as a classic script
 * whose hooks were pre-registered via the lifecycle registry.
 */
import JSZip from 'jszip';
import * as fs from '@core/file/fs';
import { KVStore } from '@lib/storage';
import { events } from '@api/events';
import { toast } from '@api/toast';
import type { PluginManifest, PluginRecord } from './manifest';
import {
  createPluginPage,
  destroyPluginPage,
  mountPages
} from './page';
import {
  type PluginCache,
  type PluginInitFn,
  clearPluginHooks,
  getPluginInit,
  getPluginUnmount,
  waitForInit
} from './lifecycle';

const store = new KVStore('kv', 'plugins:');
const SCRIPT_BASE = 'memory:///plugins';
const running = new Map<string, { script: HTMLScriptElement; blobUrl: string; page: ReturnType<typeof createPluginPage> }>();

function pluginDir(id: string): string {
  return `${SCRIPT_BASE}/${id}`;
}

async function readRecords(): Promise<PluginRecord[]> {
  return (await store.get<PluginRecord[]>('records')) ?? [];
}

async function writeRecords(records: PluginRecord[]): Promise<void> {
  await store.set('records', records);
}

export class PluginLoadError extends Error {}

/** Fetch manifest+entry from a directory URL. */
async function installFromDir(dirUrl: string): Promise<{ manifest: PluginManifest; files: Record<string, string> }> {
  const base = dirUrl.endsWith('/') ? dirUrl : `${dirUrl}/`;
  const res = await fetch(`${base}plugin.json`);
  if (!res.ok) throw new PluginLoadError(`plugin.json not found at ${base}`);
  const manifest = (await res.json()) as PluginManifest;
  const mainRes = await fetch(`${base}${manifest.main}`);
  if (!mainRes.ok) throw new PluginLoadError(`entry "${manifest.main}" not found at ${base}`);
  return { manifest, files: { [manifest.main]: await mainRes.text() } };
}

/** Fetch a ZIP and extract text files (plugin.json at root). */
async function installFromZip(zipUrl: string): Promise<{ manifest: PluginManifest; files: Record<string, string> }> {
  const res = await fetch(zipUrl);
  if (!res.ok) throw new PluginLoadError(`ZIP not reachable: ${zipUrl}`);
  const zip = await JSZip.loadAsync(await res.arrayBuffer());
  const manifestFile = zip.file('plugin.json') ?? zip.file(/^[^/]*\/plugin.json$/)[0];
  if (!manifestFile) throw new PluginLoadError('plugin.json not found in ZIP');
  const manifest = JSON.parse(await manifestFile.async('string')) as PluginManifest;
  const rootPrefix = manifestFile.name.replace(/plugin\.json$/, '');
  const files: Record<string, string> = {};
  zip.forEach((path, entry) => {
    if (entry.dir) return;
    const rel = path.startsWith(rootPrefix) ? path.slice(rootPrefix.length) : path;
    if (/\.(png|jpe?g|gif|webp|ico|woff2?|ttf|mp3)$/i.test(rel)) return; // binaries skipped
    files[rel] = '';
  });
  for (const rel of Object.keys(files)) {
    const f = zip.file(`${rootPrefix}${rel}`) ?? zip.file(rel);
    files[rel] = f ? await f.async('string') : '';
  }
  return { manifest, files };
}

async function materialize(id: string, manifest: PluginManifest, files: Record<string, string>): Promise<string> {
  const dir = pluginDir(id);
  await fs.createDir(dir);
  for (const [rel, content] of Object.entries(files)) {
    const url = `${dir}/${rel}`;
    const parent = url.slice(0, url.lastIndexOf('/'));
    await fs.createDir(parent);
    await fs.write(url, content);
  }
  await fs.write(`${dir}/plugin.json`, JSON.stringify(manifest, null, 2));
  return `${dir}/`;
}

export const pluginsManager = {
  mountPages,

  async list(): Promise<PluginRecord[]> {
    return readRecords();
  },

  async get(id: string): Promise<PluginRecord | undefined> {
    return (await readRecords()).find((r) => r.id === id);
  },

  async install(source: { zipUrl?: string; dirUrl?: string }): Promise<PluginRecord> {
    const { manifest, files } = source.zipUrl
      ? await installFromZip(source.zipUrl)
      : await installFromDir(source.dirUrl ?? '');
    if (!manifest.id || !manifest.main) throw new PluginLoadError('manifest missing id/main');
    const baseUrl = await materialize(manifest.id, manifest, files);
    const records = await readRecords();
    const record: PluginRecord = {
      id: manifest.id,
      name: manifest.name || manifest.id,
      version: manifest.version || '0.0.0',
      enabled: false,
      baseUrl,
      manifest
    };
    const idx = records.findIndex((r) => r.id === record.id);
    if (idx >= 0) records[idx] = record;
    else records.push(record);
    await writeRecords(records);
    events.emit('plugins:change', { id: record.id, action: 'install' });
    return record;
  },

  async enable(id: string): Promise<void> {
    const record = (await readRecords()).find((r) => r.id === id);
    if (!record) throw new PluginLoadError(`unknown plugin: ${id}`);
    if (running.has(id)) return;

    const mainUrl = `${pluginDir(id)}/${record.manifest.main}`;
    const code = await fs.read(mainUrl);
    const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    const script = document.createElement('script');
    script.src = blobUrl;
    script.dataset.pluginId = id;

    const page = createPluginPage(id);
    running.set(id, { script, blobUrl, page });

    const init: PluginInitFn | undefined = getPluginInit(id);
    document.head.append(script);
    let initFn = init;
    try {
      initFn = await waitForInit(id);
    } catch (err) {
      script.remove();
      URL.revokeObjectURL(blobUrl);
      running.delete(id);
      clearPluginHooks(id);
      throw err;
    }

    const cacheUrl = `browser:///plugins-cache/${id}.json`;
    let firstInit = false;
    try {
      if (!(await fs.exists(cacheUrl))) {
        await fs.createFile(cacheUrl, '{}');
        firstInit = true;
      }
    } catch {
      firstInit = true;
    }
    const cache: PluginCache = {
      cacheFileUrl: cacheUrl,
      cacheFile: {
        write: (content) => fs.write(cacheUrl, content),
        read: () => fs.read(cacheUrl)
      },
      firstInit
    };

    try {
      await initFn(record.baseUrl, page, cache);
    } catch (err) {
      toast.error(`Plugin "${id}" init failed: ${err instanceof Error ? err.message : err}`);
    }

    const records = await readRecords();
    const r = records.find((x) => x.id === id);
    if (r) r.enabled = true;
    await writeRecords(records);
    events.emit('plugins:change', { id, action: 'enable' });
  },

  async disable(id: string): Promise<void> {
    const running1 = running.get(id);
    if (running1) {
      try {
        getPluginUnmount(id)?.();
      } catch (err) {
        console.warn(`[plugins] unmount "${id}" threw`, err);
      }
      running1.script.remove();
      URL.revokeObjectURL(running1.blobUrl);
      running.delete(id);
      clearPluginHooks(id);
      destroyPluginPage(id);
    }
    const records = await readRecords();
    const r = records.find((x) => x.id === id);
    if (r) r.enabled = false;
    await writeRecords(records);
    events.emit('plugins:change', { id, action: 'disable' });
  },

  async uninstall(id: string): Promise<void> {
    await this.disable(id);
    try {
      await fs.deletePath(pluginDir(id));
    } catch {
      /* nothing on disk */
    }
    const records = (await readRecords()).filter((r) => r.id !== id);
    await writeRecords(records);
    events.emit('plugins:change', { id, action: 'uninstall' });
  },

  async loadEnabled(): Promise<void> {
    const records = await readRecords();
    for (const record of records) {
      if (!record.enabled) continue;
      try {
        await this.enable(record.id);
      } catch (err) {
        toast.error(`Plugin failed to load: ${record.name}`);
        console.error('[plugins]', err);
      }
    }
  },

  isRunning(id: string): boolean {
    return running.has(id);
  }
};
