import { backendConfig, sendFeedback } from "lib/backend";
import settings from "lib/settings";

/**
 * Firebase "lite" — Firebase is intentionally limited to the native
 * services (Analytics, Crashlytics, Remote Config, FCM). The web layer no
 * longer talks to Firestore or Firebase Auth.
 *
 * This module keeps a small compatibility surface for the rest of the app:
 *  - logEvent()     → anonymous usage event posted to the Xcoder site
 *                     (/api/feedback, keyed by a local device id)
 *  - getDocument()  → remote config values served by the site (/api/config)
 *
 * Everything silently no-ops when disabled, misconfigured or offline.
 */

/**
 * Whether lightweight events can be sent right now.
 * @returns {boolean}
 */
export function isReady() {
	return Boolean(settings.value?.firebaseEnabled);
}

/**
 * Legacy config shape — credentials are no longer used (native Firebase
 * services ship their own config); kept so existing callers keep working.
 * @returns {{enabled: boolean, projectId: string, apiKey: string}}
 */
export function firebaseConfig() {
	return {
		enabled: Boolean(settings.value?.firebaseEnabled),
		projectId: "",
		apiKey: "",
	};
}

/**
 * Logs an anonymous usage event to the Xcoder site backend.
 * Fire-and-forget: resolves true when accepted, false otherwise.
 * @param {string} name event name (e.g. "chat_sent")
 * @param {Record<string, any>} [fields] small scalar fields
 * @returns {Promise<boolean>}
 */
export async function logEvent(name, fields = {}) {
	if (!isReady()) return false;
	try {
		return await sendFeedback("event", { name, ...fields });
	} catch {
		return false;
	}
}

/**
 * Reads a remote config document served by the Xcoder site.
 * Supported ids: "announcements", "config" (full /api/config payload).
 * @param {string} _collectionPath kept for signature compatibility
 * @param {string} docId e.g. "announcements"
 * @returns {Promise<Record<string, any> | null>} plain JS object or null
 */
export async function getDocument(_collectionPath, docId) {
	if (!isReady()) return null;
	const config = backendConfig();
	if (!config || typeof config !== "object") return null;
	if (docId === "config") return config;
	if (docId === "announcements") {
		const announcements = config.announcements;
		if (Array.isArray(announcements)) return { announcements };
		if (announcements && typeof announcements === "object")
			return announcements;
		return null;
	}
	return config[docId] ?? null;
}

/**
 * Legacy REST helpers kept as no-ops so stale imports never crash.
 */
export function toFirestoreFields(fields) {
	return fields && typeof fields === "object" ? { ...fields } : {};
}

export function fromFirestoreFields(fields) {
	return fields && typeof fields === "object" ? { ...fields } : {};
}
