import { describe, it, expect } from 'vitest';
import { I18n } from '../src/lib/i18n';
import { Emitter } from '../src/lib/events';
import { fuzzyScore, debounce, clamp, formatBytes } from '../src/lib/helpers';

describe('lib/i18n', () => {
  it('falls back through the chain (locale → pt → en → key)', () => {
    const i18n = new I18n();
    i18n.register('en', { 'app.title': 'Editor', 'common.onlyEn': 'EN!' });
    i18n.register('pt', { 'app.title': 'Editor PT' });
    i18n.register('xx', { 'app.title': 'Editor XX' });
    i18n.setLocale('xx');
    expect(i18n.t('app.title')).toBe('Editor XX'); // locale itself
    expect(i18n.t('common.onlyEn')).toBe('EN!'); // en fallback
    expect(i18n.t('missing.key')).toBe('missing.key'); // key fallback
  });

  it('interpolates variables', () => {
    const i18n = new I18n();
    i18n.register('en', { 'greet': 'Hello {name}, you have {n} files' });
    expect(i18n.t('greet', { name: 'Ana', n: 3 })).toBe('Hello Ana, you have 3 files');
  });

  it('reports missing keys vs a reference', () => {
    const i18n = new I18n();
    i18n.register('en', { a: '1', b: '2', c: '3' });
    i18n.register('pt', { a: '1' });
    expect(i18n.missingKeys('pt', { a: '1', b: '2', c: '3' })).toEqual(['b', 'c']);
  });
});

describe('lib/events', () => {
  it('on/once/off/clear', () => {
    const bus = new Emitter<{ ping: { n: number }; boom: never }>();
    const seen: number[] = [];
    const off = bus.on('ping', (p) => seen.push(p.n));
    bus.emit('ping', { n: 1 });
    bus.once('ping', (p) => seen.push(p.n * 10));
    bus.emit('ping', { n: 2 });
    off();
    bus.emit('ping', { n: 3 });
    expect(seen).toEqual([1, 2, 20]);
  });

  it('a throwing handler does not break others', () => {
    const bus = new Emitter<{ e: Record<string, never> }>();
    const calls: string[] = [];
    bus.on('e', () => {
      throw new Error('boom');
    });
    bus.on('e', () => calls.push('ok'));
    expect(() => bus.emit('e', {})).not.toThrow();
    expect(calls).toEqual(['ok']);
  });
});

describe('lib/helpers', () => {
  it('fuzzyScore ranks subsequence matches', () => {
    expect(fuzzyScore('fs', 'file.save')).not.toBeNull();
    expect(fuzzyScore('xyz', 'file.save')).toBeNull();
    const good = fuzzyScore('save', 'file.save');
    const weak = fuzzyScore('save', 'some.unrelated.command.that.saves');
    expect(good ?? 0).toBeGreaterThan(weak ?? 0);
  });

  it('debounce collapses bursts', async () => {
    let calls = 0;
    const debounced = debounce(() => calls++, 30);
    debounced();
    debounced();
    debounced();
    await new Promise((r) => setTimeout(r, 80));
    expect(calls).toBe(1);
  });

  it('clamp and formatBytes', () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
  });
});
