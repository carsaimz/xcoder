import Url from "utils/Url";

// fsOperation is imported LAZILY inside the storage functions: a static
// import would pull fileSystem → ajax → settings into every catalog
// consumer (localModels → customModels) and blow the module graph with
// a circular-init stack overflow.

/**
 * User-imported local models.
 *
 * Besides the built-in catalog (localModels.js), users can add models
 * themselves:
 *  - SOURCE "files" — model files already on the device (config.json,
 *    tokenizer, onnx/…) copied into `<DATA_STORAGE>/xcoder-models/<id>/`.
 *  - SOURCE "link"  — a Hugging Face repo downloaded through a link
 *    (hfImport.js) and served exactly like a catalog model.
 *
 * Entries live in `xcoder-models/custom-models.json` and are merged into
 * the catalog lookups (allLocalModels/getLocalModel/modelsByKind) by
 * localModels.js through customModelsCache(). A cache keeps the merged
 * lookups synchronous; the async hydrate runs once at import and every
 * change emits an event so pages/providers can re-render.
 */

/** Root directory name for installed models (mirrors localModels.js). */
const MODELS_ROOT_DIR = "xcoder-models";
/** Store file (catalog of imported models). */
const STORE_NAME = "custom-models.json";

/** @typedef {"files"|"link"} CustomModelSource */

/**
 * @typedef {object} CustomModel
 * @property {string} id
 * @property {"llm"|"stt"|"tts"} kind
 * @property {string} name
 * @property {string} repo synthetic repo id used by the runtime cache
 * @property {string} dtype
 * @property {string} task
 * @property {string} lang
 * @property {string} descPt
 * @property {string} descEn
 * @property {number} sizeBytes
 * @property {string[]} files repo-relative file paths
 * @property {boolean} custom always true
 * @property {CustomModelSource} source
 * @property {number} importedAt
 */

/** In-memory cache (sync view for the merged catalog lookups). */
let cache = /** @type {CustomModel[]} */ [];
/** @type {Promise<void>|null} single hydrate */
let hydrating = null;
/** @type {Set<(models: CustomModel[]) => void>} */
const listeners = new Set();
/** @type {{read: Function, write: Function}|null} injectable fs port */
let port = null;

/**
 * Replaces the storage port (tests). Pass null to restore fsOperation.
 * @param {{read: () => Promise<string|null>, write: (text: string) => Promise<void>}|null} [next]
 */
export function setCustomModelsPort(next) {
	port = next;
	if (next) hydrating = null;
}

/** Store file url. */
function storeUrl() {
	return Url.join(
		globalThis.DATA_STORAGE || "file:///",
		MODELS_ROOT_DIR,
		STORE_NAME,
	);
}

/** fsOperation resolved lazily (see header note). */
async function fsOp(url) {
	const fsOperation = (await import("fileSystem")).default;
	return fsOperation(url);
}

/** Raw store read ("" when missing). */
async function readStore() {
	if (port) return port.read();
	try {
		const fs = await fsOp(storeUrl());
		if (!(await fs.exists())) return "";
		const text = await fs.readFile();
		return typeof text === "string" ? text : new TextDecoder().decode(text);
	} catch {
		return "";
	}
}

/** Raw store write. */
async function writeStore(text) {
	if (port) return port.write(text);
	const fs = await fsOp(storeUrl());
	if (await fs.exists()) {
		return fs.writeFile(text);
	}
	const parent = Url.join(
		globalThis.DATA_STORAGE || "file:///",
		MODELS_ROOT_DIR,
	);
	const name = STORE_NAME;
	await (await fsOp(parent)).createFile(name, text);
}

/** Emits a change to subscribers (after the cache was updated). */
function emit() {
	for (const listener of [...listeners]) {
		try {
			listener(cache);
		} catch {
			/* a broken listener must not break the rest */
		}
	}
}

/**
 * Loads the store into the cache (once; concurrent calls share the load).
 * @returns {Promise<void>}
 */
export function hydrateCustomModels() {
	if (!hydrating) {
		hydrating = readStore()
			.then((text) => {
				if (!text) {
					cache = [];
					return;
				}
				try {
					const parsed = JSON.parse(text);
					cache = Array.isArray(parsed) ? parsed : [];
				} catch {
					cache = [];
				}
			})
			.catch(() => {
				cache = [];
			});
	}
	return hydrating;
}

/**
 * Synchronous cache view — merged into the catalog lookups. Before the
 * first hydrate completes this is empty (built-in catalog only), which
 * keeps every existing consumer working.
 * @returns {CustomModel[]}
 */
export function customModelsCache() {
	return cache;
}

/**
 * Subscribes to catalog changes. Returns an unsubscribe function.
 * @param {(models: CustomModel[]) => void} listener
 */
export function onCustomModelsChanged(listener) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/**
 * Registers an imported model (deduped by id) and persists the store.
 * @param {CustomModel} entry
 * @returns {Promise<CustomModel>} the stored entry
 */
export async function addCustomModel(entry) {
	if (!entry?.id) throw new Error("custom model: id is required");
	await hydrateCustomModels();
	const clean = {
		...entry,
		custom: true,
		importedAt: entry.importedAt || Date.now(),
	};
	cache = cache.filter((model) => model.id !== clean.id).concat([clean]);
	await writeStore(JSON.stringify(cache, null, "\t"));
	emit();
	return clean;
}

/**
 * Removes an imported model from the catalog (files stay — call
 * modelDownloads.deleteLocalModel separately).
 * @param {string} id
 */
export async function removeCustomModel(id) {
	await hydrateCustomModels();
	const next = cache.filter((model) => model.id !== id);
	if (next.length === cache.length) return false;
	cache = next;
	await writeStore(JSON.stringify(cache, null, "\t"));
	emit();
	return true;
}

/** Imported model by id (or null). */
export function getCustomModel(id) {
	return cache.find((model) => model.id === id) || null;
}

/**
 * Slugifies a Hugging Face repo id ("acme/Foo-Bar" → "hf-acme-foo-bar")
 * so imported ids never collide with catalog ids.
 * @param {string} repoId
 * @param {CustomModel[]} [taken]
 */
export function slugForRepo(repoId, taken = cache) {
	const base = `hf-${String(repoId || "model")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")}`;
	let id = base;
	let n = 2;
	while (taken.some((model) => model.id === id)) {
		id = `${base}-${n}`;
		n += 1;
	}
	return id;
}

export default {
	hydrateCustomModels,
	customModelsCache,
	onCustomModelsChanged,
	addCustomModel,
	removeCustomModel,
	getCustomModel,
	slugForRepo,
	setCustomModelsPort,
};
