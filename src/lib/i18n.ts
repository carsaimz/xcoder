/**
 * i18n runtime. Locales register dictionaries; `t()` resolves a key with
 * `{var}` interpolation and falls back to English when missing.
 */

import en from '../lang/en';
import pt from '../lang/pt';
import es from '../lang/es';
import { bus } from './events';

type Dict = Record<string, string>;

const dicts: Record<string, Dict> = {
  en: en as unknown as Dict,
  pt: pt as unknown as Dict,
  es: es as unknown as Dict,
};

export const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  pt: 'Português',
  es: 'Español',
};

let current = 'en';

/** Register (or replace) a locale dictionary. Missing keys fall back to en. */
export function registerLocale(code: string, dict: Dict, name?: string): void {
  dicts[code] = dict;
  if (name) LOCALE_NAMES[code] = name;
}

export function listLocales(): Array<{ code: string; name: string }> {
  return Object.keys(dicts)
    .sort()
    .map((code) => ({ code, name: LOCALE_NAMES[code] ?? code }));
}

export function getLocale(): string {
  return current;
}

export function setLocale(code: string): void {
  current = dicts[code] ? code : 'en';
  bus.emit('locale:changed', current);
}

/** Translate `key` with optional `{var}` interpolation. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const raw = dicts[current]?.[key] ?? dicts.en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
}

/** Detect best locale from navigator languages. */
export function detectLocale(): string {
  if (typeof navigator === 'undefined') return 'en';
  for (const lang of navigator.languages ?? [navigator.language]) {
    const code = lang.toLowerCase();
    if (dicts[code]) return code;
    const base = code.split('-')[0];
    if (dicts[base]) return base;
  }
  return 'en';
}

// Lazy-but-static registration for the generated locale stubs (43 locales).
import { generated } from '../lang/gen';

/** Register every generated locale (missing keys fall back to en). */
export function registerGeneratedLocales(): void {
  for (const [code, dict] of Object.entries(generated)) {
    if (!dicts[code]) registerLocale(code, dict);
  }
}
