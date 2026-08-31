/** Language detection + lazy loading through @codemirror/language-data. */

import { LanguageDescription, LanguageSupport } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import * as path from '../../lib/path';

/** Find a language description for a file path (by extension or alias). */
export function findLanguage(filePath: string): LanguageDescription | null {
  const ext = path.extname(filePath).replace('.', '');
  if (!ext) return null;
  return (
    languages.find((l) => l.extensions.includes(ext)) ??
    languages.find((l) => l.alias.includes(ext)) ??
    null
  );
}

/** Load the language support (cached by CM itself). */
export async function loadLanguage(filePath: string): Promise<LanguageSupport | null> {
  const lang = findLanguage(filePath);
  if (!lang) return null;
  try {
    return await lang.load();
  } catch (err) {
    console.warn(`[editor] failed to load language for ${filePath}`, err);
    return null;
  }
}

/** All languages available for the "set syntax" palette command. */
export function allLanguages(): LanguageDescription[] {
  return languages;
}
