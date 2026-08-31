/**
 * Schema-driven settings. Persisted in IndexedDB ('kv' store, 'settings:').
 * `set` validates, persists and broadcasts `settings:change`.
 * Applying side effects (theme switch, font size…) is done by subscribers.
 */
import { KVStore } from '@lib/storage';
import { events } from './events';
import type { CustomProvider } from '@core/ai/providers';
import type { ApprovalMode } from '@core/ai/manager';

export type ThemeId = 'dark' | 'light' | 'solarized' | 'oled';

export type { LspServerConfig } from '@core/lsp/client';
import type { LspServerConfig } from '@core/lsp/client';

export interface Settings {
  theme: ThemeId;
  fontSize: number;
  tabSize: 2 | 4 | 8;
  wordWrap: boolean;
  autoSave: boolean;
  lang: string;
  'terminal.fontSize': number;
  'lsp.servers': Record<string, LspServerConfig>;
  // AI agents
  'ai.provider': string;
  'ai.model': string;
  'ai.keys': Record<string, string>;
  'ai.customProviders': CustomProvider[];
  'ai.temperature': number;
  'ai.maxTokens': number;
  'ai.maxTurns': number;
  'ai.streaming': boolean;
  'ai.approval': ApprovalMode;
}

export type SettingKey = keyof Settings;

export const DEFAULTS: Readonly<Settings> = {
  theme: 'dark',
  fontSize: 16,
  tabSize: 4,
  wordWrap: true,
  autoSave: false,
  lang: 'en',
  'terminal.fontSize': 13,
  'lsp.servers': {},
  'ai.provider': 'openrouter-free',
  'ai.model': 'deepseek/deepseek-chat-v3.1:free',
  'ai.keys': {},
  'ai.customProviders': [],
  'ai.temperature': 0.2,
  'ai.maxTokens': 4096,
  'ai.maxTurns': 24,
  'ai.streaming': true,
  'ai.approval': 'careful'
};

const store = new KVStore('kv', 'settings:');
const state: Settings = { ...DEFAULTS };
let loaded = false;

const NUMBER_RANGES: Partial<Record<SettingKey, [number, number]>> = {
  fontSize: [10, 32],
  'terminal.fontSize': [9, 24],
  'ai.temperature': [0, 2],
  'ai.maxTokens': [256, 32768],
  'ai.maxTurns': [4, 64]
};

function validate<K extends SettingKey>(key: K, value: Settings[K]): void {
  if (key === 'theme' && !['dark', 'light', 'solarized', 'oled'].includes(String(value))) {
    throw new Error(`[settings] invalid theme "${String(value)}"`);
  }
  if (key === 'tabSize' && ![2, 4, 8].includes(Number(value))) {
    throw new Error(`[settings] invalid tabSize "${String(value)}"`);
  }
  if (key === 'ai.approval' && !['careful', 'balanced', 'auto'].includes(String(value))) {
    throw new Error(`[settings] invalid ai.approval "${String(value)}"`);
  }
  const range = NUMBER_RANGES[key];
  if (range && (typeof value !== 'number' || Number.isNaN(value))) {
    throw new Error(`[settings] "${key}" must be a number`);
  }
}

/** Load persisted settings (boot step 2). Safe to call once. */
export async function load(): Promise<Settings> {
  if (loaded) return state;
  const saved = (await store.get<Partial<Settings>>('*')) ?? {};
  Object.assign(state, DEFAULTS, saved);
  loaded = true;
  return state;
}

export function get<K extends SettingKey>(key: K): Settings[K] {
  return state[key];
}

export async function set<K extends SettingKey>(key: K, value: Settings[K]): Promise<void> {
  validate(key, value);
  if (state[key] === value) return;
  state[key] = value;
  await store.set('*', state);
  events.emit('settings:change', { key, value });
}

/** Bulk update (settings UI applies several keys at once). */
export async function update(patch: Partial<Settings>): Promise<void> {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    await set(key as SettingKey, value as never);
  }
}

export function all(): Readonly<Settings> {
  return state;
}

export async function reset(): Promise<void> {
  Object.assign(state, DEFAULTS);
  await store.set('*', state);
  for (const [key, value] of Object.entries(DEFAULTS)) {
    events.emit('settings:change', { key, value });
  }
}

/** Named API object (consumers: `import { settings } from '@api/settings'`). */
export const settings = { load, get, set, update, all, reset };
