/**
 * GitHub agent tools — let the AI work with the repository selected in
 * the Git sidebar (settings.ghRepo) through the official REST API, using
 * the user's own session token (device flow or PAT). No proxy, no
 * server: the token stays on the device and the calls go straight to
 * api.github.com (native http plugin inside the webview, fetch
 * fallback elsewhere).
 *
 * Two tools, aligned with the permission system:
 *  - github_read  (danger "read"):  tree, file contents, issues, PRs...
 *  - github_write (danger "write"): contents API commits, issues, PR
 *    comments, branches — the agent must ask before writing.
 */
import settings from "lib/settings";

const API = "https://api.github.com";
const MAX_OUT = 8000;

/**
 * The token to use (device-flow / PAT session from the GitHub sign-in).
 * @returns {string}
 */
function token() {
	return String(settings.value.ghToken || "").trim();
}

/**
 * The repository selected in the Git sidebar ("owner/name" or "").
 * @returns {string}
 */
export function activeGhRepo() {
	return String(settings.value.ghRepo || "").trim();
}

/** @returns {string} default branch for the active repo */
function activeBranch() {
	return String(settings.value.ghBranch || "main").trim() || "main";
}

/**
 * Whether the GitHub tools can run right now.
 * @returns {boolean}
 */
export function ghToolsAvailable() {
	return Boolean(activeGhRepo() && token());
}

/**
 * Text for the system prompt (empty when the tools cannot run).
 * @returns {string}
 */
export function ghToolsContext() {
	if (!activeGhRepo()) return "";
	if (!token()) {
		return (
			`GitHub repository: ${activeGhRepo()} — set as active in the Git panel, ` +
			"but there is no GitHub token on this device yet, so the github_read/github_write tools are unavailable. " +
			"If the user wants GitHub work, ask them to sign in (Git sidebar or Settings → GitHub)."
		);
	}
	return (
		`GitHub repository (active in the Git panel): ${activeGhRepo()} ` +
		`(branch ${activeBranch()}). ` +
		'You can work with it directly: github_read with {"tree":true} lists tracked files, ' +
		'github_read with {"file":"src/main.js"} returns file content, ' +
		'github_read with {"endpoint":"repos/..."} calls any GET endpoint, ' +
		"github_write commits through the contents API (needs the file sha) and can create issues/PRs. " +
		"NEVER write to GitHub (github_write) without the user's explicit request."
	);
}

/**
 * CORS-free GitHub API request (native plugin first, fetch fallback).
 * @param {string} method
 * @param {string} endpoint API path (after https://api.github.com/) or an absolute api.github.com URL
 * @param {object | undefined} body JSON body for write methods
 * @returns {Promise<{status: number, data: any}>}
 */
async function ghApi(method, endpoint, body) {
	const url = endpoint.startsWith("http")
		? endpoint
		: `${API}/${String(endpoint).replace(/^\/+/, "")}`;
	const headers = {
		Accept: "application/vnd.github+json",
		Authorization: `Bearer ${token()}`,
		"X-GitHub-Api-Version": "2022-11-28",
	};
	if (body !== undefined) headers["Content-Type"] = "application/json";

	if (typeof cordova !== "undefined" && cordova.plugin?.http?.sendRequest) {
		return new Promise((resolve, reject) => {
			cordova.plugin.http.sendRequest(
				url,
				{
					method,
					headers,
					serializer: "json",
					responseType: "json",
					data: body,
					timeout: 30000,
				},
				(response) => {
					let data = response.data;
					if (typeof data === "string") {
						try {
							data = JSON.parse(data);
						} catch {
							/* keep raw string */
						}
					}
					resolve({ status: response.status || 200, data });
				},
				(error) => {
					let detail = error?.error || "";
					if (detail && typeof detail !== "string") {
						try {
							detail = detail?.message || JSON.stringify(detail);
						} catch {
							detail = String(detail);
						}
					}
					reject(
						new Error(
							`GitHub ${error?.status || ""}: ${detail || error?.statusText || "request failed"}`,
						),
					);
				},
			);
		});
	}

	const response = await fetch(url, {
		method,
		headers,
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
	const text = await response.text();
	let data = null;
	try {
		data = text ? JSON.parse(text) : null;
	} catch {
		data = text?.slice(0, 400);
	}
	if (!response.ok) {
		const message = data?.message || String(data || "").slice(0, 140);
		throw new Error(
			`GitHub ${response.status}: ${message || "request failed"}`,
		);
	}
	return { status: response.status, data };
}

/** UTF-8 safe base64 → text. @param {string} b64 */
function b64ToText(b64) {
	const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

/** UTF-8 safe text → base64. @param {string} text */
export function textToB64(text) {
	const bytes = new TextEncoder().encode(text);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

/** @param {string} text */
function truncate(text) {
	if (!text) return "";
	if (text.length <= MAX_OUT) return text;
	return `${text.slice(0, MAX_OUT)}\n... (truncated)`;
}

/** Guards shared by both tools. @returns {string | null} error text */
function availabilityError() {
	if (!activeGhRepo()) {
		return (
			"ERROR: no GitHub repository is selected. Ask the user to pick one " +
			"in the Git sidebar (Repositório GitHub card) first."
		);
	}
	if (!token()) {
		return (
			"ERROR: no GitHub token on this device. Ask the user to sign in " +
			"(Git sidebar → Sign in with GitHub, or Settings → GitHub)."
		);
	}
	return null;
}

/** @param {string} repo */
function repoPrefix(repo) {
	return `repos/${repo}`;
}

/**
 * github_read implementation.
 * @param {{tree?: boolean, file?: string, endpoint?: string, ref?: string}} args
 * @returns {Promise<string>}
 */
export async function githubRead(args) {
	const blocked = availabilityError();
	if (blocked) return blocked;
	const repo = activeGhRepo();
	const ref = String(args?.ref || activeBranch());

	try {
		if (args?.tree) {
			const { data } = await ghApi(
				"GET",
				`${repoPrefix(repo)}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
			);
			if (!Array.isArray(data?.tree)) return "ERROR: unexpected tree response";
			const paths = data.tree
				.filter((entry) => entry.type === "blob")
				.map((entry) => entry.path);
			if (!paths.length) return "(empty tree)";
			return truncate(
				`${paths.length} files:\n${paths.slice(0, 400).join("\n")}${
					paths.length > 400 ? "\n..." : ""
				}`,
			);
		}

		if (args?.file) {
			const filePath = String(args.file).replace(/^\/+/, "");
			const { data } = await ghApi(
				"GET",
				`${repoPrefix(repo)}/contents/${filePath
					.split("/")
					.map(encodeURIComponent)
					.join("/")}?ref=${encodeURIComponent(ref)}`,
			);
			if (typeof data?.content !== "string") {
				return `ERROR: "${filePath}" is not a regular file (directory or missing).`;
			}
			if (data.encoding !== "base64") {
				return truncate(String(data.content || "(empty)"));
			}
			const text = b64ToText(data.content.replace(/\n/g, ""));
			return truncate(
				`${filePath} (branch ${ref}, sha ${String(data.sha || "").slice(0, 10)}):\n${text}`,
			);
		}

		const endpoint = String(args?.endpoint || "").trim();
		if (!endpoint) {
			return (
				'ERROR: pass {"tree":true}, {"file":"path/in/repo"} or ' +
				'{"endpoint":"repos/owner/repo/..."} — exactly one.'
			);
		}
		const { data } = await ghApi("GET", endpoint);
		return truncate(JSON.stringify(data, null, 1));
	} catch (error) {
		return `ERROR: ${error.message || error}`;
	}
}

/**
 * github_write implementation.
 * @param {{endpoint: string, method?: string, body?: object}} args
 * @returns {Promise<string>}
 */
export async function githubWrite(args) {
	const blocked = availabilityError();
	if (blocked) return blocked;
	const endpoint = String(args?.endpoint || "").trim();
	const method = String(args?.method || "POST").toUpperCase();
	if (!endpoint) {
		return "ERROR: missing endpoint (repos/owner/repo/...).";
	}
	if (!["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
		return "ERROR: github_write only accepts POST, PATCH, PUT or DELETE — use github_read for GET.";
	}
	const body =
		args?.body && typeof args.body === "object" ? args.body : undefined;
	try {
		const { data, status } = await ghApi(method, endpoint, body);
		return truncate(
			`OK (HTTP ${status}). ${JSON.stringify(data)?.slice(0, 1200) || ""}`,
		);
	} catch (error) {
		return `ERROR: ${error.message || error}`;
	}
}

/**
 * Convenience used by the AI itself: commit a whole file through the
 * contents API (fetch sha → PUT). Exposed as guidance in github_read's
 * file response (it prints the sha).
 * @param {string} filePath repo-relative path
 * @param {string} content new file content
 * @param {string} message commit message
 * @param {{branch?: string, sha?: string}} [opts]
 * @returns {Promise<string>}
 */
export async function putRepoFile(filePath, content, message, opts = {}) {
	const blocked = availabilityError();
	if (blocked) return blocked;
	const repo = activeGhRepo();
	const branch = String(opts.branch || activeBranch());
	const cleanPath = String(filePath).replace(/^\/+/, "");
	try {
		let sha = opts.sha;
		if (!sha) {
			try {
				const { data } = await ghApi(
					"GET",
					`${repoPrefix(repo)}/contents/${cleanPath
						.split("/")
						.map(encodeURIComponent)
						.join("/")}?ref=${encodeURIComponent(branch)}`,
				);
				sha = data?.sha;
			} catch {
				/* file does not exist yet — creating */
			}
		}
		const { status } = await ghApi(
			"PUT",
			`${repoPrefix(repo)}/contents/${cleanPath
				.split("/")
				.map(encodeURIComponent)
				.join("/")}`,
			{
				message: String(message || "Update via XCoder AI"),
				content: textToB64(String(content ?? "")),
				branch,
				...(sha ? { sha } : {}),
			},
		);
		return `OK (HTTP ${status}) — committed ${cleanPath} to ${branch} on GitHub.`;
	} catch (error) {
		return `ERROR: ${error.message || error}`;
	}
}
