/**
 * Facade — language registry.
 */
import * as core from '@core/editor/languages';
import type { LanguageSupport } from '@codemirror/language';
import type { Completion } from '@codemirror/autocomplete';

export interface LanguageInfo {
  id: string;
  name: string;
  extensions: string[];
  support: LanguageSupport | (() => LanguageSupport);
  snippets?: Completion[];
}

export const editorLanguages = {
  register: (info: LanguageInfo) => core.register(info),
  get: (url: string) => core.get(url),
  list: () => core.list()
};
