/**
 * Vitest setup: happy-dom globals that are missing at runtime.
 *
 * Evidence (Node 26 + happy-dom 20, see Lote 4 investigation):
 *   - `document`, `navigator`, `location` and `sessionStorage` are exposed;
 *   - `localStorage` is NOT — Node >= 22 gates its built-in storage behind
 *     `--localstorage-file`, and happy-dom only registers a persisted
 *     instance for real http(s) origins on the "about:blank" test window.
 *
 * XCoder reads `localStorage` while evaluating module graphs
 * (e.g. src/dialogs/color.js uses `localStorage.__picker_last_picked`,
 * src/sidebarApps/index.js uses `localStorage.getItem(...)`), so without a
 * shim every module importing it throws at import time on some platforms.
 * The shim supports BOTH the Storage API and plain property access, which
 * real WebViews tolerate: `localStorage.myKey === localStorage.myKey`.
 */
if (typeof globalThis.localStorage === "undefined") {
	const store = new Map();

	const keyAt = (index) => [...store.keys()][index] ?? null;

	const storage = {
		__proto__: null,
		getItem(key) {
			return store.has(key) ? store.get(key) : null;
		},
		setItem(key, value) {
			store.set(String(key), String(value));
		},
		removeItem(key) {
			store.delete(String(key));
		},
		clear() {
			store.clear();
		},
		key(index) {
			return keyAt(index);
		},
		get length() {
			return store.size;
		},
	};

	globalThis.localStorage = new Proxy(storage, {
		get(target, prop) {
			if (typeof prop === "symbol" || prop in target) {
				return target[prop];
			}
			const key = String(prop);
			return store.has(key) ? store.get(key) : null;
		},
		set(target, prop, value) {
			if (typeof prop === "symbol" || prop in target) {
				// Only symbols can be set directly; named members go to storage.
				return Reflect.set(target, prop, value);
			}
			store.set(String(prop), String(value));
			return true;
		},
		deleteProperty(target, prop) {
			store.delete(String(prop));
			return true;
		},
		has(target, prop) {
			return prop in target || store.has(String(prop));
		},
	});
}
