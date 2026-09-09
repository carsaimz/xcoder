/**
 * REPL sandbox worker (roadmap v1.6.x item 2).
 *
 * Runs user JavaScript inside a Web Worker — no DOM, no Cordova, no app
 * scope. Console output and the final result are posted back as JSON
 * messages: {id, kind: "log"|"result"|"error", text}.
 *
 * Async code is supported: the snippet is wrapped in an async IIFE and
 * the worker awaits it before posting the result. Top-level await also
 * works through the same wrapper.
 */

/** Serializes any value to a printable single-line-ish string. */
function stringify(value, depth = 0) {
	if (depth > 3) return "…";
	if (typeof value === "string") {
		return depth === 0 ? value : JSON.stringify(value);
	}
	if (value === null) return "null";
	if (value === undefined) return "undefined";
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	if (typeof value === "function") {
		return `[Function: ${value.name || "anonymous"}]`;
	}
	if (typeof value === "symbol" || typeof value === "bigint") {
		return String(value);
	}
	if (value instanceof Error) {
		return value.stack || `${value.name}: ${value.message}`;
	}
	if (Array.isArray(value)) {
		if (value.length > 100) return `Array(${value.length})`;
		return `[${value.map((item) => stringify(item, depth + 1)).join(", ")}]`;
	}
	if (value instanceof Map) {
		return `Map(${value.size})`;
	}
	if (value instanceof Set) {
		return `Set(${value.size})`;
	}
	if (typeof value === "object") {
		try {
			const entries = Object.entries(value);
			if (!entries.length) return "{}";
			const shown = entries
				.slice(0, 30)
				.map(([key, val]) => `${key}: ${stringify(val, depth + 1)}`);
			const more = entries.length > 30 ? `, …+${entries.length - 30} more` : "";
			return `{${shown.join(", ")}${more}}`;
		} catch {
			return "[unserializable object]";
		}
	}
	return String(value);
}

/** Entry point shape: the module is both a worker script and testable. */
export function createReplRuntime(post) {
	/**
	 * Evaluates a snippet and streams feedback via post().
	 * @param {number|string} id request id
	 * @param {string} code user code
	 */
	return async function evaluate(id, code) {
		const send = (kind, text) => {
			post({ id, kind, text });
		};
		const push = (kind, args) => {
			send(kind, args.map((arg) => stringify(arg)).join(" "));
		};

		const sandboxConsole = {
			log: (...args) => push("log", args),
			info: (...args) => push("log", args),
			debug: (...args) => push("log", args),
			warn: (...args) => push("warn", args),
			error: (...args) => push("error", args),
			table: (...args) => push("log", args),
		};

		try {
			// Chrome DevTools-style: evaluate as an EXPRESSION first (so the
			// last expression's value comes back, REPL-style); fall back to
			// plain statements when that fails to parse (const/loops/etc.).
			let evaluate;
			try {
				evaluate = new Function(
					"console",
					"return (async () => {\n" +
						'"use strict";\n' +
						"return (\n" +
						code +
						"\n);\n" +
						"})()",
				);
			} catch {
				evaluate = new Function(
					"console",
					"return (async () => {\n" + '"use strict";\n' + code + "\n})()",
				);
			}
			const result = await evaluate(sandboxConsole);
			if (result !== undefined) send("result", stringify(result));
			else send("done", "");
		} catch (error) {
			send("error", stringify(error) || String(error));
		}
	};
}

/* Worker bootstrap — skipped when imported by unit tests. */
if (typeof self !== "undefined" && typeof self.postMessage === "function") {
	const evaluate = createReplRuntime((message) => self.postMessage(message));
	self.onmessage = (event) => {
		const { id, code } = event.data || {};
		if (typeof code !== "string") return;
		Promise.resolve(evaluate(id, code)).catch((error) => {
			self.postMessage({ id, kind: "error", text: String(error) });
		});
	};
}
