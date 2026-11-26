// @vitest-environment happy-dom
import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Runtime reproduction of the marketplace install failure reported for
 * Inspector / Site Analyzer / Scraper (the plugins "never install").
 *
 * Runs the REAL chain installPlugin -> loadPluginWithTimeout -> loadPlugin
 * -> xcoder.initPlugin -> plugin main.js init (sidebarApps.add included) in
 * jsdom, with only the native layer (cordova, file system, dialogs) mocked.
 * The plugin main.js is executed by jsdom from a local static server, the
 * same way the Android WebView executes it from device storage.
 */

// ── Browser APIs jsdom lacks (the app graph touches them at import time) ──
window.matchMedia ??= (query) => ({
	matches: false,
	media: query,
	onchange: null,
	addListener: () => {},
	removeListener: () => {},
	addEventListener: () => {},
	removeEventListener: () => {},
	dispatchEvent: () => false,
});
window.HTMLElement.prototype.scrollIntoView ??= () => {};
window.HTMLElement.prototype.scrollTo ??= () => {};
window.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
};
window.IntersectionObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
};

// ── Globals the app modules read at evaluation time (bare identifiers) ──
window.PLUGIN_DIR = "mem:///data/plugins";
window.DATA_STORAGE = "mem:///data";
window.CACHE_STORAGE = "mem:///cache";
window.strings = { installing: "Installing...", loading: "Loading" };

// Browser-style shim for cordova's resolveLocalFileSystemURL: rewrites the
// mem:// storage urls to a static server so the plugin <script src> becomes
// fetchable and executable — mirroring how the WebView loads file:// paths.
window.resolveLocalFileSystemURL = (uri, ok) => {
	const httpUri = String(uri)
		.replace("mem:///data/plugins", "http://127.0.0.1:8932/pluginfs")
		.replace("mem://", "http://127.0.0.1:8932");
	ok({ toInternalURL: () => httpUri, toInternalUrl: () => httpUri });
};

// ── Native layer mocks ──
vi.mock("fileSystem", () => {
	const store = new Map();
	const norm = (url) => String(url).replace(/([^:]\/)\/+/g, "$1");
	const api = (rawUrl) => {
		const clean = norm(rawUrl);
		const ensureParents = async (url) => {
			const parts = norm(url).replace(/\/$/, "").split("/");
			parts.pop();
			let acc = "";
			for (const part of parts) {
				acc = acc ? `${acc}/${part}` : part;
				if (acc && !store.has(acc)) store.set(acc, { isDir: true });
			}
		};
		return {
			exists: async () =>
				store.has(clean) || store.has(clean.replace(/\/$/, "")),
			stat: async () => ({
				name: clean.replace(/\/$/, "").split("/").pop(),
				url: clean,
				uri: clean,
				isFile: !store.get(clean)?.isDir,
				isDirectory: !!store.get(clean)?.isDir,
				isLink: false,
				size: 0,
				modifiedDate: Date.now(),
				canRead: true,
				canWrite: true,
			}),
			lsDir: async () => {
				const base = clean.replace(/\/$/, "");
				const prefix = `${base}/`;
				const seen = new Set();
				const children = [];
				for (const key of store.keys()) {
					if (!key.startsWith(prefix)) continue;
					const name = key.slice(prefix.length).split("/")[0];
					if (!name || seen.has(name)) continue;
					seen.add(name);
					const isDir =
						store.get(`${prefix}${name}`)?.isDir ||
						[...store.keys()].some((k) => k.startsWith(`${prefix}${name}/`));
					children.push({
						name,
						url: `${prefix}${name}${isDir ? "/" : ""}`,
						isFile: !isDir,
						isDirectory: isDir,
						isLink: false,
						size: 0,
						modifiedDate: Date.now(),
						canRead: true,
						canWrite: true,
					});
				}
				return children;
			},
			createDirectory: async (name) => {
				const full = norm(`${clean.replace(/\/$/, "")}/${name}`);
				await ensureParents(full);
				store.set(full, { isDir: true });
			},
			createFile: async (name, data) => {
				const full = norm(`${clean.replace(/\/$/, "")}/${name}`);
				await ensureParents(full);
				store.set(full, { data: data ?? "" });
			},
			writeFile: async (data) => {
				await ensureParents(clean);
				const isDir = store.get(clean)?.isDir;
				store.set(clean, { isDir: !!isDir, data });
			},
			readFile: async (encoding) => {
				if (clean.startsWith("file:")) {
					// marketplace stub sources are read from the real disk
					const p = `/${clean.replace(/^file:\/+/, "")}`;
					const buf = readFileSync(p);
					return new Uint8Array(buf).buffer;
				}
				const entry =
					store.get(clean) || store.get(clean.replace(/\/$/, ""));
				if (!entry || entry.isDir) throw new Error(`ENOENT: ${clean}`);
				if (encoding === "json") return JSON.parse(entry.data.toString());
				return entry.data;
			},
			delete: async () => {
				const base = clean.replace(/\/$/, "");
				for (const key of [...store.keys()]) {
					if (key === base || key.startsWith(`${base}/`)) store.delete(key);
				}
			},
		};
	};
	api.__store = store;
	return { default: api };
});

vi.mock("dialogs/loader", () => ({
	default: {
		create: () => ({
			show: async () => {},
			setMessage: () => {},
			destroy: async () => {},
		}),
	},
}));
vi.mock("dialogs/alert", () => ({ default: async () => {} }));
vi.mock("dialogs/confirm", () => ({ default: async () => true }));

vi.mock("lib/pluginContext", () => ({
	default: async () => null,
	connect: async () => true,
}));

vi.mock("lib/fileIcons", () => ({
	default: {
		bindPlugin: () => ({}),
		unregisterByPlugin: () => {},
		getPluginApi: () => ({}),
		onChange: () => {},
	},
}));

vi.mock("lib/pluginRegistry", () => ({
	default: {
		get: async (id) => ({
			id,
			name: id,
			source: `file:/tmp/plugtest/${id.split(".")[1]}.zip`,
			source_fallback: null,
		}),
	},
}));

function makeCordova() {
	return {
		exec: (ok, err, service, action, args) => {
			if (service === "System" && action === "checksumText") {
				const text = String(args?.[0] ?? "");
				let h = 0;
				for (let i = 0; i < text.length; i++) {
					h = (h * 31 + text.charCodeAt(i)) >>> 0;
				}
				setTimeout(() => ok(String(h)), 0);
				return;
			}
			setTimeout(() => err(`${service}.${action} not mocked`), 0);
		},
		plugin: {
			http: {
				sendRequest: (url, _opts, ok, err) => {
					err({ error: "not used (file: sources)" });
				},
			},
		},
	};
}

// This is a runtime repro with EXTERNAL fixtures: stub zips at
// /tmp/plugtest/<name>.zip and a static server on 127.0.0.1:8932 serving
// /tmp/webapp/pluginfs/<id>/main.js (how the Android WebView loads plugin
// scripts). Without the fixtures the install chain cannot run, so the
// cases skip instead of failing CI (prepare them locally to run it).
const FIXTURES_READY =
	existsSync("/tmp/plugtest/inspector.zip") &&
	existsSync("/tmp/plugtest/site-analyzer.zip") &&
	existsSync("/tmp/plugtest/scraper.zip");

describe.runIf(FIXTURES_READY)(
	"repro: instalação dos plugins Inspector/Analyzer/Scraper",
	() => {
		beforeEach(() => {
		window.strings = { installing: "Installing...", loading: "Loading" };
		window.cordova = makeCordova();
	});

	for (const plugin of ["inspector", "site-analyzer", "scraper"]) {
		it(`instala ${plugin} até o fim (init incluído)`, { timeout: 40000 }, async () => {
			const { default: installPlugin } = await import("lib/installPlugin");
			const xcoder = (await import("lib/xcoder")).default;
			const fs = (await import("fileSystem")).default;
			window.xcoder = xcoder;
			fs.__store.clear();

			const id = `xcoder.${plugin}`;
			xcoder.unmountPlugin(id);
			// jsdom fetches external scripts (resources: usable) but does not
			// evaluate them reliably in this setup — evaluate the plugin body
			// manually when the loader injects the tag (same effect as the
			// Android WebView executing file:// script storage)
			const evalObserver = new MutationObserver(() => {
				const scriptEl = document.querySelector(
					`script[id="${id}-mainScript"]`,
				);
				if (scriptEl && !scriptEl.__evaled) {
					scriptEl.__evaled = true;
					try {
						const src = readFileSync(
							`/tmp/webapp/pluginfs/${id}/main.js`,
							"utf8",
						);
						window.eval(src);
					} catch (evalErr) {
					}
				}
			});
			evalObserver.observe(document.head, { childList: true });
			await installPlugin(id, plugin);

			const store = fs.__store;
			const norm = (u) => String(u).replace(/([^:]\/)\/+/g, "$1");
			const manifestUrl = norm(`mem:///data/plugins/${id}/plugin.json`);
			expect(store.has(manifestUrl), `${manifestUrl} gravado`).toBe(true);
			const raw = store.get(manifestUrl).data;
			const manifest = JSON.parse(
				typeof raw === "string" ? raw : new TextDecoder().decode(raw),
			);
			expect(manifest.id).toBe(id);
			// plugin init ran: its launcher app is registered in the sidebar
			const registered = xcoder.require("sidebarApps").get(`plugin-${plugin}`);
			expect(registered, `launcher de ${id} registado`).toBeTruthy();
			xcoder.unmountPlugin(id);
			});
		}
	},
);
