/**
 * Shared CodeMirror 6 extension set used by every editor instance.
 * Values that can change at runtime (theme, language, wrap, font) are
 * injected through compartments by editorManager.
 */
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { foldGutter, indentOnInput, bracketMatching, foldKeymap, indentUnit } from '@codemirror/language';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { lintKeymap } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';

export { Compartment, EditorState };

/** Compartments owned by the app (reconfigured on settings/theme changes). */
export const editorCompartments = {
  theme: new Compartment(),
  language: new Compartment(),
  wrap: new Compartment(),
  font: new Compartment(),
  lsp: new Compartment()
};

export function baseExtensions(opts: { tabSize: number; wordWrap: boolean; fontSize: number }): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    autocompletion({ activateOnTyping: true, maxRenderedOptions: 40 }),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    indentUnit.of(' '.repeat(opts.tabSize)),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      ...lintKeymap,
      indentWithTab
    ])
  ];
}

export function wrapExtension(wordWrap: boolean): Extension {
  return wordWrap ? EditorView.lineWrapping : [];
}

export function fontExtension(fontSize: number): Extension {
  return EditorView.theme({
    '&': { fontSize: `${fontSize}px` }
  });
}
