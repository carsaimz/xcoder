/**
 * Persisted AI chat sessions.
 *
 * The store keeps multiple named conversations in localStorage so users can
 * switch between chats, rename them and delete them. All functions that need
 * storage go through an injectable adapter (`setStorage`) which keeps the
 * module unit-testable outside a browser.
 */

const SESSIONS_KEY = "xcoder.ai.sessions";
const ACTIVE_KEY = "xcoder.ai.sessions.active";

/** Max stored events per session (older events are dropped). */
export const MAX_SESSION_EVENTS = 200;

/** Max stored sessions (oldest updated sessions are dropped first). */
export const MAX_SESSIONS = 20;

const memoryStorage = new Map();

let storageAdapter = null;

/**
 * Replaces the storage adapter. Pass `{getItem, setItem, removeItem}`.
 * Mostly used by tests.
 * @param {{getItem: (k: string) => string | null, setItem: (k: string, v: string) => void, removeItem: (k: string) => void}} adapter
 */
export function setStorage(adapter) {
	storageAdapter = adapter;
}

function storage() {
	if (storageAdapter) return storageAdapter;
	if (typeof window !== "undefined" && window.localStorage) {
		return {
			getItem: (key) => window.localStorage.getItem(key),
			setItem: (key, value) => window.localStorage.setItem(key, value),
			removeItem: (key) => window.localStorage.removeItem(key),
		};
	}
	// last resort: in-memory (non-persistent)
	return {
		getItem: (key) => (memoryStorage.has(key) ? memoryStorage.get(key) : null),
		setItem: (key, value) => memoryStorage.set(key, value),
		removeItem: (key) => memoryStorage.delete(key),
	};
}

/**
 * @typedef {object} ChatSession
 * @property {string} id
 * @property {string} title
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {Array<object>} events chat events ({type, payload, ...})
 */

/**
 * Loads all sessions, oldest-created first.
 * @returns {ChatSession[]}
 */
export function loadSessions() {
	try {
		const raw = storage().getItem(SESSIONS_KEY);
		const list = raw ? JSON.parse(raw) : [];
		if (!Array.isArray(list)) return [];
		return list.filter((item) => item && typeof item.id === "string");
	} catch {
		return [];
	}
}

/**
 * Persists all sessions, applying the per-session event cap and the
 * global session cap (oldest `updatedAt` is dropped first).
 * @param {ChatSession[]} sessions
 * @returns {ChatSession[]} the capped list actually stored
 */
export function saveSessions(sessions) {
	const capped = (sessions || [])
		.map((session) => ({
			...session,
			events: (session.events || []).slice(-MAX_SESSION_EVENTS),
		}))
		.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
		.slice(0, MAX_SESSIONS)
		.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

	try {
		storage().setItem(SESSIONS_KEY, JSON.stringify(capped));
	} catch {
		/* storage full — drop the oldest and retry once */
		try {
			storage().setItem(
				SESSIONS_KEY,
				JSON.stringify(capped.slice(Math.ceil(capped.length / 2))),
			);
		} catch {
			/* give up silently */
		}
	}
	return capped;
}

/**
 * Loads the id of the last active session (or null).
 * @returns {string | null}
 */
export function loadActiveId() {
	try {
		return storage().getItem(ACTIVE_KEY) || null;
	} catch {
		return null;
	}
}

/**
 * Persists the id of the active session.
 * @param {string} id
 */
export function saveActiveId(id) {
	try {
		if (id) storage().setItem(ACTIVE_KEY, id);
		else storage().removeItem(ACTIVE_KEY);
	} catch {
		/* ignore */
	}
}

/**
 * Creates an empty session.
 * @param {string} [title]
 * @returns {ChatSession}
 */
export function newSession(title) {
	return {
		id: uid(),
		title: title || "New chat",
		createdAt: Date.now(),
		updatedAt: Date.now(),
		events: [],
	};
}

/**
 * Derives a session title from the first user message: first non-empty
 * line, whitespace collapsed, capped at 42 chars.
 * @param {string} text
 * @returns {string}
 */
export function deriveTitle(text) {
	const firstLine = String(text || "")
		.split("\n")
		.map((line) => line.trim())
		.find((line) => line.length > 0);

	if (!firstLine) return "New chat";

	const collapsed = firstLine.replace(/\s+/g, " ");
	if (collapsed.length <= 42) return collapsed;
	return `${collapsed.slice(0, 42)}…`;
}

/**
 * Marks a session as updated and caps its event history in place.
 * @param {ChatSession} session
 */
export function touchSession(session) {
	session.updatedAt = Date.now();
	session.events = (session.events || []).slice(-MAX_SESSION_EVENTS);
}

/**
 * Short relative label used in the session list.
 * @param {number} timestamp
 * @returns {string}
 */
export function formatSessionTime(timestamp) {
	if (!timestamp) return "";
	const diff = Date.now() - timestamp;
	const minutes = Math.floor(diff / 60000);
	if (minutes < 1) return "now";
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d`;
	const date = new Date(timestamp);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

/** @returns {string} random id */
function uid() {
	try {
		if (typeof crypto !== "undefined" && crypto.randomUUID) {
			return crypto.randomUUID();
		}
	} catch {
		/* fall through */
	}
	return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
