/**
 * Editor themes. Each theme = CodeMirror `EditorView.theme` + a Lezer
 * `HighlightStyle`. The UI applies `data-theme` on <html> to switch the
 * app chrome (CSS variables in styles/themes.css).
 */
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

export interface EditorTheme {
  id: string;
  name: string;
  type: 'dark' | 'light';
  cmTheme: Extension;
  highlight: Extension;
}

function defineTheme(
  id: string,
  name: string,
  type: 'dark' | 'light',
  colors: Record<string, string>,
  tags: Parameters<typeof HighlightStyle.define>[0]
): EditorTheme {
  return {
    id,
    name,
    type,
    cmTheme: EditorView.theme(
      {
        '&': { color: colors.text, backgroundColor: colors.bg },
        '.cm-content': { caretColor: colors.caret, fontFamily: "'Cascadia Code', 'Fira Code', Menlo, Consolas, monospace" },
        '.cm-cursor, .cm-dropCursor': { borderLeftColor: colors.caret },
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
          backgroundColor: colors.selection
        },
        '.cm-activeLine': { backgroundColor: colors.activeLine },
        '.cm-gutters': { backgroundColor: colors.gutterBg, color: colors.gutterFg, border: 'none' },
        '.cm-activeLineGutter': { backgroundColor: colors.activeLine, color: colors.text },
        '.cm-selectionMatch': { backgroundColor: colors.selection },
        '.cm-tooltip': {
          backgroundColor: colors.tooltipBg,
          color: colors.text,
          border: `1px solid ${colors.border}`
        },
        '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: colors.accent },
        '.cm-searchMatch': { backgroundColor: colors.searchMatch },
        '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: colors.accent },
        '.cm-panels': { backgroundColor: colors.gutterBg, color: colors.text },
        '.cm-panels.cm-panels-bottom': { borderTop: `1px solid ${colors.border}` },
        '.cm-foldPlaceholder': { backgroundColor: 'transparent', border: 'none', color: colors.comment }
      },
      { dark: type === 'dark' }
    ),
    highlight: syntaxHighlighting(HighlightStyle.define(tags))
  };
}

// VS Code Dark+ inspired
const dark = defineTheme(
  'dark',
  'XCoder Dark+',
  'dark',
  {
    text: '#d4d4d4',
    bg: '#1e1e1e',
    caret: '#aeafad',
    selection: '#264f78',
    activeLine: '#282828',
    gutterBg: '#1e1e1e',
    gutterFg: '#858585',
    accent: '#04395e',
    tooltipBg: '#252526',
    border: '#454545',
    searchMatch: '#623315',
    comment: '#6a9955'
  },
  [
    { tag: [t.keyword, t.moduleKeyword, t.controlKeyword], color: '#569cd6' },
    { tag: [t.operatorKeyword, t.operator], color: '#d4d4d4' },
    { tag: [t.string, t.special(t.string)], color: '#ce9178' },
    { tag: [t.comment, t.lineComment, t.blockComment], color: '#6a9955' },
    { tag: [t.number, t.bool, t.null], color: '#b5cea8' },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#dcdcaa' },
    { tag: [t.variableName, t.propertyName], color: '#9cdcfe' },
    { tag: [t.typeName, t.className, t.namespace], color: '#4ec9b0' },
    { tag: [t.tagName], color: '#569cd6' },
    { tag: [t.attributeName], color: '#9cdcfe' },
    { tag: [t.regexp, t.escape], color: '#d16969' },
    { tag: [t.heading], color: '#569cd6', fontWeight: 'bold' },
    { tag: [t.link, t.url], color: '#3794ff', textDecoration: 'underline' },
    { tag: [t.emphasis], fontStyle: 'italic' },
    { tag: [t.strong], fontWeight: 'bold' },
    { tag: [t.invalid], color: '#f44747' }
  ]
);

// Clean light (VS Code Light+ inspired)
const light = defineTheme(
  'light',
  'XCoder Light',
  'light',
  {
    text: '#3b3b3b',
    bg: '#ffffff',
    caret: '#000000',
    selection: '#add6ff',
    activeLine: '#f3f3f3',
    gutterBg: '#ffffff',
    gutterFg: '#999999',
    accent: '#cfe8ff',
    tooltipBg: '#f6f6f6',
    border: '#dcdcdc',
    searchMatch: '#ffd18c',
    comment: '#008000'
  },
  [
    { tag: [t.keyword, t.moduleKeyword, t.controlKeyword], color: '#0451a5' },
    { tag: [t.operatorKeyword, t.operator], color: '#3b3b3b' },
    { tag: [t.string, t.special(t.string)], color: '#a31515' },
    { tag: [t.comment, t.lineComment, t.blockComment], color: '#008000' },
    { tag: [t.number, t.bool, t.null], color: '#098658' },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#795e26' },
    { tag: [t.variableName, t.propertyName], color: '#001080' },
    { tag: [t.typeName, t.className, t.namespace], color: '#267f99' },
    { tag: [t.tagName], color: '#800000' },
    { tag: [t.attributeName], color: '#e50000' },
    { tag: [t.regexp, t.escape], color: '#811f3f' },
    { tag: [t.heading], color: '#0451a5', fontWeight: 'bold' },
    { tag: [t.link, t.url], color: '#006ab1', textDecoration: 'underline' },
    { tag: [t.emphasis], fontStyle: 'italic' },
    { tag: [t.strong], fontWeight: 'bold' },
    { tag: [t.invalid], color: '#cd3131' }
  ]
);

// Solarized Dark
const solarized = defineTheme(
  'solarized',
  'Solarized Dark',
  'dark',
  {
    text: '#839496',
    bg: '#002b36',
    caret: '#93a1a1',
    selection: '#073642',
    activeLine: '#073642',
    gutterBg: '#002b36',
    gutterFg: '#586e75',
    accent: '#195466',
    tooltipBg: '#073642',
    border: '#094d5c',
    searchMatch: '#4a4100',
    comment: '#586e75'
  },
  [
    { tag: [t.keyword, t.moduleKeyword, t.controlKeyword], color: '#859900' },
    { tag: [t.operatorKeyword, t.operator], color: '#839496' },
    { tag: [t.string, t.special(t.string)], color: '#2aa198' },
    { tag: [t.comment, t.lineComment, t.blockComment], color: '#586e75' },
    { tag: [t.number, t.bool, t.null], color: '#d33682' },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#268bd2' },
    { tag: [t.variableName, t.propertyName], color: '#839496' },
    { tag: [t.typeName, t.className, t.namespace], color: '#b58900' },
    { tag: [t.tagName], color: '#268bd2' },
    { tag: [t.attributeName], color: '#93a1a1' },
    { tag: [t.regexp, t.escape], color: '#cb4b16' },
    { tag: [t.heading], color: '#268bd2', fontWeight: 'bold' },
    { tag: [t.link, t.url], color: '#2aa198', textDecoration: 'underline' },
    { tag: [t.emphasis], fontStyle: 'italic' },
    { tag: [t.strong], fontWeight: 'bold' },
    { tag: [t.invalid], color: '#dc322f' }
  ]
);

// OLED — pure black, blue accent
const oled = defineTheme(
  'oled',
  'XCoder OLED',
  'dark',
  {
    text: '#e6e6e6',
    bg: '#000000',
    caret: '#0a84ff',
    selection: '#1c3a5e',
    activeLine: '#10161f',
    gutterBg: '#000000',
    gutterFg: '#5c6a79',
    accent: '#152a44',
    tooltipBg: '#10161f',
    border: '#1f2733',
    searchMatch: '#3d2f00',
    comment: '#5c6a79'
  },
  [
    { tag: [t.keyword, t.moduleKeyword, t.controlKeyword], color: '#5ac8fa' },
    { tag: [t.operatorKeyword, t.operator], color: '#bfc7d5' },
    { tag: [t.string, t.special(t.string)], color: '#9ece6a' },
    { tag: [t.comment, t.lineComment, t.blockComment], color: '#5c6a79' },
    { tag: [t.number, t.bool, t.null], color: '#ff9e64' },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#7aa2f7' },
    { tag: [t.variableName, t.propertyName], color: '#c0caf5' },
    { tag: [t.typeName, t.className, t.namespace], color: '#2ac3de' },
    { tag: [t.tagName], color: '#5ac8fa' },
    { tag: [t.attributeName], color: '#c0caf5' },
    { tag: [t.regexp, t.escape], color: '#b4f9f8' },
    { tag: [t.heading], color: '#5ac8fa', fontWeight: 'bold' },
    { tag: [t.link, t.url], color: '#0a84ff', textDecoration: 'underline' },
    { tag: [t.emphasis], fontStyle: 'italic' },
    { tag: [t.strong], fontWeight: 'bold' },
    { tag: [t.invalid], color: '#ff453a' }
  ]
);

const registry = new Map<string, EditorTheme>();

export function registerTheme(theme: EditorTheme): void {
  registry.set(theme.id, theme);
}

export function listThemes(): EditorTheme[] {
  return [...registry.values()];
}

export function getTheme(id: string): EditorTheme {
  const theme = registry.get(id);
  if (!theme) throw new Error(`[themes] unknown theme: ${id}`);
  return theme;
}

export function registerBundledThemes(): void {
  registerTheme(dark);
  registerTheme(light);
  registerTheme(solarized);
  registerTheme(oled);
}
