import settings from "lib/settings";

/**
 * GitHub-as-a-backend — a tiny JSON document store over the GitHub
 * Contents API.
 *
 * The user points this at their own repository (e.g. a private
 * `xcoder-backend` repo) with a fine-grained PAT limited to that repo.
 * Documents are JSON files committed under `db/` in the configured branch;
 * binary files (images etc.) can be uploaded under `files/`.
 *
 * Everything is optional: when no repo/token is configured the module
 * no-ops and callers show a friendly message instead.
 */

const API_ROOT = "https://api.github.com";
const DB_PREFIX = "db";
const FILES_PREFIX = "files";

/**
 * Parses a repo reference. Accepts "owner/repo",
 * "https://github.com/owner/repo" or "https://github.com/owner/repo.git".
 * @param {string} input
 * @returns {{owner: string, repo: string} | null}
 */
export function parseRepoInput(input) {
	const value = String(input || "").trim();
	if (!value) return null;
	const cleaned = value
		.replace(/^https?:\/\/(www\.)?github\.com\//i, "")
		.replace(/\.git$/i, "")
		.replace(/^\/+|\/+$/g, "");
	const match = cleaned.match(/^([\w.-]+)\/([\w.-]+)$/);
	if (!match) return null;
	return { owner: match[1], repo: match[2] };
}

/**
 * UTF-8-safe base64 encode.
 * @param {string} text
 */
export function b64encodeUtf8(text) {
	const bytes = new TextEncoder().encode(String(text));
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

/**
 * UTF-8-safe base64 decode.
 * @param {string} base64
 */
export function b64decodeUtf8(base64) {
	const clean = String(base64 || "").replace(/\s/g, "");
	const binary = atob(clean);
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

/** @returns {boolean} true when repo + token are configured */
export function isConfigured() {
	return Boolean(
		parseRepoInput(settings.value.ghRepo) && settings.value.ghToken,
	);
}

/**
 * Normalizes a document path (adds the db/ prefix, strips leading slash).
 * @param {string} path
 */
export function dbPath(path) {
	const clean = String(path || "").replace(/^\/+/, "");
	return `${DB_PREFIX}/${clean}`;
}

/**
 * GitHub Contents API request.
 * @param {string} path repo-relative file path
 * @param {"GET"|"PUT"} [method]
 * @param {object} [body] PUT body ({message, content, sha?})
 * @returns {Promise<any>} parsed JSON (GET) or commit result (PUT)
 */
async function api(path, method = "GET", body = null) {
	const parsed = parseRepoInput(settings.value.ghRepo);
	const token = settings.value.ghToken;
	const branch = settings.value.ghBranch || "main";
	if (!parsed || !token) {
		throw new Error("GitHub backend is not configured");
	}

	const url = `${API_ROOT}/repos/${parsed.owner}/${parsed.repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`;
	const response = await fetch(url, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github+json",
			"Content-Type": "application/json",
			"X-GitHub-Api-Version": "2022-11-28",
		},
		body: body ? JSON.stringify(body) : undefined,
	});

	if (!response.ok) {
		if (response.status === 404) return null;
		const detail = await response.text().catch(() => "");
		throw new Error(`GitHub API ${response.status}: ${detail.slice(0, 180)}`);
	}
	return response.json();
}

/**
 * Reads a JSON document (null when it does not exist).
 * @param {string} path path relative to db/
 * @returns {Promise<any>}
 */
export async function dbRead(path) {
	const result = await api(dbPath(path));
	if (!result?.content) return null;
	const decoded = b64decodeUtf8(result.content);
	try {
		return JSON.parse(decoded);
	} catch {
		throw new Error(`db/${path}: stored content is not valid JSON`);
	}
}

/**
 * Writes a JSON document as a commit (handles create and update).
 * @param {string} path path relative to db/
 * @param {any} data JSON-serializable value
 * @param {string} [message] commit message
 */
export async function dbWrite(path, data, message) {
	const payload = JSON.stringify(data, null, 2);
	const content = b64encodeUtf8(payload);
	const body = {
		message: message || `xcoder: update ${dbPath(path)}`,
		content,
		branch: settings.value.ghBranch || "main",
	};

	try {
		return await api(dbPath(path), "PUT", body);
	} catch (error) {
		// file exists without sha -> fetch sha and retry once
		const existing = await api(dbPath(path)).catch(() => null);
		if (existing?.sha) {
			return api(dbPath(path), "PUT", { ...body, sha: existing.sha });
		}
		throw error;
	}
}

/**
 * Uploads a raw (binary) file, e.g. an image.
 * @param {string} name file name (under files/)
 * @param {string} base64 raw base64 of the binary content (no data: prefix)
 * @param {string} [message]
 */
export async function uploadFile(name, base64, message) {
	const path = `${FILES_PREFIX}/${String(name || "").replace(/^\/+/, "")}`;
	return api(path, "PUT", {
		message: message || `xcoder: upload ${name}`,
		content: base64,
		branch: settings.value.ghBranch || "main",
	});
}

/**
 * Backs up app settings + AI chat sessions to the backend repo.
 * @returns {Promise<string>} commit summary
 */
export async function backupAll() {
	const payload = {
		version: 1,
		savedAt: Date.now(),
		settings: settings.value,
		aiSessions: readSessionsRaw(),
	};
	await dbWrite("xcoder/backup.json", payload, "xcoder: backup");
	return `backup saved (${new Date(payload.savedAt).toLocaleString()})`;
}

/**
 * Restores settings (merge) and AI chat sessions from the backend.
 * @returns {Promise<{restored: string[]}>}
 */
export async function restoreAll() {
	const payload = await dbRead("xcoder/backup.json");
	if (!payload) throw new Error("No backup found in the backend repo");

	const restored = [];
	if (payload.settings && typeof payload.settings === "object") {
		const safe = { ...payload.settings };
		// never restore secrets blindly
		delete safe.ghToken;
		delete safe.ghUserLogin;
		delete safe.ghUserName;
		delete safe.ghUserAvatar;
		for (const [key, value] of Object.entries(safe)) {
			if (key in settings.value) settings.value[key] = value;
		}
		await settings.update();
		restored.push("settings");
	}

	if (Array.isArray(payload.aiSessions)) {
		try {
			localStorage.setItem(
				"xcoder.ai.sessions",
				JSON.stringify(payload.aiSessions),
			);
			restored.push("chats");
		} catch {
			/* storage full */
		}
	}

	if (!restored.length) throw new Error("Backup is empty");
	return { restored };
}

/**
 * Reads announcements published in the backend repo (feature flags, news).
 * @returns {Promise<any>} parsed announcements.json or null
 */
export async function announcements() {
	return dbRead("xcoder/announcements.json");
}

/** Raw sessions payload for backup (kept decoupled from the sessions lib). */
function readSessionsRaw() {
	try {
		return JSON.parse(localStorage.getItem("xcoder.ai.sessions") || "[]");
	} catch {
		return [];
	}
}
