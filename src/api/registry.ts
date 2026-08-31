/**
 * xcoder facade — the single object exposed to plugins and power users
 * (also available as `window.xcoder`). `xcoder.require('module')` returns
 * the module facade; unknown names throw with the list of valid modules.
 */

import * as pathMod from '../lib/path';
import { bus, EventBus } from '../lib/events';
import { storage, createStore } from '../lib/storage';
import * as helpers from '../lib/helpers';
import { t, setLocale, getLocale, listLocales, registerLocale, detectLocale } from '../lib/i18n';
import { commands, CommandRegistry } from './commands';
import { settings, SettingsManager } from './settings';
import { toast, ToastType } from './toast';
import * as dialog from './dialog';
import { cache, TTLCache } from './cache';
import { plugins, PluginManager } from './plugins';
import { fs, Workspace } from '../core/file';
import { editorManager } from '../core/editor/editorManager';
import { Shell } from '../core/terminal/shell';
import { agents } from '../core/agent';
import { providers } from '../core/ai';
import { PRESETS, getPreset, presetsByGroup } from '../core/ai/presets';
import { createClient } from '../core/ai/clients';
import { LSPClient } from '../core/lsp/client';
import { VERSION } from '../version';

export interface RegistryDeps {
  shell: Shell;
}

export function buildFacade(deps: RegistryDeps) {
  const facade: Record<string, unknown> = {
    // lib
    path: pathMod,
    bus,
    EventBus,
    storage,
    createStore,
    helpers,
    i18n: { t, setLocale, getLocale, listLocales, registerLocale, detectLocale },
    // api
    commands,
    settings,
    toast,
    dialog,
    cache,
    plugins,
    // core
    fs,
    editor: editorManager,
    shell: deps.shell,
    agents,
    ai: {
      providers,
      presets: PRESETS,
      getPreset,
      presetsByGroup,
      createClient,
    },
    lsp: { LSPClient },
    version: VERSION,
  };

  function require(name: string): unknown {
    if (name in facade) return facade[name];
    throw new Error(`xcoder.require: unknown module "${name}". Available: ${Object.keys(facade).join(', ')}`);
  }

  return { require, facade, modules: () => Object.keys(facade) };
}

export type XcoderFacade = ReturnType<typeof buildFacade>;

let instance: XcoderFacade | null = null;

export function initRegistry(deps: RegistryDeps): XcoderFacade {
  instance = buildFacade(deps);
  const xcoder = {
    require: instance.require,
    modules: instance.modules,
    version: VERSION,
  };
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).xcoder = xcoder;
  }
  return instance;
}

export function getRegistry(): XcoderFacade {
  if (!instance) throw new Error('registry not initialized');
  return instance;
}

export type { CommandRegistry, SettingsManager, PluginManager, TTLCache, Workspace };
export type { ToastType };
