/** Minimal typings for the xcoder facade available to plugins. */
export interface Command {
  id: string;
  label: string;
  icon?: string;
  keybinding?: string;
  run(...args: unknown[]): void | Promise<void>;
}
export interface XcoderApi {
  require(name: string): unknown;
  modules(): string[];
  version: string;
}
declare global {
  const xcoder: XcoderApi;
}
