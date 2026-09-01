import { firebaseConfig, isReady } from "lib/firebaseLite";
import settings from "lib/settings";

/**
 * Firebase full — still SDK-free, no bundle impact.
 *
 * Builds on top of firebaseLite (Firestore REST) and adds:
 *  - anonymous authentication via the Identity Toolkit REST API
 *    (one stable identity per install, token refreshed transparently)
 *  - per-user cloud sync: settings + AI chats stored under
 *    `xcoder_users/{localId}/sync/backup` in the user's own project
 *
 * Requirements on the Firebase console side:
 *  - Anonymous sign-in enabled (Authentication > Sign-in method)
 *  - Firestore database created (test rules or per-user rules)
 *
 * Everything silently no-ops / throws friendly errors when disabled,
 * misconfigured or offline, mirroring the ghBackend module.
 */

const FIRESTORE_ROOT = "https://firestore.googleapis.com/v1/projects";
const IDENTITY_ROOT = "https://identitytoolkit.googleapis.com/v1";
const REFRESH_ROOT = "https://securetoken.googleapis.com/v1";

const AUTH_KEY = "xcoder.fb.auth";
const SYNC_COLLECTION = "xcoder_users";
const SYNC_DOC = "sync/backup";

/** Tokens are refreshed slightly before they actually expire. */
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

/**
 * Reads the cached anonymous session, if any.
 * @returns {{localId: string, idToken: string, refreshToken: string, expiresAt: number} | null}
 */
export function readAuth() {
	try {
		const raw = localStorage.getItem(AUTH_KEY);
		const parsed = raw ? JSON.parse(raw) : null;
		return parsed && parsed.localId ? parsed : null;
	} catch {
		return null;
	}
}

/** Removes the cached anonymous session (local sign-out). */
export function clearAuth() {
	try {
		localStorage.removeItem(AUTH_KEY);
	} catch {
		/* storage unavailable */
	}
}

/**
 * Current auth status without any network call.
 * @returns {{signedIn: boolean, localId: string | null}}
 */
export function authState() {
	const auth = readAuth();
	return { signedIn: Boolean(auth), localId: auth?.localId || null };
}

/**
 * Firestore REST URL for the per-user backup document.
 * @param {string} localId Firebase user id
 * @returns {string}
 */
export function buildSyncUrl(localId) {
	const config = firebaseConfig();
	return `${FIRESTORE_ROOT}/${config.projectId}/databases/(default)/documents/${SYNC_COLLECTION}/${encodeURIComponent(localId)}/${SYNC_DOC}`;
}

/** @returns {boolean} true when project id + API key are configured and enabled */
export function isConfigured() {
	return isReady();
}

/**
 * Extracts a readable message from an Identity Toolkit error body.
 * @param {any} data parsed error JSON
 */
function authErrorMessage(data) {
	const code = data?.error?.message || "UNKNOWN_ERROR";
	const hints = {
		OPERATION_NOT_ALLOWED:
			"Anonymous sign-in is disabled — enable it under Authentication > Sign-in method",
		API_KEY_INVALID: "The Web API key is invalid for this project",
		PROJECT_NOT_FOUND: "The Firebase project was not found",
	};
	return hints[code] ? `${code} (${hints[code]})` : code;
}

/**
 * Signs in (or signs up) anonymously and caches the session.
 * @returns {Promise<{localId: string, idToken: string, refreshToken: string, expiresAt: number}>}
 */
export async function signInAnonymously() {
	const config = firebaseConfig();
	if (!config.projectId || !config.apiKey) {
		throw new Error("Firebase is not configured");
	}

	let data;
	try {
		const response = await fetch(
			`${IDENTITY_ROOT}/accounts:signUp?key=${encodeURIComponent(config.apiKey)}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ returnSecureToken: true }),
			},
		);
		data = await response.json().catch(() => null);
		if (!response.ok) {
			throw new Error(`Firebase auth: ${authErrorMessage(data)}`);
		}
	} catch (error) {
		if (error instanceof Error && error.message.startsWith("Firebase auth:")) {
			throw error;
		}
		throw new Error("Firebase auth: network error");
	}

	const auth = {
		localId: String(data.localId || ""),
		idToken: String(data.idToken || ""),
		refreshToken: String(data.refreshToken || ""),
		expiresAt: Date.now() + expiryMs(data.expiresIn),
	};
	if (!auth.localId || !auth.idToken) {
		throw new Error("Firebase auth: invalid response");
	}
	writeAuth(auth);
	return auth;
}

/**
 * Exchanges the refresh token for a fresh id token and caches it.
 * @param {{refreshToken: string}} auth cached session
 */
export async function refreshAuth(auth) {
	const config = firebaseConfig();
	if (!config.apiKey || !auth?.refreshToken) {
		throw new Error("Firebase auth: nothing to refresh");
	}

	const response = await fetch(
		`${REFRESH_ROOT}/token?key=${encodeURIComponent(config.apiKey)}`,
		{
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: auth.refreshToken,
			}).toString(),
		},
	);
	const data = await response.json().catch(() => null);
	if (!response.ok) {
		clearAuth();
		throw new Error(`Firebase auth: ${authErrorMessage(data)}`);
	}

	const fresh = {
		localId: String(data.user_id || auth.localId || ""),
		idToken: String(data.id_token || data.access_token || ""),
		refreshToken: String(data.refresh_token || auth.refreshToken),
		expiresAt: Date.now() + expiryMs(data.expires_in),
	};
	if (!fresh.idToken) {
		clearAuth();
		throw new Error("Firebase auth: invalid refresh response");
	}
	writeAuth(fresh);
	return fresh;
}

/**
 * Returns a valid session, refreshing or re-signing-in as needed.
 * @returns {Promise<{localId: string, idToken: string}>}
 */
export async function ensureAuth() {
	if (!isReady()) throw new Error("Firebase is not configured");

	const cached = readAuth();
	if (
		cached?.idToken &&
		cached.expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS
	) {
		return cached;
	}
	if (cached?.refreshToken) {
		try {
			return await refreshAuth(cached);
		} catch {
			/* fall through to a fresh anonymous sign-in */
		}
	}
	return signInAnonymously();
}

/**
 * Backs up app settings + AI chat sessions to Firestore for the
 * anonymous user of this install.
 * @returns {Promise<string>} summary suitable for a toast
 */
export async function pushAll() {
	const auth = await ensureAuth();
	const config = firebaseConfig();
	const payload = {
		version: 1,
		savedAt: Date.now(),
		settings: settings.value,
		aiSessions: readSessionsRaw(),
	};

	const body = {
		fields: {
			app: { stringValue: "xcoder" },
			savedAt: { integerValue: String(payload.savedAt) },
			json: { stringValue: JSON.stringify(payload) },
		},
	};

	const url = `${buildSyncUrl(auth.localId)}?key=${encodeURIComponent(config.apiKey)}&updateMask.fieldPaths=app&updateMask.fieldPaths=savedAt&updateMask.fieldPaths=json`;
	let response;
	try {
		response = await fetch(url, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
	} catch {
		throw new Error("firebase backup: network error");
	}
	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		throw new Error(
			`firebase backup: Firestore ${response.status}: ${detail.slice(0, 180)}`,
		);
	}
	return `firebase backup saved (${new Date(payload.savedAt).toLocaleString()})`;
}

/**
 * Restores settings (merge, secrets excluded) and AI chat sessions
 * from the last Firebase backup.
 * @returns {Promise<{restored: string[]}>}
 */
export async function pullAll() {
	const auth = await ensureAuth();
	const config = firebaseConfig();

	let response;
	try {
		response = await fetch(
			`${buildSyncUrl(auth.localId)}?key=${encodeURIComponent(config.apiKey)}`,
		);
	} catch {
		throw new Error("firebase restore: network error");
	}
	if (response.status === 404) {
		throw new Error("No backup found in Firebase");
	}
	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		throw new Error(
			`firebase restore: Firestore ${response.status}: ${detail.slice(0, 180)}`,
		);
	}

	const document = await response.json().catch(() => null);
	const raw = document?.fields?.json?.stringValue;
	if (!raw) throw new Error("Firebase backup is empty");

	let payload;
	try {
		payload = JSON.parse(raw);
	} catch {
		throw new Error("Firebase backup: stored content is not valid JSON");
	}

	const restored = [];
	if (payload.settings && typeof payload.settings === "object") {
		const safe = { ...payload.settings };
		// never restore secrets blindly
		delete safe.ghToken;
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

	if (!restored.length) throw new Error("Firebase backup is empty");
	return { restored };
}

/**
 * @param {any} value seconds (string/number) returned by the auth APIs
 * @returns {number} lifetime in ms, with a safe default
 */
function expiryMs(value) {
	const seconds = Number.parseInt(String(value ?? ""), 10);
	return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 3600 * 1000;
}

function writeAuth(auth) {
	try {
		localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
	} catch {
		/* storage unavailable */
	}
}

/** Raw sessions payload for backup (kept decoupled from the sessions lib). */
function readSessionsRaw() {
	try {
		return JSON.parse(localStorage.getItem("xcoder.ai.sessions") || "[]");
	} catch {
		return [];
	}
}
