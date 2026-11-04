import fsOperation from "fileSystem";
import Url from "utils/Url";

/**
 * Local file timeline (VS Code "Timeline" parity): every save stores a
 * snapshot of the file under the app data directory so the previous
 * versions can be listed, previewed and restored without any git repo.
 * Snapshots live in `<DATA_STORAGE>/timeline/<hash>/<timestamp>.txt` plus
 * a small `meta.json` per file. Oldest entries are pruned when a file
 * passes the count or byte budget; identical consecutive saves are
 * de-duplicated (timestamp refresh instead of a new copy).
 */

const TIMELINE_DIR = "timeline";
const MAX_SNAPSHOTS = 20;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;
const MAX_SNAPSHOT_BYTES = 512 * 1024;
const META_FILE = "meta.json";

/** Injectable for tests. */
let rootOverride = null;

/** @returns {string} absolute root of the timeline storage */
export function timelineRoot() {
	if (rootOverride) return rootOverride;
	const base = globalThis.DATA_STORAGE || "file:///data_storage";
	return Url.join(base, TIMELINE_DIR);
}

/** Test-only root override. @param {string|null} root */
export function __setTimelineRoot(root) {
	rootOverride = root;
}

/**
 * Deterministic per-file directory name (djb2 over the uri — the
 * html-tag-js String.hashCode() is not available in unit tests).
 * @param {string} uri
 * @returns {string}
 */
export function timelineKey(uri) {
	const text = String(uri || "");
	let hash = 5381;
	for (let i = 0; i < text.length; i++) {
		hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
	}
	return `f${(hash >>> 0).toString(36)}`;
}

/** @param {string} uri @returns {string} directory of the file's snapshots */
function fileDir(uri) {
	return Url.join(timelineRoot(), timelineKey(uri));
}

/** @param {string} uri @returns {string} meta.json url */
function metaUrl(uri) {
	return Url.join(fileDir(uri), META_FILE);
}

/** @param {string} uri @param {number} t @returns {string} snapshot url */
function snapshotUrl(uri, t) {
	return Url.join(fileDir(uri), `${t}.txt`);
}

/** @param {string} uri @returns {Promise<{snapshots: {t: number, size: number}[]}>} */
async function readMeta(uri) {
	try {
		const text = await fsOperation(metaUrl(uri)).readFile("utf8");
		const meta = JSON.parse(text);
		if (Array.isArray(meta?.snapshots)) return meta;
	} catch (error) {
		// first snapshot or unreadable meta — start fresh
	}
	return { snapshots: [] };
}

/** @param {string} uri @param {{snapshots: object[]}} meta */
async function writeMeta(uri, meta) {
	const dir = fsOperation(fileDir(uri));
	if (!(await dir.exists())) {
		await fsOperation(timelineRoot()).createDirectory(timelineKey(uri));
	}
	await fsOperation(fileDir(uri)).createFile(
		META_FILE,
		JSON.stringify(meta.snapshots.length ? meta : { snapshots: [] }),
	);
}

/**
 * Stores a snapshot of the file content after a successful save.
 * Never throws — the timeline must not break saving.
 * @param {string} uri file uri
 * @param {string} text saved document text
 * @param {string} [filename] display name (unused in storage, kept for API symmetry)
 * @returns {Promise<void>}
 */
export async function recordSnapshot(uri, text, filename) {
	try {
		if (!uri || typeof text !== "string") return;
		if (text.length > MAX_SNAPSHOT_BYTES) return;

		const meta = await readMeta(uri);
		const last = meta.snapshots[0];
		if (last) {
			// de-duplicate consecutive identical saves
			const lastText = await fsOperation(snapshotUrl(uri, last.t)).readFile(
				"utf8",
			);
			if (lastText === text) {
				last.t = Date.now();
				last.size = text.length;
				await writeMeta(uri, meta);
				return;
			}
		}

		const stamp = Date.now();
		meta.snapshots.unshift({ t: stamp, size: text.length });
		await fsOperation(fileDir(uri)).createFile(`${stamp}.txt`, text);
		await writeMeta(uri, meta);
		await prune(uri, meta);
	} catch (error) {
		console.warn("fileTimeline: failed to record snapshot", error);
	}
}

/**
 * Keeps the newest MAX_SNAPSHOTS within the byte budget, deleting the
 * content files of everything dropped.
 * @param {string} uri
 * @param {{snapshots: {t: number, size: number}[]}} meta
 */
async function prune(uri, meta) {
	const kept = [];
	let total = 0;
	for (const snapshot of meta.snapshots) {
		const withinCount = kept.length < MAX_SNAPSHOTS;
		const withinBytes =
			total + snapshot.size <= MAX_TOTAL_BYTES || kept.length === 0;
		if (withinCount && withinBytes) {
			kept.push(snapshot);
			total += snapshot.size;
			continue;
		}
		try {
			await fsOperation(snapshotUrl(uri, snapshot.t)).delete();
		} catch (error) {
			// content file already gone — nothing to recover
		}
	}
	if (kept.length !== meta.snapshots.length) {
		meta.snapshots = kept;
		await writeMeta(uri, meta);
	}
}

/**
 * Lists snapshots of a file, newest first.
 * @param {string} uri
 * @returns {Promise<{t: number, size: number}[]>}
 */
export async function listSnapshots(uri) {
	if (!uri) return [];
	try {
		const meta = await readMeta(uri);
		return meta.snapshots
			.slice()
			.sort((a, b) => b.t - a.t)
			.map(({ t, size }) => ({ t, size }));
	} catch (error) {
		console.warn("fileTimeline: failed to list snapshots", error);
		return [];
	}
}

/**
 * Reads one snapshot's content.
 * @param {string} uri
 * @param {number} t snapshot timestamp
 * @returns {Promise<string|null>}
 */
export async function readSnapshot(uri, t) {
	if (!uri || !t) return null;
	try {
		return await fsOperation(snapshotUrl(uri, t)).readFile("utf8");
	} catch (error) {
		console.warn("fileTimeline: failed to read snapshot", error);
		return null;
	}
}

/**
 * Writes a snapshot's content back to the file on disk.
 * @param {string} uri
 * @param {number} t snapshot timestamp
 * @returns {Promise<string|null>} restored text, null on failure
 */
export async function restoreSnapshot(uri, t) {
	const text = await readSnapshot(uri, t);
	if (text === null) return null;
	await fsOperation(uri).writeFile(text, "utf8");
	return text;
}

/**
 * Removes every snapshot of a file.
 * @param {string} uri
 * @returns {Promise<void>}
 */
export async function clearSnapshots(uri) {
	if (!uri) return;
	try {
		const dir = fsOperation(fileDir(uri));
		if (await dir.exists()) {
			await dir.delete();
		}
	} catch (error) {
		console.warn("fileTimeline: failed to clear snapshots", error);
	}
}

export default {
	recordSnapshot,
	listSnapshots,
	readSnapshot,
	restoreSnapshot,
	clearSnapshots,
};
