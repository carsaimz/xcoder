/**
 * Checks for XCoder app updates against GitHub releases.
 *
 * The latest *stable* release is used (GitHub's /releases/latest endpoint
 * skips drafts and pre-releases), so beta/debug builds are never compared
 * against pre-release tags.
 *
 * Works with cordova-plugin-advanced-http when running inside the app and
 * falls back to fetch() (browser/tests) otherwise.
 */

const RELEASE_API_URL =
	"https://api.github.com/repos/carsaimz/xcoder/releases/latest";

// Matches the numeric prefix of versions such as "v1.2.3", "1.2.3-debug"
// or "1.4.0-beta.1" (pre-release suffixes are ignored on purpose).
const VERSION_PREFIX_RE = /^v?(\d+(?:\.\d+){0,2})/i;

/**
 * Parses the numeric prefix of a version string into [major, minor, patch].
 * @param {string} version Raw version or tag (e.g. "v1.4.0-beta.1")
 * @returns {[number, number, number]|null} null when no numeric version is found
 */
export function parseLooseVersion(version) {
	const match = String(version || "")
		.trim()
		.match(VERSION_PREFIX_RE);
	if (!match) return null;
	const parts = match[1].split(".").map(Number);
	while (parts.length < 3) {
		parts.push(0);
	}
	return /** @type {[number, number, number]} */ (parts);
}

/**
 * Compares two loose versions numerically, ignoring pre-release suffixes.
 * @param {string} candidate Version being tested (e.g. release tag)
 * @param {string} current Installed version (e.g. BuildInfo.version)
 * @returns {boolean} true when candidate is strictly newer than current
 */
export function isNewerVersion(candidate, current) {
	const latest = parseLooseVersion(candidate);
	const installed = parseLooseVersion(current);
	if (!latest || !installed) return false;
	for (let i = 0; i < 3; i++) {
		if (latest[i] > installed[i]) return true;
		if (latest[i] < installed[i]) return false;
	}
	return false;
}

/**
 * Fetches the latest release payload from the GitHub API.
 * @returns {Promise<{tag_name: string, html_url: string}|any>} Release object
 * @throws {Error} when the request fails
 */
export function fetchLatestRelease() {
	return new Promise((resolve, reject) => {
		const http = globalThis.cordova?.plugin?.http;
		if (typeof http?.sendRequest === "function") {
			http.sendRequest(
				RELEASE_API_URL,
				{ method: "GET", responseType: "json" },
				/** @param {{data: any}} response */
				(response) => resolve(response.data),
				/** @param {any} error */
				(error) =>
					reject(
						error instanceof Error
							? error
							: new Error(String(error?.status || error || "http error")),
					),
			);
			return;
		}

		fetch(RELEASE_API_URL, {
			headers: { Accept: "application/vnd.github+json" },
		})
			.then(async (response) => {
				if (!response.ok) {
					throw new Error(`GitHub API responded with ${response.status}`);
				}
				return response.json();
			})
			.then(resolve, reject);
	});
}

/**
 * Checks whether a newer stable release exists.
 * @returns {Promise<null|{hasUpdate: boolean, tag: string, url: string}>}
 *   null when the release payload could not be used.
 */
export async function checkAppUpdate() {
	const release = await fetchLatestRelease();
	if (!release?.tag_name) return null;
	return {
		hasUpdate: isNewerVersion(release.tag_name, BuildInfo.version),
		tag: release.tag_name,
		url: release.html_url || RELEASE_API_URL.replace("/releases/latest", ""),
	};
}

export default {
	checkAppUpdate,
	fetchLatestRelease,
	isNewerVersion,
	parseLooseVersion,
};
