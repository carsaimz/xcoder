/**
 * GitHub repository picker — shared by the Git sidebar app and the AI
 * chat (repo context). Moved OUT of the GitHub settings page: listing
 * repositories belongs where the repos are USED (git panel, chat), not
 * buried in settings.
 *
 * Functions are UI-level (toasts/loader/select) on purpose — callers get
 * a one-line "pick a repository" flow and the settings persistence for
 * ghRepo/gitRemoteUrl/ghBranch happens here.
 */
import toast from "components/toast";
import loader from "dialogs/loader";
import select from "dialogs/select";
import settings from "lib/settings";

const REPOS_URL =
	"https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator";

/**
 * CORS-free GET for api.github.com (native plugin inside the webview,
 * fetch fallback elsewhere). api.github.com also sends CORS headers, so
 * the fetch fallback works in browser builds too.
 * @param {string} url
 * @param {string} token
 * @returns {Promise<any>} parsed JSON body
 */
export async function ghApiGet(url, token) {
	const headers = {
		Accept: "application/vnd.github+json",
		Authorization: `Bearer ${token}`,
		"X-GitHub-Api-Version": "2022-11-28",
	};

	if (typeof cordova !== "undefined" && cordova.plugin?.http?.sendRequest) {
		return new Promise((resolve, reject) => {
			cordova.plugin.http.sendRequest(
				url,
				{
					method: "GET",
					headers,
					serializer: "json",
					responseType: "json",
					timeout: 20000,
				},
				(response) => {
					let data = response.data;
					if (typeof data === "string") {
						try {
							data = JSON.parse(data);
						} catch {
							data = null;
						}
					}
					resolve(data);
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

	const response = await fetch(url, { headers });
	const text = await response.text();
	let data = null;
	try {
		data = text ? JSON.parse(text) : null;
	} catch {
		/* non-JSON error body */
	}
	if (!response.ok) {
		throw new Error(
			`GitHub ${response.status}: ${data?.message || text?.slice(0, 140) || "request failed"}`,
		);
	}
	return data;
}

/**
 * The token to use for GitHub API calls (device-flow / PAT session).
 * @returns {string}
 */
export function ghToken() {
	return String(settings.value.ghToken || "").trim();
}

/**
 * Lists the user's repositories (owner + collaborator).
 * @returns {Promise<Array<object>>}
 */
export async function listGhRepos() {
	const token = ghToken();
	if (!token) {
		throw new Error(
			strings["github token needed"] ||
				"Sign in or set a token to list repositories",
		);
	}
	const repos = await ghApiGet(REPOS_URL, token);
	return Array.isArray(repos) ? repos : [];
}

/**
 * Opens the repository picker: loader + select dialog with the user's
 * repositories (first 60). Does NOT persist — call applyGhRepo with the
 * chosen repo (or use pickAndApplyGhRepo).
 * @returns {Promise<object | null>} the chosen repository object
 */
export async function chooseGhRepo() {
	const token = ghToken();
	if (!token) {
		toast(
			strings["github token needed"] ||
				"Sign in or set a token to list repositories",
			3000,
		);
		return null;
	}

	const hide = await loader.show();
	let repos = [];
	try {
		repos = await listGhRepos();
	} catch (error) {
		toast(String(error.message || error), 4000);
		return null;
	} finally {
		hide();
	}

	if (!repos.length) {
		toast(strings["github no repos"] || "No repositories found", 3000);
		return null;
	}

	const options = repos.slice(0, 60).map((repo) => [
		repo.full_name,
		`${repo.full_name}${repo.private ? " 🔒" : ""}`, // label
		"svg:folder", // icon
	]);
	const fullName = await select(
		strings["github repos"] || "My repositories",
		options,
	);
	if (!fullName) return null;

	return repos.find((repo) => repo.full_name === fullName) || null;
}

/**
 * Persists the chosen repository as the active GitHub repo (used by the
 * Git panel commands, clone/push and the AI chat repo context).
 * @param {object} repo repository object from the GitHub API
 */
export async function applyGhRepo(repo) {
	if (!repo?.full_name) return false;
	settings.value.ghRepo = repo.full_name || "";
	settings.value.gitRemoteUrl =
		repo.clone_url || `https://github.com/${repo.full_name}.git`;
	settings.value.ghBranch = repo.default_branch || "main";
	await settings.update();
	toast(
		`${strings["github repo saved"] || "Repository"}: ${settings.value.ghRepo}`,
		2500,
	);
	return true;
}

/**
 * One-call flow for UI entry points: choose + apply.
 * @returns {Promise<boolean>} whether a repository was set
 */
export async function pickAndApplyGhRepo() {
	const repo = await chooseGhRepo();
	if (!repo) return false;
	return applyGhRepo(repo);
}
