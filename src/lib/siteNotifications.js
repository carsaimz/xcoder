import settings from "lib/settings";

/**
 * Site-driven notifications ("site as FCM replacement").
 *
 * The community site (xcoder-web) is the single source of notifications:
 * the app polls GET /api/app/notifications on the official site (or a
 * self-hosted override via lib/backend.js) and delivers every new entry
 * through
 *
 *  1. the Android status bar — when cordova-plugin-local-notifications is
 *     installed (add it after device testing: see config.xml), and/or
 *  2. the in-app notification center (lib/notificationManager) and toasts,
 *     which always work, even offline.
 *
 * Delivery is idempotent: seen notification ids are kept in localStorage
 * (newest-last), so polling again never repeats an entry. Everything
 * silently no-ops offline — boot is never blocked.
 */

const SEEN_KEY = "xcoder.site.notifs.seen";
const LAST_SEEN_KEY = "xcoder.site.notifs.lastseen";
const POLL_INTERVAL = 4 * 60 * 60 * 1000; // every 4 hours
const FIRST_POLL_DELAY = 15 * 1000;
const FETCH_TIMEOUT = 8000;

let pollTimer = 0;
let started = false;

/**
 * Fetches the current notification list from the site.
 * @param {string} url site base URL
 * @returns {Promise<Array<{id: number|string, title: string, body: string, level?: string, url?: string, created_at?: string}>>}
 */
async function fetchNotifications(url) {
	const response = await Promise.race([
		fetch(`${url}/api/app/notifications`, {
			cache: "no-cache",
			headers: { "X-Device-ID": deviceId() },
		}),
		new Promise((_, reject) =>
			setTimeout(() => reject(new Error("timeout")), FETCH_TIMEOUT),
		),
	]);
	if (!response?.ok) throw new Error(`HTTP ${response?.status}`);
	const json = await response.json().catch(() => null);
	return Array.isArray(json?.notifications) ? json.notifications : [];
}

/**
 * Anonymous device id shared with the site (lib/backend.js generates it;
 * duplicated here lazily to keep both modules decoupled).
 * @returns {string}
 */
function deviceId() {
	try {
		const KEY = "xcoder.deviceId";
		let id = localStorage.getItem(KEY);
		if (!id) {
			id =
				typeof crypto?.randomUUID === "function"
					? crypto.randomUUID()
					: `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
			localStorage.setItem(KEY, id);
		}
		return id;
	} catch {
		return "anonymous";
	}
}

/**
 * @returns {Array<string|number>} seen ids (capped)
 */
function readSeen() {
	try {
		const raw = localStorage.getItem(SEEN_KEY);
		const list = raw ? JSON.parse(raw) : [];
		return Array.isArray(list) ? list : [];
	} catch {
		return [];
	}
}

/**
 * @param {Array<string|number>} ids
 */
function writeSeen(ids) {
	try {
		localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-60)));
	} catch {
		/* best effort */
	}
}

/**
 * Shows one notification through every available channel.
 * @param {{id: number|string, title: string, body: string, url?: string}} item
 */
function deliver(item) {
	const title = String(item.title || "XCoder").slice(0, 80);
	const body = String(item.body || "").slice(0, 200);

	// 1) system status-bar notification (when the plugin is installed)
	try {
		const plugin = cordova?.plugins?.notification?.local;
		if (plugin) {
			plugin.requestPermission?.(() => {});
			plugin.schedule({
				id: Number(item.id) || Math.abs(hashCode(String(item.id))) % 100000,
				title,
				text: body,
				data: item,
				smallIcon: "res://ic_stat_notify",
				foreground: false,
			});
			plugin.on?.("click", (notification) => {
				const target = notification?.data?.url;
				if (target) system.openInBrowser(target);
			});
		}
	} catch {
		/* plugin absent — in-app path still delivers */
	}

	// 2) in-app notification center + toast
	try {
		window.xcoder?.pushNotification?.(title, body || undefined);
	} catch {
		/* not booted yet — seen ids still recorded */
	}
}

/**
 * @param {string} text
 * @returns {number}
 */
function hashCode(text) {
	let hash = 0;
	for (let i = 0; i < text.length; i++) {
		hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
	}
	return hash;
}

/**
 * Fetches the site list and delivers entries not seen before.
 * @param {boolean} [force] ignore the user toggle (used nowhere by default)
 * @returns {Promise<number>} number of newly delivered notifications
 */
export async function pollSiteNotifications(force = false) {
	if (!force && settings.value.notificationsEnabled === false) return 0;

	let url = "";
	try {
		const { backendUrl } = await import("lib/backend");
		url = backendUrl();
		const items = await fetchNotifications(url);
		if (!items.length) return 0;

		const seen = readSeen();
		const seenSet = new Set(seen.map(String));
		let delivered = 0;

		// oldest first so the in-app center shows newest on top
		for (const item of items.slice().reverse()) {
			const id = String(item?.id ?? "");
			if (!id || seenSet.has(id) || !item?.title) continue;
			deliver(item);
			seen.push(id);
			delivered++;
		}

		if (delivered) writeSeen(seen);
		try {
			localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
		} catch {
			/* best effort */
		}
		return delivered;
	} catch {
		return 0; // offline / site unreachable — silent
	}
}

/**
 * Starts the background polling (boot + every 4 h + on app resume).
 * Safe to call multiple times.
 */
export function startNotificationPolling() {
	if (started) return;
	started = true;

	setTimeout(() => {
		pollSiteNotifications().catch(() => {});
	}, FIRST_POLL_DELAY);

	pollTimer = setInterval(() => {
		pollSiteNotifications().catch(() => {});
	}, POLL_INTERVAL);

	document.addEventListener(
		"resume",
		() => {
			pollSiteNotifications().catch(() => {});
		},
		false,
	);
}

/**
 * Stops polling (used by tests / cleanup).
 */
export function stopNotificationPolling() {
	if (pollTimer) clearInterval(pollTimer);
	pollTimer = 0;
	started = false;
}

export default {
	pollSiteNotifications,
	startNotificationPolling,
	stopNotificationPolling,
};
