/** import.meta.glob typings for bundler environments (Rspack/Vite). */
interface ImportMeta {
  glob(pattern: string): Record<string, () => Promise<unknown>>;
}
