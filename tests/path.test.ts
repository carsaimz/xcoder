import { describe, it, expect } from 'vitest';
import {
  parseUrl,
  buildUrl,
  normalize,
  joinUrl,
  resolve,
  dirname,
  basename,
  extname,
  isInside
} from '../src/lib/path';

describe('lib/path', () => {
  it('parses scheme URLs', () => {
    expect(parseUrl('file:///sdcard/a.txt')).toEqual({ scheme: 'file', path: '/sdcard/a.txt' });
    expect(parseUrl('memory:///home')).toEqual({ scheme: 'memory', path: '/home' });
    expect(parseUrl('/plain/path')).toEqual({ scheme: '', path: '/plain/path' });
  });

  it('builds URLs back', () => {
    expect(buildUrl('file', '/a/b')).toBe('file:///a/b');
    expect(buildUrl('', '/a/b')).toBe('/a/b');
  });

  it('normalizes dots', () => {
    expect(normalize('/a/./b/../c')).toBe('/a/c');
    expect(normalize('a/b/')).toBe('a/b/');
    expect(normalize('/a/b/../../c')).toBe('/c');
  });

  it('joins with scheme', () => {
    expect(joinUrl('memory:///home', 'project', 'index.js')).toBe('memory:///home/project/index.js');
    expect(joinUrl('file:///a/', 'b')).toBe('file:///a/b');
  });

  it('resolves relative segments', () => {
    expect(resolve('memory:///home/user', 'project')).toBe('memory:///home/user/project');
    expect(resolve('memory:///home/user', '../share')).toBe('memory:///home/share');
    expect(resolve('memory:///home/user', 'file:///etc')).toBe('file:///etc');
  });

  it('splits dirname/basename/extname', () => {
    expect(dirname('memory:///home/user/app.js')).toBe('memory:///home/user');
    expect(dirname('file:///etc')).toBe('file:///');
    expect(basename('memory:///home/user/app.js')).toBe('app.js');
    expect(basename('file:///')).toBe('');
    expect(extname('script.min.js')).toBe('js');
    expect(extname('noext')).toBe('');
    expect(extname('.hidden')).toBe('');
  });

  it('detects containment', () => {
    expect(isInside('memory:///home', 'memory:///home/a/b.js')).toBe(true);
    expect(isInside('memory:///home', 'browser:///home/a')).toBe(false);
    expect(isInside('memory:///home/a', 'memory:///home/a')).toBe(true);
  });
});
