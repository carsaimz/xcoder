/**
 * i18n runtime.
 *
 * Locale files live in `src/lang/<code>.json` (copied to `www/lang/` at build
 * time) as flat maps:  { "key": "value with {vars}" }.
 *
 * Lookup chain: requested locale → pt → en → the key itself.
 * Missing locales silently fall back, so the 40+ skeleton files work from day one.
 */

export type Dict = Record<string, string>;

export class I18n {
  private dicts = new Map<string, Dict>();
  private locale = 'en';
  private chain: string[] = ['en'];

  /** Register a dictionary (already parsed JSON). */
  register(locale: string, dict: Dict): void {
    this.dicts.set(locale, dict);
    this.rebuildChain();
  }

  /** Fetch a locale JSON from a base URL (e.g. `lang/` in www). Resolves false on failure. */
  async loadFromUrl(locale: string, baseUrl: string): Promise<boolean> {
    try {
      const res = await fetch(`${baseUrl}${locale}.json`);
      if (!res.ok) return false;
      this.register(locale, (await res.json()) as Dict);
      return true;
    } catch {
      return false;
    }
  }

  /** Set active locale. Falls back to `en` when never registered. */
  setLocale(locale: string): void {
    this.locale = locale;
    this.rebuildChain();
  }

  get current(): string {
    return this.locale;
  }

  /** Locales with at least one registered key. */
  available(): string[] {
    return [...this.dicts.keys()];
  }

  private rebuildChain(): void {
    const chain: string[] = [];
    if (this.dicts.has(this.locale)) chain.push(this.locale);
    for (const fb of ['pt', 'en']) {
      if (!chain.includes(fb) && this.dicts.has(fb)) chain.push(fb);
    }
    this.chain = chain;
  }

  /**
   * Translate. `{var}` placeholders are replaced from `vars`.
   * Unknown keys return the key itself (never undefined), so UI never blanks out.
   */
  t(key: string, vars?: Record<string, string | number>): string {
    let text: string | undefined;
    for (const locale of this.chain) {
      const dict = this.dicts.get(locale);
      const value = dict?.[key];
      if (value !== undefined) {
        text = value;
        break;
      }
    }
    if (text === undefined) text = key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return text;
  }

  /** Keys defined in `reference` but missing from `locale` (lang CLI helper). */
  missingKeys(locale: string, reference: Dict): string[] {
    const dict = this.dicts.get(locale);
    if (!dict) return Object.keys(reference);
    return Object.keys(reference).filter((k) => !(k in dict));
  }
}

/** App-wide instance. Tests create fresh I18n() objects. */
export const i18n = new I18n();
