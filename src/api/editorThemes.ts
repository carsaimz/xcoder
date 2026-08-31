/**
 * Facade — theme registry. `set` applies the editor theme AND the app chrome
 * (data-theme on <html>), then persists through settings.
 */
import { registerTheme, listThemes, getTheme } from '@core/editor/themes';
import { settings, type ThemeId } from './settings';

export interface EditorTheme {
  id: string;
  name: string;
  type: 'dark' | 'light';
  cmTheme: unknown; // Extension
  highlight: unknown; // Extension
}

export const editorThemes = {
  register: (theme: EditorTheme) =>
    registerTheme({
      id: theme.id,
      name: theme.name,
      type: theme.type,
      cmTheme: theme.cmTheme as never,
      highlight: theme.highlight as never
    }),
  set: async (id: string) => {
    getTheme(id); // throws when unknown
    document.documentElement.dataset.theme = id;
    await settings.set('theme', id as ThemeId);
  },
  getActive: () => getTheme(settings.get('theme')),
  list: () => listThemes()
};
