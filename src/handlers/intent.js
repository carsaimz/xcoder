import fsOperation from "fileSystem";
import config from "lib/config";
import openFile from "lib/openFile";
import helpers from "utils/helpers";

const handlers = [];
/**
 * Queue to store intents that arrive before files are restored
 * @type {Array<{url: string, options: object}>}
 */
const pendingIntents = [];
/**
 * Tool hand-offs from the native preview ("Inspect" / "Scrape" menu) that
 * arrive before files are restored.
 * @type {Array<{tool: "inspector"|"scrape", url: string}>}
 */
const pendingTools = [];

/**
 * Opens an editor tool (Inspector / Scraper sidebar app) with a URL
 * handed over from the native preview screen.
 * @param {"inspector"|"scrape"} tool
 * @param {string} [url]
 */
async function openTool(tool, url) {
	if (sessionStorage.getItem("isfilesRestored") !== "true") {
		pendingTools.push({ tool, url });
		return;
	}

	try {
		const { default: sidebarApps } = await import("sidebarApps");
		const app = sidebarApps.get(
			tool === "inspector" ? "inspectorApp" : "scrapeApp",
		);
		if (app) app.active = true;
		if (url) {
			const mod =
				tool === "inspector"
					? await import("sidebarApps/inspector")
					: await import("sidebarApps/scrape");
			if (tool === "inspector") await mod.openInspectorWith(url);
			else await mod.openScraperWith(url, "rendered");
		}
	} catch (error) {
		console.error(error);
		helpers.error(error);
	}
}

/**
 *
 * @param {Intent} intent
 */
export default async function HandleIntent(intent) {
	// Desktop's get-cordova-intent resolves to null when no deep link was
	// passed at launch — a default parameter wouldn't catch null, so coerce
	// explicitly (a null intent must be a no-op, never a TypeError).
	intent = intent || {};
	const type = intent.action?.split(".").slice(-1)[0];

	// Tool hand-off from the native preview screen (Browser "Inspect" /
	// "Scrape" menu items) — MAIN action with xcoder_tool extras.
	const tool = intent.extras?.xcoder_tool;
	if (tool === "inspector" || tool === "scrape") {
		const toolUrl =
			typeof intent.extras?.xcoder_url === "string"
				? intent.extras.xcoder_url
				: "";
		await openTool(tool, toolUrl);
		return;
	}

	if (["SEND", "SEND_MULTIPLE", "VIEW", "EDIT"].includes(type)) {
		/**@type {string} */
		const url =
			intent.fileUri ||
			intent.data ||
			intent.extras?.["android.intent.extra.STREAM"];
		// Shared documents arrive as EXTRA_STREAM / ClipData, collected by the
		// native plugin into `uris` (SEND_MULTIPLE sends several at once).
		const sharedUris = [
			...new Set(
				[url, ...(Array.isArray(intent.uris) ? intent.uris : [])].filter(
					(uri) => typeof uri === "string" && /^(content|file):\/\//i.test(uri),
				),
			),
		];
		if (typeof url === "string" && /^(xcoder|acode):\/\//i.test(url)) {
			// Both schemes share the same URL grammar: xcoder:// (native) and
			// acode:// (compatibility with links made for the Acode editor).
			const path = url.replace(/^(xcoder|acode):\/\//, "").split("#")[0];
			const [module, action, value] = path.split("/");

			let defaultPrevented = false;
			const event = new IntentEvent(module, action, value);
			// full raw URL (incl. fragment) for handlers such as OAuth
			event.url = url;
			for (const handler of handlers) {
				handler(event);
				if (event.defaultPrevented) defaultPrevented = true;
				if (event.propagationStopped) break;
			}

			if (defaultPrevented) return;

			if (module === "plugin" && action === "install") {
				const { default: Plugin } = await import("pages/plugin");

				if (!value || !/^([a-z0-9._-]+)$/i.test(value)) {
					return;
				}

				const installed = await fsOperation(PLUGIN_DIR, value).exists();
				Plugin({ id: value, installed, install: action === "install" });
			}

			return;
		}

		if (!sharedUris.length) return;

		const options = {
			mode: "single",
			render: true,
			persistInSession: false,
		};
		// Only the last opened file gets focus, mirroring VS Code's
		// multi-file drop behaviour.
		const batch = sharedUris.map((uri, index) => ({
			url: uri,
			options: { ...options, render: index === sharedUris.length - 1 },
		}));

		if (sessionStorage.getItem("isfilesRestored") === "true") {
			for (const entry of batch) {
				try {
					await openFile(entry.url, entry.options);
				} catch (error) {
					helpers.error(error);
				}
			}
		} else {
			// Store the intent for later processing when files are restored
			pendingIntents.push(...batch);
		}
	}
}

HandleIntent.onError = (error) => {
	helpers.error(error);
};

export function addIntentHandler(handler) {
	handlers.push(handler);
}

export function removeIntentHandler(handler) {
	const index = handlers.indexOf(handler);
	if (index > -1) handlers.splice(index, 1);
}

/**
 * Process all pending intents that were queued before files were restored.
 * This function is called after isfilesRestored is set to true in main.js.
 * @returns {Promise<void>}
 */
export async function processPendingIntents() {
	if (sessionStorage.getItem("isfilesRestored") !== "true") return;

	// Tool hand-offs queued before restoration
	while (pendingTools.length > 0) {
		const { tool, url } = pendingTools.shift();
		try {
			const { default: sidebarApps } = await import("sidebarApps");
			const app = sidebarApps.get(
				tool === "inspector" ? "inspectorApp" : "scrapeApp",
			);
			if (app) app.active = true;
			if (url) {
				const mod =
					tool === "inspector"
						? await import("sidebarApps/inspector")
						: await import("sidebarApps/scrape");
				if (tool === "inspector") await mod.openInspectorWith(url);
				else await mod.openScraperWith(url, "rendered");
			}
		} catch (error) {
			helpers.error(error);
		}
	}

	// Process all pending intents
	while (pendingIntents.length > 0) {
		const pendingIntent = pendingIntents.shift();
		try {
			await openFile(pendingIntent.url, pendingIntent.options);
		} catch (error) {
			helpers.error(error);
		}
	}
}

class IntentEvent {
	module;
	action;
	value;

	#defaultPrevented = false;
	#propagationStopped = false;

	/**
	 * Creates an instance of IntentEvent.
	 * @param {string} module
	 * @param {string} action
	 * @param {string} value
	 */
	constructor(module, action, value) {
		this.module = module;
		this.action = action;
		this.value = value;
	}

	preventDefault() {
		this.#defaultPrevented = true;
	}

	stopPropagation() {
		this.#propagationStopped = true;
	}

	get defaultPrevented() {
		return this.#defaultPrevented;
	}

	get propagationStopped() {
		return this.#propagationStopped;
	}
}
