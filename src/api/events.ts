/**
 * App-wide event bus.
 * Every cross-module notification in XCoder flows through here — see the
 * catalogue in docs/api-reference.md.
 */
import { Emitter } from '@lib/events';

export interface AppEventMap {
  [key: string]: unknown;
  'app:ready': Record<string, never>;
  'editor:open': { url: string };
  'editor:switch': { url: string };
  'editor:close': { url: string };
  'editor:save': { url: string };
  'editor:dirty': { url: string; isDirty: boolean };
  'fs:update': { url: string; type: 'create' | 'write' | 'delete' | 'rename' };
  'settings:change': { key: string; value: unknown };
  'terminal:open': Record<string, never>;
  'terminal:close': Record<string, never>;
  'lsp:status': { languageId: string; status: 'starting' | 'ready' | 'error' | 'stopped' };
  'plugins:change': { id: string; action: 'install' | 'enable' | 'disable' | 'uninstall' };
  'workspace:change': { folders: string[] };
}

export const events = new Emitter<AppEventMap>();
