/**
 * Language registry. 21 languages ship from @codemirror/lang-* plus a
 * typescript entry built on the javascript package. Plugins add more via
 * `editorLanguages.register`.
 *
 * Support objects are created lazily (first use) to keep startup fast.
 */
import { angular } from '@codemirror/lang-angular';
import { cpp } from '@codemirror/lang-cpp';
import { css } from '@codemirror/lang-css';
import { go } from '@codemirror/lang-go';
import { html } from '@codemirror/lang-html';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { jinja } from '@codemirror/lang-jinja';
import { json } from '@codemirror/lang-json';
import { less } from '@codemirror/lang-less';
import { liquid } from '@codemirror/lang-liquid';
import { markdown } from '@codemirror/lang-markdown';
import { php } from '@codemirror/lang-php';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { sass } from '@codemirror/lang-sass';
import { sql } from '@codemirror/lang-sql';
import { vue } from '@codemirror/lang-vue';
import { wast } from '@codemirror/lang-wast';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import type { LanguageSupport } from '@codemirror/language';
import type { Completion } from '@codemirror/autocomplete';
import { extname } from '@lib/path';

export interface LanguageInfo {
  id: string;
  name: string;
  extensions: string[];
  support: LanguageSupport | (() => LanguageSupport);
  snippets?: Completion[];
}

const registry = new Map<string, LanguageInfo>();
const extIndex = new Map<string, string>(); // ext → language id

export function register(info: LanguageInfo): void {
  registry.set(info.id, info);
  for (const ext of info.extensions) extIndex.set(ext.toLowerCase(), info.id);
}

export function list(): LanguageInfo[] {
  return [...registry.values()];
}

export function getById(id: string): LanguageInfo | undefined {
  return registry.get(id);
}

export function get(url: string): LanguageInfo | undefined {
  const ext = extname(url);
  const id = extIndex.get(ext);
  return id ? registry.get(id) : undefined;
}

function resolve(info: LanguageInfo): LanguageSupport {
  return typeof info.support === 'function' ? info.support() : info.support;
}

export function supportFor(url: string): LanguageSupport | undefined {
  const info = get(url);
  return info ? resolve(info) : undefined;
}

// ---------------------------------------------------------------------------
// Bundled languages
// ---------------------------------------------------------------------------

const JS_SNIPPETS: Completion[] = [
  { label: 'fn', type: 'keyword', detail: 'snippet', apply: 'function ${name}(${args}) {\n    ${}\n}' },
  { label: 'afn', type: 'keyword', detail: 'snippet', apply: 'const ${name} = (${args}) => {\n    ${}\n};' },
  { label: 'forin', type: 'keyword', detail: 'snippet', apply: 'for (const ${item} of ${list}) {\n    ${}\n}' },
  { label: 'ifelse', type: 'keyword', detail: 'snippet', apply: 'if (${cond}) {\n    ${}\n} else {\n    \n}' },
  { label: 'log', type: 'keyword', detail: 'snippet', apply: 'console.log(${msg});' }
];

const PY_SNIPPETS: Completion[] = [
  { label: 'def', type: 'keyword', detail: 'snippet', apply: 'def ${name}(${args}):\n    ${}' },
  { label: 'main', type: 'keyword', detail: 'snippet', apply: 'if __name__ == "__main__":\n    ${}' },
  { label: 'forr', type: 'keyword', detail: 'snippet', apply: 'for ${i} in range(${n}):\n    ${}' }
];

/** Register everything bundled with the app (called once at boot). */
export function registerBundledLanguages(): void {
  const bundled: LanguageInfo[] = [
    {
      id: 'javascript',
      name: 'JavaScript',
      extensions: ['js', 'mjs', 'cjs', 'jsx'],
      support: () => javascript(),
      snippets: JS_SNIPPETS
    },
    {
      id: 'typescript',
      name: 'TypeScript',
      extensions: ['ts', 'mts', 'cts'],
      support: () => javascript({ typescript: true }),
      snippets: JS_SNIPPETS
    },
    { id: 'angular', name: 'Angular Template', extensions: ['ng.html', 'ng'], support: () => angular() },
    { id: 'cpp', name: 'C++', extensions: ['cpp', 'c', 'h', 'hpp', 'cc', 'cxx', 'hxx', 'ino'], support: () => cpp() },
    { id: 'css', name: 'CSS', extensions: ['css'], support: () => css() },
    { id: 'go', name: 'Go', extensions: ['go'], support: () => go() },
    { id: 'html', name: 'HTML', extensions: ['html', 'htm'], support: () => html() },
    { id: 'java', name: 'Java', extensions: ['java'], support: () => java() },
    { id: 'jinja', name: 'Jinja2', extensions: ['jinja', 'j2', 'jinja2'], support: () => jinja() },
    { id: 'json', name: 'JSON', extensions: ['json', 'jsonc'], support: () => json() },
    { id: 'less', name: 'Less', extensions: ['less'], support: () => less() },
    { id: 'liquid', name: 'Liquid', extensions: ['liquid'], support: () => liquid() },
    { id: 'markdown', name: 'Markdown', extensions: ['md', 'markdown'], support: () => markdown() },
    { id: 'php', name: 'PHP', extensions: ['php'], support: () => php() },
    { id: 'python', name: 'Python', extensions: ['py', 'pyi', 'pyw'], support: () => python(), snippets: PY_SNIPPETS },
    { id: 'rust', name: 'Rust', extensions: ['rs'], support: () => rust() },
    { id: 'scss', name: 'SCSS', extensions: ['scss'], support: () => sass() },
    { id: 'sass', name: 'Sass', extensions: ['sass'], support: () => sass({ indented: true }) },
    { id: 'sql', name: 'SQL', extensions: ['sql'], support: () => sql() },
    { id: 'vue', name: 'Vue', extensions: ['vue'], support: () => vue() },
    { id: 'wast', name: 'WebAssembly Text', extensions: ['wast', 'wat'], support: () => wast() },
    { id: 'xml', name: 'XML', extensions: ['xml', 'svg', 'xsl', 'plist'], support: () => xml() },
    { id: 'yaml', name: 'YAML', extensions: ['yaml', 'yml'], support: () => yaml() }
  ];

  for (const info of bundled) register(info);
}
