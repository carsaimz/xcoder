/**
 * XCoder public API typings — for plugin authors.
 *
 * Usage inside a plugin project:
 *   /// <reference path="<XCoder>/src/types/xcoder.d.ts" />
 * or copy this file next to your `main.js` as `xcoder.d.ts`.
 *
 * Full documentation: docs/api-reference.md
 */
import type { PluginPage } from '../api/plugins/page';

// ---------------------------------------------------------------------------
// Plugin contract
// ---------------------------------------------------------------------------

export interface PluginAuthor {
  name: string;
  email?: string;
  github?: string;
  url?: string;
}

export interface PluginManifest {
  id: string; // reverse-DNS: 'com.xcoder.meu-plugin'
  name: string;
  version: string;
  main?: string; // default 'main.js'
  icon?: string;
  author: PluginAuthor;
  files?: string[];
  minAppVersion?: string;
  keywords?: string[];
  description?: string;
}

export interface FileHandle {
  url: string;
  read(): Promise<string>;
  write(content: string): Promise<void>;
  exists(): Promise<boolean>;
}

export interface PluginCache {
  /** JSON file dedicated to this plugin (persistent). */
  cacheFileUrl: string;
  cacheFile: FileHandle;
  /** true only on the very first init — run one-time setup/migrations. */
  firstInit: boolean;
}

export type PluginInitFn = (
  baseUrl: string,
  $page: PluginPage,
  cache: PluginCache
) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

export interface Command {
  name: string; // namespaced: 'file.save', 'meu-plugin.ping'
  description: string;
  icon?: string;
  bindKey?: { win?: string; mac?: string };
  exec(...args: unknown[]): unknown | Promise<unknown>;
}

export interface CommandsModule {
  addCommand(cmd: Command): void;
  removeCommand(name: string): void;
  exec(name: string, ...args: unknown[]): Promise<unknown>;
  list(): Command[];
  has(name: string): boolean;
}

export interface FileEntry {
  name: string;
  url: string;
  isDir: boolean;
  size?: number;
  mtime?: number;
}

export interface SearchHit {
  url: string;
  name: string;
  kind: 'name' | 'content';
  preview?: string;
}

export interface FileSystemBackend {
  id: string;
  scheme: string;
  displayName: string;
  capabilities: { write: boolean; watch: boolean };
  stat(url: string): Promise<FileEntry>;
  list(url: string): Promise<FileEntry[]>;
  read(url: string): Promise<string>;
  write(url: string, content: string): Promise<void>;
  mkdir(url: string): Promise<void>;
  delete(url: string): Promise<void>;
  rename(oldUrl: string, newUrl: string): Promise<void>;
  copy?(src: string, dest: string): Promise<void>;
}

export interface FileSystemModule {
  read(url: string): Promise<string>;
  write(url: string, content: string): Promise<void>;
  createFile(url: string, content?: string): Promise<FileEntry>;
  createDir(url: string): Promise<FileEntry>;
  list(url: string): Promise<FileEntry[]>;
  stat(url: string): Promise<FileEntry>;
  exists(url: string): Promise<boolean>;
  delete(url: string): Promise<void>;
  rename(oldUrl: string, newUrl: string): Promise<void>;
  copy(src: string, dest: string): Promise<void>;
  search(rootUrl: string, pattern: string, opts?: { maxResults?: number }): Promise<SearchHit[]>;
  registerBackend(backend: FileSystemBackend): void;
  listBackends(): FileSystemBackend[];
  openFile(url: string): Promise<unknown>;
  workspace: {
    addFolder(url: string): Promise<void>;
    removeFolder(url: string): Promise<void>;
    listFolders(): string[];
    openWorkspaceFile(content: string): Promise<string[]>;
  };
}

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastModule {
  show(message: string, type?: ToastType, duration?: number): void;
  info(message: string, duration?: number): void;
  success(message: string, duration?: number): void;
  warning(message: string, duration?: number): void;
  error(message: string, duration?: number): void;
  clear(): void;
}

export interface DialogModule {
  alert(title: string, message: string): Promise<void>;
  confirm(title: string, message: string): Promise<boolean>;
  prompt(
    title: string,
    message: string,
    opts?: { value?: string; placeholder?: string; type?: string; required?: boolean }
  ): Promise<string | null>;
  select(title: string, message: string, options: string[], selectedIndex?: number): Promise<number | null>;
}

export interface SettingsModule {
  get<K extends keyof SettingsShape>(key: K): SettingsShape[K];
  set<K extends keyof SettingsShape>(key: K, value: SettingsShape[K]): Promise<void>;
  all(): Readonly<SettingsShape>;
  reset(): Promise<void>;
}

export interface SettingsShape {
  theme: 'dark' | 'light' | 'solarized';
  fontSize: number;
  tabSize: 2 | 4 | 8;
  wordWrap: boolean;
  autoSave: boolean;
  lang: string;
  'terminal.fontSize': number;
  'lsp.servers': Record<string, unknown>;
  'ai.provider': string;
  'ai.model': string;
  'ai.keys': Record<string, string>;
  'ai.customProviders': Array<Record<string, unknown>>;
  'ai.temperature': number;
  'ai.maxTokens': number;
  'ai.maxTurns': number;
  'ai.streaming': boolean;
  'ai.approval': 'careful' | 'balanced' | 'auto';
}

export interface EventsModule {
  on<E extends keyof AppEventMap>(
    event: E,
    cb: (payload: AppEventMap[E]) => void
  ): () => void;
  once<E extends keyof AppEventMap>(event: E, cb: (payload: AppEventMap[E]) => void): () => void;
  off<E extends keyof AppEventMap>(event: E, cb: (payload: AppEventMap[E]) => void): void;
  emit<E extends keyof AppEventMap>(event: E, payload: AppEventMap[E]): void;
}

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
  'ai:run-start': { sessionId: string; runId: string; agentId: string; depth: number };
  'ai:delta': { sessionId: string; runId: string; depth: number; text: string };
  'ai:tool-start': { sessionId: string; runId: string; depth: number; callId: string; name: string; args: Record<string, unknown>; risk: string };
  'ai:tool-end': { sessionId: string; runId: string; depth: number; callId: string; ok: boolean; result: string };
  'ai:note': { sessionId: string; depth: number; text: string };
  'ai:run-end': { sessionId: string; runId: string; depth: number; ok: boolean; error?: string };
  'ai:session-changed': { id: string };
  'ai:sessions-changed': Record<string, never>;
}

export interface CacheModule {
  get<T>(key: string, fallback?: T): Promise<T>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  clear(prefix?: string): Promise<void>;
}

export interface ShellContext {
  cwd(): string;
  setCwd(url: string): void;
  print(text: string): void;
  printErr(text: string): void;
  env: Record<string, string>;
  exit?(): void;
  openFile?(url: string): void;
}

export interface ShellCommand {
  name: string;
  description: string;
  usage?: string;
  valueFlags?: string[];
  run(ctx: ShellContext, args: string[], flags: Record<string, boolean | string>): number | Promise<number>;
}

export interface TerminalModule {
  open(): void;
  close(): void;
  toggle(): void;
  shell: {
    registerCommand(cmd: ShellCommand): void;
    commands(): ShellCommand[];
    readonly cwd: string;
  };
  exec(line: string, opts?: { cwdUrl?: string }): Promise<{ code: number; output: string }>;
}

export interface PluginRecord {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  baseUrl: string;
  manifest: PluginManifest;
}

export interface PluginsModule {
  list(): Promise<PluginRecord[]>;
  get(id: string): Promise<PluginRecord | undefined>;
  install(source: { zipUrl?: string; dirUrl?: string }): Promise<PluginRecord>;
  enable(id: string): Promise<void>;
  disable(id: string): Promise<void>;
  uninstall(id: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Global object
// ---------------------------------------------------------------------------

export interface XCoderApi {
  require<T = unknown>(name: XCoderModuleName | (string & {})): T;
  setPluginInit(id: string, init: PluginInitFn): void;
  setPluginUnmount(id: string, unmount: () => void): void;
  readonly version: string;
  readonly isAndroid: boolean;
}

export type XCoderModuleName =
  | 'commands'
  | 'editorManager'
  | 'editorLanguages'
  | 'editorThemes'
  | 'xcoder.codemirror'
  | 'fileSystem'
  | 'terminal'
  | 'lsp'
  | 'ai'
  | 'settings'
  | 'dialog'
  | 'toast'
  | 'events'
  | 'cache'
  | 'plugins';

declare global {
  interface Window {
    xcoder: XCoderApi;
  }
}

export interface AiModule {
  providers(): unknown[];
  agents(): Array<{ id: string; name: string; emoji: string; description: string }>;
  tools(): Array<{ name: string; risk: string; label: string }>;
  listSessions(): Promise<unknown[]>;
  newSession(agentId?: string): Promise<unknown>;
  openSession(id: string): Promise<unknown>;
  deleteSession(id: string): Promise<void>;
  send(text: string, ctx?: { file?: boolean; selection?: boolean; tree?: boolean }): Promise<void>;
  runAgent(agentId: string, task: string): Promise<string>;
  abort(sessionId?: string): void;
  isRunning(sessionId?: string): boolean;
  on(event: string, cb: (payload: unknown) => void): () => void;
}

export {};
