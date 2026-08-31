/**
 * Python runtime — lazy-loads Pyodide from CDN on first use.
 * In non-browser environments (tests/CI) this degrades gracefully.
 */

export interface PythonResult {
  ok: boolean;
  output: string;
}

let pyodidePromise: Promise<PyodideApi> | null = null;

interface PyodideApi {
  runPythonAsync(code: string): Promise<unknown>;
  setStdout(opts: { batched: (s: string) => void }): void;
  setStderr(opts: { batched: (s: string) => void }): void;
  globals: Map<string, unknown>;
}

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideApi>;
  }
}

const PYODIDE_VERSION = '0.26.4';
const CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function getPyodide(): Promise<PyodideApi> {
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = (async () => {
    if (typeof document === 'undefined') throw new Error('Pyodide requires a browser environment');
    if (!window.loadPyodide) {
      await loadScript(`${CDN}pyodide.js`);
    }
    if (!window.loadPyodide) throw new Error('Pyodide loader unavailable (offline?)');
    return window.loadPyodide({ indexURL: CDN });
  })().catch((err) => {
    pyodidePromise = null;
    throw err;
  });
  return pyodidePromise;
}

/** Run Python code, capturing stdout/stderr. First call downloads ~10MB. */
export async function runPython(code: string): Promise<PythonResult> {
  try {
    const py = await getPyodide();
    const out: string[] = [];
    py.setStdout({ batched: (s) => out.push(s) });
    py.setStderr({ batched: (s) => out.push(s) });
    const value = await py.runPythonAsync(code);
    if (value !== undefined && value !== null) out.push(String(value));
    return { ok: true, output: out.join('\n') };
  } catch (err) {
    return { ok: false, output: (err as Error).message };
  }
}

export function pythonReady(): boolean {
  return pyodidePromise !== null;
}
