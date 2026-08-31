/**
 * ProviderManager — CRUD for provider profiles stored in settings, plus
 * creation of clients for the active profile.
 */

import { ProviderProfile } from './types';
import { createClient } from './clients';
import { getPreset } from './presets';
import { uid } from '../../lib/helpers';

export class ProviderManager {
  private profiles: ProviderProfile[] = [];
  private activeId: string | null = null;

  load(profiles: ProviderProfile[] | undefined, activeId?: string | null): void {
    this.profiles = Array.isArray(profiles) ? profiles : [];
    this.activeId = activeId ?? this.profiles[0]?.id ?? null;
  }

  list(): ProviderProfile[] {
    return [...this.profiles];
  }

  get active(): ProviderProfile | null {
    return this.profiles.find((p) => p.id === this.activeId) ?? null;
  }

  get activeProfileId(): string | null {
    return this.activeId;
  }

  setActive(id: string | null): void {
    this.activeId = id;
  }

  get(id: string): ProviderProfile | null {
    return this.profiles.find((p) => p.id === id) ?? null;
  }

  /** Create a profile from a preset (or custom OpenAI-compatible endpoint). */
  addProfile(input: {
    presetId: string;
    label?: string;
    baseURL?: string;
    apiKey?: string;
    model?: string;
    api?: ProviderProfile['api'];
    headers?: Record<string, string>;
  }): ProviderProfile {
    const preset = getPreset(input.presetId);
    const profile: ProviderProfile = {
      id: uid('prov'),
      presetId: input.presetId,
      label: input.label ?? preset?.label ?? 'Custom provider',
      api: input.api ?? preset?.api ?? 'openai',
      baseURL: input.baseURL ?? preset?.baseURL ?? 'https://api.openai.com/v1',
      apiKey: input.apiKey ?? '',
      model: input.model ?? preset?.models[0]?.id ?? 'gpt-4o-mini',
      headers: input.headers,
    };
    this.profiles.push(profile);
    if (!this.activeId) this.activeId = profile.id;
    return profile;
  }

  update(id: string, patch: Partial<ProviderProfile>): ProviderProfile | null {
    const profile = this.profiles.find((p) => p.id === id);
    if (!profile) return null;
    Object.assign(profile, patch);
    return profile;
  }

  remove(id: string): void {
    this.profiles = this.profiles.filter((p) => p.id !== id);
    if (this.activeId === id) this.activeId = this.profiles[0]?.id ?? null;
  }

  /** Build a client for the active profile. Returns null when none configured. */
  client(): ReturnType<typeof createClient> | null {
    const profile = this.active;
    if (!profile) return null;
    return createClient(profile);
  }
}

export const providers = new ProviderManager();
