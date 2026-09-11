/**
 * SSH sessions v2 (roadmap v1.7.x item 3) — per-host identity, command
 * history and profile settings for saved SFTP/SSH servers.
 *
 * Everything here is plain and localStorage-backed so it can be unit
 * tested without the app runtime. Nothing secret is ever stored: the
 * native SFTP profiles keep the credentials, this module only stores
 * presentation + convenience data (colors, home dir, command history).
 */

const HOST_SETTINGS_KEY = "ssh_host_settings";
const HOST_HISTORY_KEY = "ssh_host_history";
export const SSH_HISTORY_CAP = 100;
export const SSH_MAX_COMMAND_LENGTH = 500;

/** Weights that make sense for an editor font. */
export const EDITOR_FONT_WEIGHTS = [400, 500, 600, 700, 800, 900];

/**
 * Small deterministic string hash (djb2) used to derive stable host colors.
 * @param {string} value
 * @returns {number}
 */
function hashString(value) {
	let hash = 5381;
	const text = String(value || "");
	for (let i = 0; i < text.length; i++) {
		hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
	}
	return Math.abs(hash);
}

/**
 * Initials shown on the host avatar: first alphanumeric characters of the
 * first two words (e.g. "My VPS" → "MV", "192.168.0.10" → "19").
 * @param {string} name
 * @returns {string}
 */
export function sshHostInitials(name) {
	const words = String(name || "")
		.replace(/[^\p{L}\p{N}\s.-]/gu, "")
		.split(/[\s._-]+/)
		.filter(Boolean);
	if (!words.length) return "S";
	if (words.length === 1) {
		const word = words[0];
		return word.slice(0, /^\d/.test(word) ? 2 : 1).toUpperCase();
	}
	return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Deterministic hue (0-359) for a host name/URL.
 * @param {string} seed
 * @returns {number}
 */
export function sshHostHue(seed) {
	return hashString(seed) % 360;
}

/**
 * Avatar descriptor for a host: stable initials + hue-derived colors.
 * @param {string} name Server display name or URL
 * @returns {{initials: string, hue: number, bg: string, color: string}}
 */
export function sshHostAvatar(name) {
	const hue = sshHostHue(name);
	return {
		initials: sshHostInitials(name),
		hue,
		bg: `hsl(${hue} 55% 32%)`,
		color: `hsl(${hue} 90% 88%)`,
	};
}

/**
 * "user@host:port" label for a sftp:// storage URL.
 * @param {string} sftpUrl
 * @returns {string}
 */
export function sshHostLabel(sftpUrl) {
	try {
		const url = new URL(sftpUrl.replace(/^sftp:/i, "https:"));
		const host = (url.hostname || "").replace(/^profile-/, "•");
		const port = url.port ? `:${url.port}` : "";
		const user = url.username ? `${url.username}@` : "";
		return `${user}${host}${port}`;
	} catch {
		return "";
	}
}

/* ------------------------------------------------------------------ */
/* Per-host settings (home directory, …)                               */
/* ------------------------------------------------------------------ */

function readStore(key) {
	try {
		const parsed = JSON.parse(localStorage.getItem(key) || "{}");
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
}

function writeStore(key, value) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// storage full/unavailable — non-critical feature
	}
}

/**
 * @param {string} profileId
 * @returns {Record<string, unknown>}
 */
export function getHostSettings(profileId) {
	if (!profileId) return {};
	return readStore(HOST_SETTINGS_KEY)[profileId] || {};
}

/**
 * @param {string} profileId
 * @param {string} key
 * @param {unknown} value
 */
export function setHostSetting(profileId, key, value) {
	if (!profileId || !key) return;
	const store = readStore(HOST_SETTINGS_KEY);
	const settings = store[profileId] || {};
	if (value === undefined || value === null || value === "") {
		delete settings[key];
	} else {
		settings[key] = value;
	}
	if (Object.keys(settings).length) {
		store[profileId] = settings;
	} else {
		delete store[profileId];
	}
	writeStore(HOST_SETTINGS_KEY, store);
}

/**
 * @param {string} profileId
 * @returns {string} configured home directory or ""
 */
export function getHostHomeDir(profileId) {
	const value = getHostSettings(profileId).homeDir;
	return typeof value === "string" ? value : "";
}

/**
 * @param {string} profileId
 * @param {string} dir
 */
export function setHostHomeDir(profileId, dir) {
	setHostSetting(profileId, "homeDir", String(dir || "").trim());
}

/* ------------------------------------------------------------------ */
/* Per-host command history                                            */
/* ------------------------------------------------------------------ */

/**
 * Normalizes a raw input line into a recordable command, or "" when the
 * line must not be stored (empty, too long, control junk).
 * @param {string} line
 * @returns {string}
 */
export function sanitizeCommand(line) {
	const clean = String(line || "")
		// strip control characters except nothing — a finished line has none
		.replace(/[\u0000-\u001f\u007f]/g, "")
		.trim();
	if (!clean) return "";
	if (clean.length > SSH_MAX_COMMAND_LENGTH) return "";
	return clean;
}

/**
 * True when the terminal is likely showing a hidden-input prompt
 * (password/passphrase/OTP) — the typed line must NOT be recorded.
 * @param {string} promptLine Visible text of the line being typed on
 * @returns {boolean}
 */
export function looksLikeHiddenInput(promptLine) {
	return /password|passphrase|verification code|secret|token\s*[:=]/i.test(
		String(promptLine || ""),
	);
}

/**
 * @param {string} profileId
 * @returns {string[]}
 */
export function getHistory(profileId) {
	if (!profileId) return [];
	const history = readStore(HOST_HISTORY_KEY)[profileId];
	return Array.isArray(history) ? history.slice() : [];
}

/**
 * Records one finished command line for a host (deduped against the
 * previous entry, capped at SSH_HISTORY_CAP).
 * @param {string} profileId
 * @param {string} line raw finished line (already sanitized internally)
 */
export function recordCommand(profileId, line) {
	if (!profileId) return;
	const command = sanitizeCommand(line);
	if (!command) return;
	const store = readStore(HOST_HISTORY_KEY);
	const history = Array.isArray(store[profileId]) ? store[profileId] : [];
	if (history[history.length - 1] === command) return;
	history.push(command);
	if (history.length > SSH_HISTORY_CAP) {
		history.splice(0, history.length - SSH_HISTORY_CAP);
	}
	store[profileId] = history;
	writeStore(HOST_HISTORY_KEY, store);
}

/**
 * @param {string} profileId
 */
export function clearHistory(profileId) {
	if (!profileId) return;
	const store = readStore(HOST_HISTORY_KEY);
	delete store[profileId];
	writeStore(HOST_HISTORY_KEY, store);
}

/**
 * Forgets all per-host data (settings + history) — used when a server is
 * removed by the user.
 * @param {string} profileId
 */
export function forgetHost(profileId) {
	if (!profileId) return;
	for (const key of [HOST_SETTINGS_KEY, HOST_HISTORY_KEY]) {
		const store = readStore(key);
		delete store[profileId];
		writeStore(key, store);
	}
}

/**
 * Resolves the directory an SSH shell should start in.
 * Priority: explicit option > stored home dir > URL path (when real) > "/".
 * @param {{initialDirectory?: string, homeDir?: string, urlPath?: string}} parts
 * @returns {string}
 */
export function resolveInitialDirectory(parts = {}) {
	const explicit = String(parts.initialDirectory || "").trim();
	if (explicit) return explicit;
	const homeDir = String(parts.homeDir || "").trim();
	if (homeDir) return homeDir;
	const urlPath = String(parts.urlPath || "").trim();
	if (urlPath && urlPath !== "/") return urlPath;
	return "/";
}

export default {
	SSH_HISTORY_CAP,
	SSH_MAX_COMMAND_LENGTH,
	sshHostInitials,
	sshHostHue,
	sshHostAvatar,
	sshHostLabel,
	getHostSettings,
	setHostSetting,
	getHostHomeDir,
	setHostHomeDir,
	sanitizeCommand,
	looksLikeHiddenInput,
	getHistory,
	recordCommand,
	clearHistory,
	forgetHost,
	resolveInitialDirectory,
};
