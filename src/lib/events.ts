/** Typed-ish event bus with on/off/once/emit. */

export type Listener<T = unknown> = (data: T) => void;
export type Unsubscribe = () => void;

export class EventBus {
  private handlers = new Map<string, Set<Listener>>();

  on<T = unknown>(event: string, fn: Listener<T>): Unsubscribe {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(fn as Listener);
    return () => this.off(event, fn);
  }

  once<T = unknown>(event: string, fn: Listener<T>): Unsubscribe {
    const wrapped: Listener<T> = (data) => {
      this.off(event, wrapped);
      fn(data);
    };
    return this.on(event, wrapped);
  }

  off<T = unknown>(event: string, fn: Listener<T>): void {
    this.handlers.get(event)?.delete(fn as Listener);
  }

  emit<T = unknown>(event: string, data?: T): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(data as T);
      } catch (err) {
        console.error(`[bus] handler for "${event}" failed:`, err);
      }
    }
  }

  clear(event?: string): void {
    if (event) this.handlers.delete(event);
    else this.handlers.clear();
  }
}

/** Application-wide bus. Events use `domain:action` names, e.g. `editor:open`. */
export const bus = new EventBus();
