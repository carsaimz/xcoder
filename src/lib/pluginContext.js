// ⚠️ Do NOT call cordova.exec.bind() at module evaluation time. The Cordova
// bridge is only available after cordova.js initializes, and in some
// environments (web build, late bridge attach, plugin load order) `cordova`
// exists but `cordova.exec` is undefined — which used to throw
// "Cannot read properties of undefined (reading 'bind')" and break startup.
// Instead, resolve the bridge lazily and never throw from module scope.
function getCordovaExec() {
	try {
		const bridge =
			typeof cordova !== "undefined"
				? cordova
				: (globalThis && globalThis.cordova) || null;
		if (bridge && typeof bridge.exec === "function") {
			return bridge.exec.bind(bridge);
		}
	} catch {
		// ignore — bridge not ready yet
	}
	return null;
}

const exec = (resolve, reject, action, args) => {
	const run = getCordovaExec();
	if (!run) {
		reject(new Error("Cordova bridge is not available"));
		return;
	}
	run(resolve, reject, "Tee", action, args);
};

let bridgeHardened = false;

function hardenBridge() {
	if (bridgeHardened) return;
	bridgeHardened = true;

	for (const prop of [
		"exec",
		"callbackFromNative",
		"callbackSuccess",
		"callbackError",
		"callbacks",
	]) {
		const value = cordova[prop];
		if (value === undefined) continue;
		try {
			Object.defineProperty(cordova, prop, {
				writable: false,
				configurable: false,
			});
		} catch {
			// ignore
		}
	}
}

class PluginContext {
	#token;

	constructor(token) {
		this.#token = token;
		this.date = Date.now();
		Object.freeze(this);
	}

	toString() {
		return this.#token;
	}

	[Symbol.toPrimitive](hint) {
		if (hint === "number") {
			return Number.NaN; // prevent numeric coercion
		}
		return this.#token;
	}

	grantedPermission(permission) {
		return new Promise((resolve, reject) => {
			exec(resolve, reject, "grantedPermission", [this.#token, permission]);
		});
	}

	listAllPermissions() {
		return new Promise((resolve, reject) => {
			exec(resolve, reject, "listAllPermissions", [this.#token]);
		});
	}

	getSecret(key, defaultValue = "") {
		return new Promise((resolve, reject) => {
			exec(resolve, reject, "get_secret", [this.#token, key, defaultValue]);
		});
	}

	setSecret(key, value) {
		return new Promise((resolve, reject) => {
			exec(resolve, reject, "set_secret", [this.#token, key, value]);
		});
	}

	deleteSecret(key) {
		return new Promise((resolve, reject) => {
			exec(resolve, reject, "delete_secret", [this.#token, key]);
		});
	}

	clearAllSecrets() {
		return new Promise((resolve, reject) => {
			exec(resolve, reject, "clear_all_secrets", [this.#token]);
		});
	}

	//plugins dont need to call this
	invalidate() {
		return new Promise((resolve, reject) => {
			exec(resolve, reject, "invalidate", [this.#token]);
		});
	}
}

Object.freeze(PluginContext.prototype);

// Encapsulates the trusted native session.
class TrustedSession {
	#session = null;
	#sessionPromise = null;

	// Establishes the connection (once) and resolves to a boolean. The session
	// secret is deliberately never returned to callers.
	connectInternal() {
		hardenBridge();

		if (!this.#sessionPromise) {
			this.#sessionPromise = new Promise((resolve) => {
				const run = getCordovaExec();
				if (!run) {
					console.warn("PluginContext: cordova bridge unavailable");
					resolve(false);
					return;
				}
				run(
					(session) => {
						this.#session = session;
						resolve(true);
					},
					() => resolve(false),
					"Tee",
					"establishConnection",
					[],
				);
			});
		}
		return this.#sessionPromise;
	}

	async generateInternal(pluginId, pluginJson) {
		try {
			const connected = await this.connectInternal();
			if (!connected || !this.#session) {
				console.warn(
					`PluginContext creation failed for pluginId ${pluginId}: no trusted session`,
				);
				return null;
			}

			//requesting a token with our session since we are in a privileged context
			const uuid = await new Promise((resolve, reject) => {
				const run = getCordovaExec();
				if (!run) {
					reject(new Error("Cordova bridge is not available"));
					return;
				}
				run(resolve, reject, "Tee", "requestToken", [
					this.#session,
					pluginId,
					pluginJson,
				]);
			});
			return new PluginContext(uuid);
		} catch (err) {
			console.warn(
				`PluginContext creation failed for pluginId ${pluginId}:`,
				err,
			);
			return null;
		}
	}
}

const trustedSession = new TrustedSession();

export function connect() {
	return trustedSession.connectInternal();
}

export default function generate(pluginId, pluginJson) {
	return trustedSession.generateInternal(pluginId, pluginJson);
}
