/**
 * Tests for the AI provider registry.
 */
import { describe, it, expect } from 'vitest';
import {
  BUILTIN_PROVIDERS,
  TIER_ORDER,
  providersByTier,
  resolveProvider,
  toProviderDef,
  validateRegistry,
  DEFAULT_PROVIDER_ID,
  DEFAULT_MODEL,
  type CustomProvider
} from '../src/core/ai/providers';

describe('ai providers registry', () => {
  it('is internally consistent', () => {
    expect(validateRegistry()).toEqual([]);
    expect(BUILTIN_PROVIDERS.length).toBeGreaterThanOrEqual(15);
  });

  it('covers all three tiers', () => {
    const grouped = providersByTier();
    for (const tier of TIER_ORDER) {
      expect(grouped[tier].length, `tier ${tier}`).toBeGreaterThan(0);
    }
    // the "free" tier must include keyless/local options
    expect(grouped.free.some((p) => !p.needsKey)).toBe(true);
  });

  it('has unique model ids per provider', () => {
    for (const p of BUILTIN_PROVIDERS) {
      const ids = p.models.map((m) => m.id);
      expect(new Set(ids).size, p.id).toBe(ids.length);
    }
  });

  it('resolves builtin and custom providers', () => {
    expect(resolveProvider('openai')?.name).toBe('OpenAI');
    expect(resolveProvider('nope')).toBeUndefined();

    const custom: CustomProvider = {
      id: 'litellm',
      name: 'LiteLLM',
      baseURL: 'http://localhost:4000/v1/',
      apiStyle: 'openai',
      needsKey: false,
      models: ['gpt-4o']
    };
    const resolved = resolveProvider('custom:litellm', [custom]);
    expect(resolved?.id).toBe('custom:litellm');
    expect(resolved?.baseURL.endsWith('/v1')).toBe(true); // trailing slash stripped
    expect(resolved?.models[0].id).toBe('gpt-4o');
  });

  it('maps custom providers into the free tier group', () => {
    const grouped = providersByTier([
      { id: 'x', name: 'X', baseURL: 'http://x/v1', apiStyle: 'openai', needsKey: false, models: ['m'] }
    ]);
    expect(grouped.free.some((p) => p.id === 'custom:x')).toBe(true);
  });

  it('toProviderDef keeps anthropic style', () => {
    const def = toProviderDef({
      id: 'a', name: 'A', baseURL: 'http://a/v1', apiStyle: 'anthropic', needsKey: true, models: ['claude']
    });
    expect(def.apiStyle).toBe('anthropic');
  });

  it('defaults point to a real free model', () => {
    const p = resolveProvider(DEFAULT_PROVIDER_ID);
    expect(p).toBeDefined();
    expect(p!.models.some((m) => m.id === DEFAULT_MODEL)).toBe(true);
  });
});
