/** Three built-in editor themes: dark (default), light and ocean. */

import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export type ThemeName = 'dark' | 'light' | 'ocean';

export const THEME_LIST: ThemeName[] = ['dark', 'light', 'ocean'];

function baseTheme(colors: Record<string, string | boolean>) {
  const c = colors as Record<string, string>;
  return EditorView.theme(
    {
      '&': { color: c.fg, backgroundColor: c.bg },
      '.cm-content': { caretColor: c.caret, fontFamily: "'Sarasa Mono SC', 'Fira Code', Menlo, Consolas, monospace" },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: c.caret },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: c.selection,
      },
      '.cm-activeLine': { backgroundColor: c.activeLine },
      '.cm-gutters': { backgroundColor: c.gutterBg, color: c.gutterFg, border: 'none' },
      '.cm-activeLineGutter': { backgroundColor: c.activeLine, color: c.fg },
      '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 12px' },
      '.cm-foldGutter .cm-gutterElement': { color: c.gutterFg },
      '.cm-selectionMatch': { backgroundColor: c.selectionMatch },
      '.cm-tooltip': {
        border: '1px solid ' + c.border,
        backgroundColor: c.tooltipBg,
        color: c.fg,
        borderRadius: '6px',
      },
      '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: c.activeLine },
      '.cm-searchMatch': { backgroundColor: c.searchMatch, outline: '1px solid ' + c.border },
      '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: c.searchMatchSelected },
      '.cm-panels': { backgroundColor: c.tooltipBg, color: c.fg },
      '.cm-panels.cm-panels-bottom': { borderTop: '1px solid ' + c.border },
      '.cm-scroller': { fontFamily: "'Sarasa Mono SC', 'Fira Code', Menlo, Consolas, monospace", lineHeight: '1.6' },
    },
    { dark: Boolean(colors.isDark) },
  );
}

function highlight(colors: Record<string, string | boolean>) {
  const c = colors as Record<string, string>;
  return syntaxHighlighting(
    HighlightStyle.define([
      { tag: t.heading, color: c.func, fontWeight: 'bold' },
      { tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword], color: c.keyword },
      { tag: [t.string, t.special(t.string)], color: c.string },
      { tag: [t.number, t.bool, t.null, t.atom], color: c.number },
      { tag: [t.function(t.variableName), t.function(t.propertyName)], color: c.func },
      { tag: [t.definition(t.variableName), t.variableName], color: c.variable },
      { tag: [t.propertyName, t.attributeName], color: c.property },
      { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: c.comment, fontStyle: 'italic' },
      { tag: [t.typeName, t.className, t.namespace], color: c.type },
      { tag: [t.tagName], color: c.keyword },
      { tag: [t.meta, t.processingInstruction], color: c.comment },
      { tag: t.invalid, color: '#f38ba8' },
      { tag: t.regexp, color: c.number },
    ]),
  );
}

const DARK = {
  isDark: true,
  bg: '#1e1e2e',
  fg: '#cdd6f4',
  caret: '#89b4fa',
  selection: '#414358',
  selectionMatch: '#3b3d52',
  activeLine: '#2b2b3d',
  gutterBg: '#1e1e2e',
  gutterFg: '#5c5f77',
  border: '#45475a',
  tooltipBg: '#26263a',
  searchMatch: '#585b70',
  searchMatchSelected: '#6c7086',
  keyword: '#cba6f7',
  string: '#a6e3a1',
  number: '#fab387',
  func: '#89b4fa',
  variable: '#cdd6f4',
  property: '#94e2d5',
  comment: '#6c7086',
  type: '#f9e2af',
};

const LIGHT = {
  isDark: false,
  bg: '#ffffff',
  fg: '#383a42',
  caret: '#526fff',
  selection: '#d2d8ff',
  selectionMatch: '#e4e8ff',
  activeLine: '#f3f3f8',
  gutterBg: '#ffffff',
  gutterFg: '#9a9aa5',
  border: '#d9d9e3',
  tooltipBg: '#fbfbfe',
  searchMatch: '#fff2b0',
  searchMatchSelected: '#ffd76e',
  keyword: '#a626a4',
  string: '#2da44e',
  number: '#c18401',
  func: '#3b7ddd',
  variable: '#383a42',
  property: '#0d94b2',
  comment: '#9a96a0',
  type: '#b76b00',
};

const OCEAN = {
  isDark: true,
  bg: '#0f2233',
  fg: '#d5e4f2',
  caret: '#4dd0e1',
  selection: '#28536b',
  selectionMatch: '#204556',
  activeLine: '#16334a',
  gutterBg: '#0f2233',
  gutterFg: '#54748c',
  border: '#2b5a75',
  tooltipBg: '#143048',
  searchMatch: '#2c6480',
  searchMatchSelected: '#3d7c9c',
  keyword: '#7ee0ff',
  string: '#9be89b',
  number: '#ffc98b',
  func: '#82aaff',
  variable: '#d5e4f2',
  property: '#7fdbca',
  comment: '#5f7e94',
  type: '#ffe08a',
};

const themes: Record<ThemeName, ReturnType<typeof EditorView.theme>[]> = {
  dark: [baseTheme(DARK), highlight(DARK)],
  light: [baseTheme(LIGHT), highlight(LIGHT)],
  ocean: [baseTheme(OCEAN), highlight(OCEAN)],
};

export function themeExtensions(name: ThemeName) {
  return themes[name] ?? themes.dark;
}
