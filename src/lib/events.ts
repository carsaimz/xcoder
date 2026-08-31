/**
 * Minimal typed emitter used by the app event bus and by individual modules.
 * DOM-free (Node-safe).
 */

export type Handler<P> = (payload: P) => void;

export class Emitter<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<Handler<never>>>();

  /** Subscribe. Returns an unsubscribe function. */
  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(event, handler);
  }

  /** Subscribe for a single emission. */
  once<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  /** Unsubscribe. Safe to call even if never subscribed. */
  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    this.listeners.get(event)?.delete(handler as Handler<never>);
  }

  /** Emit. Exceptions in handlers are captured and logged, never thrown back. */
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        (handler as unknown as Handler<Events[K]>)(payload);
      } catch (err) {
        // One broken subscriber must not break the chain.
        console.error(`[xcoder] event handler error (${String(event)})`, err);
      }
    }
  }

  /** Remove every listener for an event (or all events). */
  clear(event?: keyof Events): void {
    if (event === undefined) this.listeners.clear();
    else this.listeners.delete(event);
  }
}
