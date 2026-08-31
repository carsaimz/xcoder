/**
 * Public plugins facade (`xcoder.require('plugins')` and settings UI).
 */
import { pluginsManager, PluginLoadError } from './manager';
import type { PluginRecord } from './manifest';

export type { PluginRecord, PluginManifest } from './manifest';
export { PluginLoadError };

export const pluginsApi = {
  list: () => pluginsManager.list(),
  get: (id: string) => pluginsManager.get(id),
  install: (source: { zipUrl?: string; dirUrl?: string }) => pluginsManager.install(source),
  enable: (id: string) => pluginsManager.enable(id),
  disable: (id: string) => pluginsManager.disable(id),
  uninstall: (id: string) => pluginsManager.uninstall(id)
};
