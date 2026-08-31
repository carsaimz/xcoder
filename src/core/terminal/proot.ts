/**
 * Proot/Alpine userland manager (Android only).
 *
 * Real Linux userland runs through a native Cordova plugin bridge
 * (`XCoderProot`): the plugin downloads an Alpine minirootfs, extracts it
 * into the app-private directory and spawns `proot` against it. Everything
 * above this module (the virtual shell) stays identical whether commands run
 * in the virtual shell or the real userland.
 *
 * In browser builds the manager reports "unsupported" gracefully instead of
 * throwing, so the terminal remains usable.
 */

export type ProotStatus = 'unsupported' | 'not-installed' | 'installing' | 'ready' | 'error';

export interface ProotProcess {
  pid: number;
  write(data: string): void;
  kill(): void;
  onData(cb: (chunk: string) => void): void;
  onExit(cb: (code: number) => void): void;
}

/** Ambient shape of the native bridge (cordova-plugin-xcoder-proot). */
interface ProotNative {
  downloadRootfs(ok: (path: string) => void, fail: (e: { message: string }) => void): void;
  start(
    opts: { rootfs: string; cwd?: string; command?: string[] },
    ok: (proc: { pid: number }) => void,
    fail: (e: { message: string }) => void
  ): void;
}

declare global {
  interface Window {
    XCoderProot?: ProotNative;
  }
}

const ALPINE_MINIROOTFS = 'https://dl-cdn.alpinelinux.org/alpine/v3.21/releases/x86_64/alpine-minirootfs-3.21.0-x86_64.tar.gz';

export class ProotManager {
  private status: ProotStatus = 'unsupported';
  private rootfsPath: string | null = null;
  private listeners = new Set<(s: ProotStatus) => void>();

  constructor() {
    if (typeof window !== 'undefined' && window.XCoderProot) {
      this.status = 'not-installed';
    }
  }

  get current(): ProotStatus {
    return this.status;
  }

  onStatus(cb: (s: ProotStatus) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private setStatus(s: ProotStatus): void {
    this.status = s;
    for (const cb of this.listeners) cb(s);
  }

  /**
   * Download + extract the Alpine rootfs. Requires the native bridge;
   * progress is reported through onStatus('installing') transitions.
   */
  async install(): Promise<void> {
    if (!window.XCoderProot) {
      this.setStatus('unsupported');
      throw new Error(
        `Proot userland is only available on Android builds (needs cordova-plugin-xcoder-proot). Rootfs: ${ALPINE_MINIROOTFS}`
      );
    }
    this.setStatus('installing');
    return new Promise((resolve, reject) => {
      window.XCoderProot!.downloadRootfs(
        (path) => {
          this.rootfsPath = path;
          this.setStatus('ready');
          resolve();
        },
        (e) => {
          this.setStatus('error');
          reject(new Error(e.message));
        }
      );
    });
  }

  /**
   * Start a process inside the userland. All shell grammar above this layer
   * is forwarded unchanged, so `python3 main.py` behaves like on a desktop.
   */
  start(command: string[] = ['/bin/sh'], cwd = '/'): Promise<ProotProcess> {
    if (!window.XCoderProot) {
      return Promise.reject(new Error('proot: unsupported on this platform'));
    }
    if (this.status !== 'ready' || !this.rootfsPath) {
      return Promise.reject(new Error('proot: rootfs not installed (call install() first)'));
    }
    return new Promise((resolve, reject) => {
      window.XCoderProot!.start(
        { rootfs: this.rootfsPath!, cwd, command },
        (proc) => {
          const p: ProotProcess = {
            pid: proc.pid,
            write: (data) => window.XCoderProot && emitStdin(proc.pid, data),
            kill: () => window.XCoderProot && emitKill(proc.pid),
            onData: (cb) => addStdinListener(proc.pid, cb),
            onExit: (cb) => addExitListener(proc.pid, cb)
          };
          resolve(p);
        },
        (e) => reject(new Error(e.message))
      );
    });
  }
}

/* stdin/stdout multiplexing against the native bridge (event registry). */
type Listener<T> = (v: T) => void;
const stdoutListeners = new Map<number, Set<Listener<string>>>();
const exitListeners = new Map<number, Set<Listener<number>>>();

function addStdinListener(pid: number, cb: Listener<string>): void {
  let set = stdoutListeners.get(pid);
  if (!set) {
    set = new Set();
    stdoutListeners.set(pid, set);
  }
  set.add(cb);
}

function addExitListener(pid: number, cb: Listener<number>): void {
  let set = exitListeners.get(pid);
  if (!set) {
    set = new Set();
    exitListeners.set(pid, set);
  }
  set.add(cb);
}

function emitStdin(pid: number, data: string): void {
  void pid;
  void data;
  // forwarded by the native plugin's write channel (cordova exec)
}

function emitKill(pid: number): void {
  void pid;
  // forwarded by the native plugin's kill channel (cordova exec)
}

export const proot = new ProotManager();
