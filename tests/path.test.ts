import { describe, expect, it } from 'vitest';
import * as p from '../src/lib/path';

describe('path (scheme-aware)', () => {
  it('parses schemes', () => {
    expect(p.parse('file:///a/b.txt')).toEqual({ scheme: 'file', path: '/a/b.txt' });
    expect(p.parse('/plain/path')).toEqual({ scheme: null, path: '/plain/path' });
  });

  it('join keeps and replaces schemes (regression: scheme paths)', () => {
    expect(p.join('file:///a', 'b', 'c.txt')).toBe('file:///a/b/c.txt');
    expect(p.join('file:///a', 'mem:///x', 'y')).toBe('mem:///x/y');
  });

  it('resolve treats scheme paths as absolute (regression fix)', () => {
    expect(p.resolve('file:///a/b', 'c')).toBe('file:///a/b/c');
    expect(p.resolve('file:///a/b', '/c')).toBe('file:///c');
    expect(p.resolve('file:///a', 'mem:///x/y')).toBe('mem:///x/y');
    expect(p.resolve('a', 'b')).toBe('/a/b');
  });

  it('isAbsolute covers both forms', () => {
    expect(p.isAbsolute('file:///x')).toBe(true);
    expect(p.isAbsolute('/x')).toBe(true);
    expect(p.isAbsolute('x/y')).toBe(false);
  });

  it('dirname/basename/extname handle schemes', () => {
    expect(p.dirname('file:///a/b/c.txt')).toBe('file:///a/b');
    expect(p.basename('file:///a/b/c.txt')).toBe('c.txt');
    expect(p.extname('file:///a/SCRIPT.TS')).toBe('.ts');
    expect(p.extname('file:///a/noext')).toBe('');
  });

  it('normalize collapses .. and .', () => {
    expect(p.normalize('/a/b/../c/./d')).toBe('/a/c/d');
    expect(p.normalize('file:///a/../../x')).toBe('file:///x');
  });

  it('relative works across same scheme and returns target for different scheme', () => {
    expect(p.relative('file:///a/b', 'file:///a/c/d')).toBe('../c/d');
    expect(p.relative('file:///a', 'mem:///b')).toBe('mem:///b');
  });

  it('contains checks nesting within same scheme', () => {
    expect(p.contains('file:///a', 'file:///a/b/c')).toBe(true);
    expect(p.contains('file:///a', 'file:///ab')).toBe(false);
  });

  it('fuzzyMatch ranks substring and subsequence matches', () => {
    expect(p.fuzzyMatch('main', 'src/main.ts')).toBeGreaterThan(0);
    expect(p.fuzzyMatch('main', 'src/ma in')).toBeGreaterThan(0);
    expect(p.fuzzyMatch('zzz', 'src/main.ts')).toBe(-1);
    expect(p.fuzzyMatch('', 'anything')).toBe(0);
  });
});
