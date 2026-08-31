/**
 * LSP client session — initialize handshake, document sync and the request
 * set XCoder consumes (completion, hover, definition, references,
 * diagnostics). One session per language server.
 */
import { JsonRpcConnection } from './jsonrpc';
import { connect, type Transport } from './transport';
import { events } from '@api/events';

export interface ServerCapabilities {
  textDocumentSync?: number | { openClose?: boolean; change?: number };
  completionProvider?: { triggerCharacters?: string[] };
  hoverProvider?: boolean;
  definitionProvider?: boolean;
  referencesProvider?: boolean;
}

export interface CompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  documentation?: string | { value: string };
  insertText?: string;
  textEdit?: { newText: string; range: unknown };
  sortText?: string;
}

export interface Hover {
  contents: { value: string; kind?: string };
  range?: unknown;
}

export interface LspLocation {
  uri: string;
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
}

export interface LspDiagnostic {
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  severity?: number; // 1 error, 2 warning, 3 info, 4 hint
  message: string;
  source?: string;
  code?: string | number;
}

export interface LspSession {
  readonly languageId: string;
  readonly capabilities: ServerCapabilities;
  documentOpen(doc: { uri: string; languageId: string; text: string }): void;
  documentChange(uri: string, text: string): void;
  documentClose(uri: string): void;
  completion(uri: string, line: number, column: number): Promise<CompletionItem[]>;
  hover(uri: string, line: number, column: number): Promise<Hover | null>;
  definition(uri: string, line: number, column: number): Promise<LspLocation[]>;
  references(uri: string, line: number, column: number): Promise<LspLocation[]>;
  onDiagnostics(cb: (uri: string, diags: LspDiagnostic[]) => void): () => void;
  dispose(): Promise<void>;
}

/** XCoder URL → document URI. file:// passes through; other schemes are namespaced. */
export function toDocUri(url: string): string {
  if (url.startsWith('file://')) return url;
  return url.replace(/^([a-zA-Z][\w+.-]*):\/\//, (_m, scheme: string) => `xcoder://${scheme}/`);
}

export interface LspServerConfig {
  transport: 'websocket' | 'worker';
  url?: string;
  workerUrl?: string;
  rootUrl?: string;
}

export function fromDocUri(uri: string): string {
  if (uri.startsWith('xcoder://')) return uri.replace(/^xcoder:\/\//, (m) => m);
  return uri;
}

class Session implements LspSession {
  languageId: string;
  capabilities: ServerCapabilities = {};
  private conn: JsonRpcConnection;
  private transport: Transport;
  private diagCbs = new Set<(uri: string, diags: LspDiagnostic[]) => void>();
  private opened = new Set<string>();

  constructor(languageId: string, transport: Transport) {
    this.languageId = languageId;
    this.transport = transport;
    this.conn = connect(transport);
    this.conn.on('textDocument/publishDiagnostics', (params) => {
      const p = params as { uri: string; diagnostics: LspDiagnostic[] };
      for (const cb of this.diagCbs) cb(fromDocUri(p.uri), p.diagnostics ?? []);
    });
  }

  async initialize(rootUrl: string): Promise<void> {
    const result = (await this.conn.sendRequest('initialize', {
      processId: null,
      rootUri: toDocUri(rootUrl),
      capabilities: {
        textDocument: {
          completion: { completionItem: { snippetSupport: false } },
          hover: { contentFormat: ['markdown', 'plaintext'] }
        }
      },
      workspaceFolders: [{ uri: toDocUri(rootUrl), name: rootUrl.split('/').pop() ?? 'workspace' }]
    })) as { capabilities?: ServerCapabilities };
    this.capabilities = result?.capabilities ?? {};
    this.conn.sendNotification('initialized', {});
  }

  documentOpen(doc: { uri: string; languageId: string; text: string }): void {
    const uri = toDocUri(doc.uri);
    if (this.opened.has(uri)) return;
    this.opened.add(uri);
    this.conn.sendNotification('textDocument/didOpen', {
      textDocument: { uri, languageId: doc.languageId, version: 1, text: doc.text }
    });
  }

  documentChange(uri: string, text: string): void {
    const docUri = toDocUri(uri);
    if (!this.opened.has(docUri)) return;
    this.conn.sendNotification('textDocument/didChange', {
      textDocument: { uri: docUri, version: Date.now() },
      contentChanges: [{ text }]
    });
  }

  documentClose(uri: string): void {
    const docUri = toDocUri(uri);
    if (!this.opened.delete(docUri)) return;
    this.conn.sendNotification('textDocument/didClose', {
      textDocument: { uri: docUri }
    });
  }

  async completion(uri: string, line: number, column: number): Promise<CompletionItem[]> {
    const res = (await this.conn.sendRequest('textDocument/completion', {
      textDocument: { uri: toDocUri(uri) },
      position: { line: line - 1, character: column }
    })) as { items?: CompletionItem[] } | CompletionItem[] | null;
    if (!res) return [];
    return Array.isArray(res) ? res : (res.items ?? []);
  }

  async hover(uri: string, line: number, column: number): Promise<Hover | null> {
    return this.conn.sendRequest('textDocument/hover', {
      textDocument: { uri: toDocUri(uri) },
      position: { line: line - 1, character: column }
    }) as Promise<Hover | null>;
  }

  async definition(uri: string, line: number, column: number): Promise<LspLocation[]> {
    const res = await this.conn.sendRequest('textDocument/definition', {
      textDocument: { uri: toDocUri(uri) },
      position: { line: line - 1, character: column }
    });
    if (!res) return [];
    return Array.isArray(res) ? (res as LspLocation[]) : [res as LspLocation];
  }

  async references(uri: string, line: number, column: number): Promise<LspLocation[]> {
    const res = (await this.conn.sendRequest('textDocument/references', {
      textDocument: { uri: toDocUri(uri) },
      position: { line: line - 1, character: column },
      context: { includeDeclaration: true }
    })) as LspLocation[] | null;
    return res ?? [];
  }

  onDiagnostics(cb: (uri: string, diags: LspDiagnostic[]) => void): () => void {
    this.diagCbs.add(cb);
    return () => this.diagCbs.delete(cb);
  }

  async dispose(): Promise<void> {
    this.conn.sendNotification('shutdown', {});
    this.conn.sendNotification('exit', {});
    this.conn.close();
    this.transport.dispose();
    events.emit('lsp:status', { languageId: this.languageId, status: 'stopped' });
  }
}

/** Create + initialize a session over the given transport. */
export async function createSession(
  languageId: string,
  transport: Transport,
  rootUrl: string
): Promise<Session> {
  events.emit('lsp:status', { languageId, status: 'starting' });
  const session = new Session(languageId, transport);
  try {
    await session.initialize(rootUrl);
    events.emit('lsp:status', { languageId, status: 'ready' });
  } catch (err) {
    events.emit('lsp:status', { languageId, status: 'error' });
    throw err;
  }
  return session;
}
