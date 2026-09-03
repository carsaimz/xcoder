import { backendConfig } from "lib/backend";
import settings from "lib/settings";

/**
 * Minimal Supabase client (REST — no SDK dependency).
 *
 * Credentials resolve in this order:
 *  1. manual override in settings.json (`supabaseUrl`/`supabaseAnonKey`,
 *     kept for self-hosters — no UI anymore);
 *  2. the community site remote config (`/api/config` → `supabase.url` +
 *     `supabase.anonKey`), so the project is configured ON THE SITE and
 *     served to every app install with zero user setup.
 *
 * Only the ANON key reaches the device — exactly like a browser on the
 * site. All privileged work keeps happening server-side (site).
 *
 * Endpoints used (Supabase REST, all CORS-friendly):
 *  - POST {url}/auth/v1/token?grant_type=password
 *  - POST {url}/auth/v1/token?grant_type=refresh_token
 *  - GET  {url}/auth/v1/user
 *  - POST {url}/auth/v1/logout
 *  - GET/POST/PATCH {url}/rest/v1/{table}   (PostgREST)
 *  - POST {url}/storage/v1/object/{bucket}/{path}
 *
 * Session persistence: localStorage `xcoder.supabase.session`.
 */

const SESSION_KEY = "xcoder.supabase.session";
const FETCH_TIMEOUT = 15000;

/** @type {{access_token?: string, refresh_token?: string, user?: object, expires_at?: number} | null} */
let session = readSession();

/**
 * Whether the user has configured Supabase on this device.
 * @returns {boolean}
 */
export function supabaseConfigured() {
	return Boolean(supabaseUrl() && supabaseAnonKey());
}

/**
 * @returns {string} project URL without trailing slash
 */
export function supabaseUrl() {
	const local = String(settings.value?.supabaseUrl || "")
		.trim()
		.replace(/\/+$/, "");
	if (local) return local;
	return String(backendConfig()?.supabase?.url || "")
		.trim()
		.replace(/\/+$/, "");
}

/**
 * @returns {string} anon (publishable) key
 */
export function supabaseAnonKey() {
	const local = String(settings.value?.supabaseAnonKey || "").trim();
	if (local) return local;
	return String(backendConfig()?.supabase?.anonKey || "").trim();
}

// -------------------------------------------------------------------- auth

/**
 * Signs in with email + password and stores the session.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<object>} the Supabase user object
 */
export async function signInWithPassword(email, password) {
	const response = await request(`/auth/v1/token?grant_type=password`, {
		method: "POST",
		body: { email: String(email).trim(), password: String(password) },
	});
	if (!response?.access_token) {
		throw new Error(
			response?.error_description || response?.msg || "Sign in failed",
		);
	}
	session = {
		access_token: response.access_token,
		refresh_token: response.refresh_token,
		user: response.user,
		expires_at: Date.now() + Number(response.expires_in || 3600) * 1000,
	};
	writeSession(session);
	return session.user;
}

/**
 * Refreshes the stored session (when a refresh token exists).
 * @returns {Promise<boolean>} true when a fresh session is available
 */
export async function refreshSession() {
	if (!session?.refresh_token) return false;
	try {
		const response = await request(`/auth/v1/token?grant_type=refresh_token`, {
			method: "POST",
			body: { refresh_token: session.refresh_token },
		});
		if (!response?.access_token) return false;
		session = {
			access_token: response.access_token,
			refresh_token: response.refresh_token || session.refresh_token,
			user: response.user || session.user,
			expires_at: Date.now() + Number(response.expires_in || 3600) * 1000,
		};
		writeSession(session);
		return true;
	} catch {
		return false;
	}
}

/**
 * Signs out and clears the stored session.
 */
export async function signOut() {
	try {
		if (session?.access_token) {
			await request(`/auth/v1/logout`, { method: "POST" });
		}
	} catch {
		/* best effort — clear locally anyway */
	}
	session = null;
	try {
		localStorage.removeItem(SESSION_KEY);
	} catch {
		/* best effort */
	}
}

/**
 * @returns {object | null} the current Supabase user (when signed in)
 */
export function getUser() {
	return session?.user || null;
}

/**
 * @returns {object | null} the stored session
 */
export function getSession() {
	return session;
}

// ---------------------------------------------------------------- storage/db

/**
 * Tiny PostgREST helper: from("favorites").select() / .insert(rows) /
 * .update(rows, "id=eq.1"). Uses the stored session token when signed in.
 * @param {string} table
 */
export function from(table) {
	return {
		/**
		 * @param {string} [query] PostgREST query string ("select=*&order=created_at.desc&limit=20")
		 */
		async select(query = "select=*") {
			return request(`/rest/v1/${table}?${query}`);
		},
		/**
		 * @param {object | object[]} rows
		 */
		async insert(rows) {
			return request(`/rest/v1/${table}`, {
				method: "POST",
				body: rows,
				prefer: "return=representation",
			});
		},
		/**
		 * @param {object} row
		 * @param {string} match PostgREST filter ("id=eq.1")
		 */
		async update(row, match) {
			return request(`/rest/v1/${table}?${match}`, {
				method: "PATCH",
				body: row,
				prefer: "return=representation",
			});
		},
	};
}

/**
 * Uploads a file to a Storage bucket.
 * @param {string} bucket
 * @param {string} path
 * @param {Blob} blob
 * @param {string} [contentType]
 * @returns {Promise<{key?: string, error?: any}>}
 */
export async function uploadFile(
	bucket,
	path,
	blob,
	contentType = "application/octet-stream",
) {
	const base = supabaseUrl();
	const anon = supabaseAnonKey();
	if (!base || !anon) throw new Error("Supabase is not configured");

	const token = await accessToken();
	const response = await withTimeout(
		fetch(`${base}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
			method: "POST",
			headers: {
				apikey: anon,
				Authorization: token ? `Bearer ${token}` : `Bearer ${anon}`,
				"Content-Type": contentType,
				"x-upsert": "true",
			},
			body: blob,
		}),
	);
	return response.json().catch(() => ({}));
}

// ------------------------------------------------------------------ internal

/**
 * A valid access token: refreshes automatically when expired.
 * @returns {Promise<string | null>}
 */
async function accessToken() {
	if (!session) return null;
	if (session.expires_at && session.expires_at - Date.now() < 60000) {
		await refreshSession();
	}
	return session?.access_token || null;
}

/**
 * REST request against the configured project.
 * @param {string} path
 * @param {{method?: string, body?: object, prefer?: string}} [opts]
 * @returns {Promise<any>} parsed JSON (null on 204)
 */
async function request(path, opts = {}) {
	const base = supabaseUrl();
	const anon = supabaseAnonKey();
	if (!base || !anon) throw new Error("Supabase is not configured");

	const token = await accessToken();
	const headers = {
		apikey: anon,
		Authorization: `Bearer ${token || anon}`,
	};
	if (opts.body !== undefined) headers["Content-Type"] = "application/json";
	if (opts.prefer) headers.Prefer = opts.prefer;

	const response = await withTimeout(
		fetch(`${base}${path}`, {
			method: opts.method || "GET",
			headers,
			body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
		}),
	);

	if (response.status === 204) return null;
	const text = await response.text();
	let json = null;
	try {
		json = text ? JSON.parse(text) : null;
	} catch {
		json = { msg: text?.slice(0, 200) };
	}
	if (!response.ok) {
		const error = new Error(
			json?.msg || json?.error_description || `HTTP ${response.status}`,
		);
		error.payload = json;
		throw error;
	}
	return json;
}

/**
 * @param {Promise<any>} promise
 * @returns {Promise<any>}
 */
function withTimeout(promise) {
	return Promise.race([
		promise,
		new Promise((_, reject) =>
			setTimeout(() => reject(new Error("timeout")), FETCH_TIMEOUT),
		),
	]);
}

function readSession() {
	try {
		const raw = localStorage.getItem(SESSION_KEY);
		const parsed = raw ? JSON.parse(raw) : null;
		return parsed && typeof parsed === "object" ? parsed : null;
	} catch {
		return null;
	}
}

function writeSession(value) {
	try {
		localStorage.setItem(SESSION_KEY, JSON.stringify(value));
	} catch {
		/* best effort */
	}
}

export default {
	supabaseConfigured,
	supabaseUrl,
	supabaseAnonKey,
	signInWithPassword,
	refreshSession,
	signOut,
	getUser,
	getSession,
	from,
	uploadFile,
};
