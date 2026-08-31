import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/lib/events';
import { debounce, clamp, escapeHtml, deepMerge, truncate, naturalCompare, formatBytes, toBase64, fromBase64 } from '../src/lib/helpers';
import { memoryStore } from '../src/lib/storage';
import { t, setLocale, registerLocale } from '../src/lib/i18n';

describe('EventBus', () => {
  it('on/emit/off/once', () => {
    const bus = new EventBus();
    const got: number[] = [];
    const off = bus.on<number>('n', (v) => got.push(v));
    bus.emit('n', 1);
    off();
    bus.emit('n', 2);
    expect(got).toEqual([1]);

    const onceValues: string[] = [];
    bus.once('s', (v) => onceValues.push(String(v)));
    bus.emit('s', 'a');
    bus.emit('s', 'b');
    expect(onceValues).toEqual(['a']);
  });

  it('handler errors do not break other handlers', () => {
    const bus = new EventBus();
    const spy = vi.fn();
    bus.on('x', () => {
      throw new Error('boom');
    });
    bus.on('x', spy);
    bus.emit('x');
    expect(spy).toHaveBeenCalled();
  });
});

describe('helpers', () => {
  it('debounce delays execution', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 50);
    d();
    d();
    d();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('clamp/truncate/escapeHtml/formatBytes', () => {
    expect(clamp(11, 0, 10)).toBe(10);
    expect(truncate('abcdef', 4)).toBe('abc…');
    expect(escapeHtml('<a "b">')).toBe('&lt;a &quot;b&quot;&gt;');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(5)).toBe('5 B');
  });

  it('deepMerge merges nested objects', () => {
    type ABC = { a: { b: number; c?: number } };
    expect(deepMerge({ a: { b: 1, c: 2 } } as ABC, { a: { b: 3 } })).toEqual({ a: { b: 3, c: 2 } });
  });

  it('naturalCompare sorts numerically', () => {
    const arr = ['a10', 'a2', 'a1'].sort(naturalCompare);
    expect(arr).toEqual(['a1', 'a2', 'a10']);
  });

  it('base64 is unicode safe', () => {
    const text = 'olá 世界 🚀';
    expect(fromBase64(toBase64(text))).toBe(text);
  });
});

describe('memory store', () => {
  it('set/get/delete/keys', async () => {
    await memoryStore.set('a', 1);
    expect(await memoryStore.get('a')).toBe(1);
    await memoryStore.set('b', 'x');
    expect(await memoryStore.keys()).toContain('a');
    await memoryStore.delete('a');
    expect(await memoryStore.get('a')).toBeUndefined();
  });
});

describe('i18n', () => {
  it('translates with fallback and interpolation', () => {
    registerLocale('xx', { 'greet.hello': 'Olá {name}!' });
    setLocale('xx');
    expect(t('greet.hello', { name: 'Ana' })).toBe('Olá Ana!');
    expect(t('greet.missing')).toBe('greet.missing');
    setLocale('en');
  });
});
