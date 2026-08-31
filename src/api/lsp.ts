/**
 * Facade — LSP client.
 */
import * as manager from '@core/lsp/manager';
import { lspExtensionsFor } from '@core/lsp/providers';
import type { LspSession, LspServerConfig } from '@core/lsp/client';

export type { LspSession, LspServerConfig, CompletionItem, LspDiagnostic, LspLocation } from '@core/lsp/client';

export const lsp = {
  registerServer: (languageId: string, config: LspServerConfig) =>
    manager.registerServer(languageId, config),
  getSession: (languageId: string) => manager.getSession(languageId),
  stop: (languageId: string) => manager.stop(languageId),
  status: () => manager.status(),
  /** internal — used by editorManager to attach CM extensions */
  extensionsFor: lspExtensionsFor
};
