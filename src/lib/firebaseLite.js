import settings from "lib/settings";

/**
 * Firebase "lite" — optional, basic integration using the Firestore REST
 * API only (no SDK download, no bundle impact, works in the webview).
 *
 * When the user configures `firebaseProjectId` + `firebaseApiKey` in
 * Settings > Cloud, the app can:
 *  - log lightweight usage events to the `xcoder_events` collection
 *  - read remote documents (announcements, remote config)
 *
 * Everything silently no-ops when disabled, misconfigured or offline.
 */

const FIRESTORE_ROOT = "https://firestore.googleapis.com/v1/projects";

/**
 * Validates the Firebase settings.
 * @returns {{enabled: boolean, projectId: string, apiKey: string}}
 */
export function firebaseConfig() {
        return {
                enabled: Boolean(settings.value.firebaseEnabled),
                projectId: String(settings.value.firebaseProjectId || "").trim(),
                apiKey: String(settings.value.firebaseApiKey || "").trim(),
        };
}

/**
 * Whether events can be sent right now.
 * @returns {boolean}
 */
export function isReady() {
        const config = firebaseConfig();
        return config.enabled && Boolean(config.projectId && config.apiKey);
}

/**
 * Logs an event document to Firestore (collection: xcoder_events).
 * Fire-and-forget: resolves true when accepted, false otherwise.
 * @param {string} name event name (e.g. "chat_sent")
 * @param {Record<string, any>} [fields] small scalar fields
 * @returns {Promise<boolean>}
 */
export async function logEvent(name, fields = {}) {
        if (!isReady()) return false;

        const config = firebaseConfig();
        const document = {
                fields: {
                        name: { stringValue: String(name).slice(0, 120) },
                        at: { integerValue: String(Date.now()) },
                        platform: {
                                stringValue:
                                        typeof window !== "undefined" && window.cordova ? "android" : "web",
                        },
                        ...toFirestoreFields(fields),
                },
        };

        try {
                const docId = `e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                const response = await fetch(
                        `${FIRESTORE_ROOT}/${config.projectId}/databases/(default)/documents/xcoder_events?documentId=${encodeURIComponent(docId)}&key=${encodeURIComponent(config.apiKey)}`,
                        {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(document),
                        },
                );
                return response.ok;
        } catch {
                return false;
        }
}

/**
 * Reads a Firestore document (e.g. xcoder_config/announcements).
 * @param {string} collectionPath e.g. "xcoder_config"
 * @param {string} docId e.g. "announcements"
 * @returns {Promise<Record<string, any> | null>} plain JS object or null
 */
export async function getDocument(collectionPath, docId) {
        const config = firebaseConfig();
        if (!config.enabled || !config.projectId || !config.apiKey) return null;

        try {
                const response = await fetch(
                        `${FIRESTORE_ROOT}/${config.projectId}/databases/(default)/documents/${collectionPath}/${docId}?key=${encodeURIComponent(config.apiKey)}`,
                );
                if (!response.ok) return null;
                const data = await response.json();
                return fromFirestoreFields(data?.fields || {});
        } catch {
                return null;
        }
}

/**
 * Converts plain values to Firestore REST fields.
 * @param {Record<string, any>} fields
 */
export function toFirestoreFields(fields) {
        const result = {};
        for (const [key, value] of Object.entries(fields || {})) {
                if (value === null || value === undefined) continue;
                switch (typeof value) {
                        case "boolean":
                                result[key] = { booleanValue: value };
                                break;
                        case "number":
                                if (Number.isInteger(value)) {
                                        result[key] = { integerValue: String(value) };
                                } else {
                                        result[key] = { doubleValue: value };
                                }
                                break;
                        default:
                                result[key] = { stringValue: String(value).slice(0, 500) };
                }
        }
        return result;
}

/**
 * Converts Firestore REST fields back to plain values.
 * @param {Record<string, any>} fields
 */
export function fromFirestoreFields(fields) {
        const result = {};
        for (const [key, typed] of Object.entries(fields || {})) {
                if ("stringValue" in typed) result[key] = typed.stringValue;
                else if ("booleanValue" in typed) result[key] = typed.booleanValue;
                else if ("integerValue" in typed) result[key] = Number(typed.integerValue);
                else if ("doubleValue" in typed) result[key] = Number(typed.doubleValue);
                else if ("timestampValue" in typed) result[key] = typed.timestampValue;
                else if ("nullValue" in typed) result[key] = null;
        }
        return result;
}
