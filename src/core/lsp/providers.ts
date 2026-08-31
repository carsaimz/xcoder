/**
 * LSP → CodeMirror 6 bridges: completion source, hover tooltip and lint
 * (diagnostics). These extensions get injected into the `lsp` compartment
 * when a session is available for the editor's language.
 */
import { hoverTooltip } from '@codemirror/view';
import { autocompletion, type CompletionContext, type CompletionResult, type CompletionSource, type Completion } from '@codemirror/autocomplete';
import { linter, type Diagnostic } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { LspSession } from './client';
import { getSession } from './manager';

function toCmCompletion(item: {
  label: string;
  detail?: string;
  insertText?: string;
  textEdit?: { newText: string };
  kind?: number;
}): Completion {
  return {
    label: item.label,
    detail: item.detail,
    apply: item.textEdit?.newText ?? item.insertText ?? item.label,
    type: mapKind(item.kind)
  };
}

function mapKind(kind?: number): string | undefined {
  // LSP CompletionItemKind → CM type strings (partial mapping)
  const table: Record<number, string> = {
    1: 'text', 2: 'method', 3: 'function', 4: 'function', 5: 'class',
    6: 'class', 7: 'keyword', 8: 'variable', 9: 'variable', 10: 'property',
    11: 'variable', 12: 'function', 13: 'keyword', 14: 'enum', 15: 'keyword',
    16: 'constant', 17: 'class', 18: 'keyword', 19: 'type', 20: 'keyword',
    21: 'keyword', 22: 'keyword', 23: 'keyword', 24: 'keyword', 25: 'keyword'
  };
  return kind ? table[kind] : undefined;
}

export function lspCompletionSource(session: LspSession, url: string): CompletionSource {
  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    if (!context.explicit && context.matchBefore(/\s/)) return null;
    const line = context.state.doc.lineAt(context.pos);
    const column = context.pos - line.from;
    const items = await session.completion(url, line.number, column);
    if (!items.length) return null;
    return {
      from: context.pos,
      options: items.map(toCmCompletion),
      validFor: /^[\w$.-]*$/
    };
  };
}

export function lspHover(session: LspSession, url: string): Extension {
  return hoverTooltip(async (view: EditorView, pos: number) => {
    const line = view.state.doc.lineAt(pos);
    const column = pos - line.from;
    const result = await session.hover(url, line.number, column);
    if (!result) return null;
    return {
      pos,
      create: () => {
        const dom = document.createElement('div');
        dom.className = 'lsp-hover';
        dom.textContent = result.contents.value ?? '';
        return { dom };
      }
    };
  });
}

function posAt(view: EditorView, lineIdx: number, character: number): number {
  const lineCount = view.state.doc.lines;
  const line = view.state.doc.line(Math.min(Math.max(1, lineIdx + 1), lineCount));
  return Math.min(line.from + Math.max(0, character), line.to);
}

/** Lint source forwarding publishDiagnostics into CM squiggles. */
export function lspDiagnostics(session: LspSession, url: string): Extension {
  return linter(async (view: EditorView): Promise<Diagnostic[]> => {
    session.documentChange(url, view.state.doc.toString());
    return new Promise((resolve) => {
      const off = session.onDiagnostics((diagUrl, diags) => {
        if (diagUrl !== url) return;
        off();
        resolve(
          diags.map((d) => ({
            from: posAt(view, d.range.start.line, d.range.start.character),
            to: posAt(view, d.range.end.line, d.range.end.character),
            severity: (['error', 'warning', 'info'] as const)[
              Math.min(2, Math.max(0, (d.severity ?? 3) - 1))
            ],
            message: d.message,
            source: d.source ?? 'lsp'
          }))
        );
      });
      // hard timeout: never hang the editor on a silent server
      setTimeout(() => {
        off();
        resolve([]);
      }, 3000);
    });
  });
}

/** Full extension set for an editor whose language has a configured server. */
export async function lspExtensionsFor(url: string, languageId: string): Promise<Extension[]> {
  const session = await getSession(languageId);
  if (!session) return [];
  session.documentOpen({ uri: url, languageId, text: '' });
  return [
    autocompletion({ override: [lspCompletionSource(session, url)] }),
    lspHover(session, url),
    lspDiagnostics(session, url)
  ];
}
