/** CodeMirror 6 + Lezer namespace re-exported to plugins. */
export {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightSpecialChars
} from '@codemirror/view';
export {
  EditorState,
  Compartment,
  EditorSelection,
  RangeSetBuilder,
  StateEffect,
  StateField,
  Prec,
  type Extension
} from '@codemirror/state';
export { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
export {
  foldGutter,
  indentOnInput,
  bracketMatching,
  foldKeymap,
  indentUnit,
  LanguageSupport,
  StreamLanguage
} from '@codemirror/language';
export { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, type Completion } from '@codemirror/autocomplete';
export { searchKeymap, highlightSelectionMatches, search } from '@codemirror/search';
export { linter, lintKeymap, type Diagnostic } from '@codemirror/lint';
export { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
export * as lezer from '@lezer/common';
export { tags } from '@lezer/highlight';
