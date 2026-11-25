/**
 * Beautify worker — runs Prettier OUTSIDE the main thread.
 *
 * Root cause fixed (v1.8.38): beautifying a minified HTML page with
 * prettier/standalone takes minutes on a phone CPU. Running it inline
 * froze the whole app («A embelezar…» forever) and the Promise.race
 * timeout could never fire, because timers do not run while the main
 * thread is blocked. The worker keeps the UI responsive and can be
 * TERMINATED when it takes too long — a timeout that actually works.
 *
 * Protocol (mirror of replWorker):
 *   in : {id, code, lang}
 *   out: {id, ok: true, value} | {id, ok: false, error}
 *
 * Bundled as its own rspack entry (build/beautifyWorker.js) and loaded
 * lazily with new Worker("build/beautifyWorker.js") — prettier only
 * reaches the device when the user actually beautifies something.
 */

import parserBabel from "prettier/plugins/babel";
import parserEstree from "prettier/plugins/estree";
import parserHtml from "prettier/plugins/html";
import parserPostcss from "prettier/plugins/postcss";
import { format } from "prettier/standalone";

const PARSERS = {
	js: { parser: "babel", plugins: [parserBabel, parserEstree] },
	json: { parser: "json", plugins: [parserBabel, parserEstree] },
	css: { parser: "css", plugins: [parserPostcss] },
	html: {
		parser: "html",
		plugins: [parserHtml, parserPostcss, parserBabel, parserEstree],
	},
};

self.onmessage = async (event) => {
	const { id, code, lang } = event.data || {};
	if (!id) return;
	try {
		const config = PARSERS[lang] || PARSERS.js;
		const value = await format(String(code ?? ""), {
			parser: config.parser,
			plugins: config.plugins,
			tabWidth: 2,
			printWidth: 100,
		});
		self.postMessage({ id, ok: true, value });
	} catch (error) {
		self.postMessage({
			id,
			ok: false,
			error: String(error?.message || error || "format failed"),
		});
	}
};
