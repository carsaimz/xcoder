/**
 * Service registry behind `xcoder.require()`.
 * Facades are imported here (and only here) to resolve the full API graph.
 * Every name maps to the SAME object shape documented in docs/api-reference.md.
 */
import { commands } from './commands';
import * as cacheModule from './cache';
import { settings } from './settings';
import { dialog } from './dialog';
import { toast } from './toast';
import { events } from './events';
import { editorManager } from './editorManager';
import { editorLanguages } from './editorLanguages';
import { editorThemes } from './editorThemes';
import { fileSystem } from './fileSystem';
import { terminalApi } from './terminal';
import { lsp } from './lsp';
import { ai } from './ai';
import { pluginsApi } from './plugins/public';
import * as codemirror from './codemirror';

const services: Record<string, unknown> = {
  commands,
  editorManager,
  editorLanguages,
  editorThemes,
  'xcoder.codemirror': codemirror,
  fileSystem,
  terminal: terminalApi,
  lsp,
  ai,
  settings,
  dialog,
  toast,
  events,
  cache: cacheModule,
  plugins: pluginsApi
};

export function requireModule<T = unknown>(name: string): T {
  if (!(name in services)) {
    throw new Error(`[xcoder] unknown module "${name}" — see docs/api-reference.md`);
  }
  return services[name] as T;
}

export function moduleNames(): string[] {
  return Object.keys(services);
}
