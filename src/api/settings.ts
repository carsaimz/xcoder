/** Settings manager — persisted JSON document with typed accessors. */

import { storage } from '../lib/storage';
import { bus } from '../lib/events';
import { deepMerge } from '../lib/helpers';
import { ProviderProfile } from '../core/ai/types';

export interface AgentSettings {
  permissionMode: 'ask' | 'auto';
  maxSteps: number;
  activeProfileId: string | null;
}

export interface SettingsShape {
  theme: 'dark' | 'light' | 'ocean';
  locale: string;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
  agent: AgentSettings;
  providers: ProviderProfile[];
}

export const DEFAULT_SETTINGS: SettingsShape = {
  theme: 'dark',
  locale: 'en',
  fontSize: 14,
  tabSize: 4,
  wordWrap: true,
  lineNumbers: true,
  autoSave: false,
  autoSaveDelay: 2000,
  agent: {
    permissionMode: 'ask',
    maxSteps: 25,
    activeProfileId: null,
  },
  providers: [],
};

const KEY = 'settings';

export class SettingsManager {
  private data: SettingsShape = { ...DEFAULT_SETTINGS };
  private ready: Promise<void>;

  constructor() {
    this.ready = this.init();
  }

  async init(): Promise<void> {
    try {
      const stored = await storage.get<Partial<SettingsShape>>(KEY);
      if (stored) this.data = deepMerge(DEFAULT_SETTINGS, stored);
    } catch (err) {
      console.warn('[settings] load failed, using defaults', err);
    }
  }

  /** Await initial load (idempotent). */
  whenReady(): Promise<void> {
    return this.ready;
  }

  get<K extends keyof SettingsShape>(key: K): SettingsShape[K] {
    return this.data[key];
  }

  getAll(): Readonly<SettingsShape> {
    return this.data;
  }

  async set<K extends keyof SettingsShape>(key: K, value: SettingsShape[K]): Promise<void> {
    this.data[key] = value;
    await this.persist();
    bus.emit('settings:change', { key, value });
  }

  async patch(partial: Partial<SettingsShape>): Promise<void> {
    this.data = deepMerge(this.data, partial);
    await this.persist();
    bus.emit('settings:change', { key: '*', value: this.data });
  }

  async reset(): Promise<void> {
    this.data = { ...DEFAULT_SETTINGS };
    await this.persist();
    bus.emit('settings:change', { key: '*', value: this.data });
  }

  private async persist(): Promise<void> {
    await storage.set(KEY, this.data);
  }
}

export const settings = new SettingsManager();
