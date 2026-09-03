import settingsPage from "components/settingsPage";
import toast from "components/toast";
import confirm from "dialogs/confirm";
import loader from "dialogs/loader";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import { fetchGhUser, pollForToken, requestDeviceCode } from "lib/ghAuth";
import settings from "lib/settings";
import "./gh-settings.scss";

/**
 * XCoder GitHub settings — account (device-flow sign in), token (PAT),
 * repositories (list from the API and pick one) and the OAuth client id.
 */

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
async function ghGet(url, token) {
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
 * Opens the GitHub configuration page.
 */
export default function ghSettings() {
	const title = strings["github settings"] || "GitHub";

	const page = settingsPage(title, buildItems(), handleCallback, "united", {
		pageClassName: "gh-settings-page",
	});
	page.show();
	mountHero(page.getListElement?.());
	refresh();
	return page;

	/**
	 * Builds (once) and inserts the account hero card above the list.
	 * @param {HTMLElement} [$list]
	 */
	function mountHero($list) {
		if (!$list || $list.get(".gh-hero")) return;
		const $hero = (
			<div className="gh-hero" data-signed="false">
				<div className="gh-hero-avatar" aria-hidden="true">
					<span className="gh-hero-letter">G</span>
				</div>
				<div className="gh-hero-text">
					<span className="gh-hero-login">GitHub</span>
					<span className="gh-hero-status">
						{strings["not signed in"] || "Not signed in"}
					</span>
				</div>
				<span className="gh-hero-chip" />
			</div>
		);
		$list.prepend($hero);
	}

	/**
	 * Re-renders the hero card contents from current settings.
	 */
	function refreshHero() {
		const $list = page.getListElement?.();
		const $hero = $list?.get(".gh-hero");
		if (!$hero) return;
		const values = settings.value;
		const signedIn = Boolean(values.ghUserLogin || values.ghToken);

		$hero.dataset.signed = String(signedIn);
		const $avatar = $hero.get(".gh-hero-avatar");
		if ($avatar) {
			$avatar.textContent = "";
			if (values.ghUserAvatar) {
				const $img = (
					<img src={values.ghUserAvatar} alt={values.ghUserLogin || ""} />
				);
				$img.onerror = () => {
					$img.remove();
					$avatar.append((values.ghUserLogin || "G").charAt(0).toUpperCase());
				};
				$avatar.append($img);
			} else {
				$avatar.append((values.ghUserLogin || "G").charAt(0).toUpperCase());
			}
		}
		const $login = $hero.get(".gh-hero-login");
		if ($login) {
			$login.textContent = values.ghUserLogin || "GitHub";
		}
		const $status = $hero.get(".gh-hero-status");
		if ($status) {
			$status.textContent = values.ghUserLogin
				? values.ghUserName || `@${values.ghUserLogin}`
				: signedIn
					? strings["github token only"] || "Token set — no profile"
					: strings["not signed in"] || "Not signed in";
		}
		const $chip = $hero.get(".gh-hero-chip");
		if ($chip) {
			$chip.textContent = signedIn
				? strings["github chip connected"] || "Connected"
				: strings["github chip offline"] || "Offline";
		}
	}

	/**
	 * Builds the item list from current settings.
	 * @returns {Array<object>}
	 */
	function buildItems() {
		const values = settings.value;
		const signedIn = Boolean(values.ghUserLogin || values.ghToken);

		return [
			{
				key: "gh-account",
				text: strings["github account"] || "GitHub account",
				value: values.ghUserLogin
					? `${values.ghUserLogin}${values.ghUserName ? ` · ${values.ghUserName}` : ""}`
					: signedIn
						? strings["github token only"] || "Token set — no profile"
						: strings["not signed in"] || "Not signed in",
				info:
					strings["settings-info-gh-account"] ||
					"Sign in with the GitHub device flow: you get a code, open github.com/login/device in a browser and enter it.",
				chevron: true,
			},
			{
				key: "gh-signin",
				text: strings["sign in with github"] || "Sign in with GitHub",
				button: "primary",
				info:
					strings["settings-info-gh-signin"] ||
					"Opens the device-flow sign in. A GitHub OAuth App client id is required (set below or on first use).",
			},
			{
				key: "gh-signout",
				text: strings.logout || "Logout",
				button: "primary",
				info:
					strings["settings-info-gh-signout"] ||
					"Removes the stored token and profile from this device.",
			},
			{
				key: "ghToken",
				text: strings["github token"] || "Personal access token",
				value: values.ghToken ? "••••••••" : "",
				prompt: strings["github token"] || "Personal access token",
				promptType: "text",
				promptOptions: { required: false },
				info:
					strings["settings-info-gh-token"] ||
					"Alternative to signing in: paste a PAT (classic or fine-grained) with repo, workflow and gist scopes.",
			},
			{
				key: "gh-repos",
				text: strings["github repos"] || "My repositories",
				value: values.ghRepo || "",
				info:
					strings["settings-info-gh-repos"] ||
					"Lists your repositories and sets the one used by push/clone. Requires an account or token.",
				chevron: true,
			},
			{
				key: "gitRemoteUrl",
				text: strings["git remote url"] || "Remote URL",
				value: values.gitRemoteUrl || "",
				prompt: strings["git remote url"] || "Remote URL",
				promptType: "text",
				promptOptions: { required: false },
				info:
					strings["settings-info-gh-remote"] ||
					"Repository URL used by the Git panel commands (https://github.com/user/repo.git).",
			},
			{
				key: "ghBranch",
				text: strings["git branch"] || "Branch",
				value: values.ghBranch || "main",
				prompt: strings["git branch"] || "Branch",
				promptType: "text",
				promptOptions: { required: false },
				info:
					strings["settings-info-gh-branch"] ||
					"Default branch used by push and clone commands.",
			},
			{
				key: "ghOAuthClientId",
				text: strings["github client id"] || "OAuth App client id",
				value: values.ghOAuthClientId || "",
				prompt: strings["github client id"] || "OAuth App client id",
				promptType: "text",
				promptOptions: { required: false },
				info:
					strings["settings-info-gh-client-id"] ||
					"Client id of your GitHub OAuth App with Device Flow enabled (github.com/settings/developers).",
			},
		];
	}

	/**
	 * @param {string} key
	 */
	async function handleCallback(key, value) {
		switch (key) {
			case "gh-account": {
				if (settings.value.ghUserLogin || settings.value.ghToken) {
					await promptAccountActions();
				} else {
					await signInDeviceFlow();
				}
				refresh();
				break;
			}

			case "gh-signin":
				await signInDeviceFlow();
				refresh();
				break;

			case "gh-signout":
				await signOut();
				refresh();
				break;

			case "ghToken":
				// the settings kit already persisted the prompt value
				if (settings.value.ghToken && !settings.value.ghUserLogin) {
					await fetchProfile(settings.value.ghToken);
				}
				refresh();
				break;

			case "gh-repos":
				await pickRepo();
				refresh();
				break;

			case "gitRemoteUrl":
			case "ghBranch":
			case "ghOAuthClientId":
				// persisted by the settings kit; nothing else to do
				break;

			default:
				break;
		}
	}

	/**
	 * Patches the visible row values after actions that change settings
	 * outside the kit's prompt flow.
	 */
	function refresh() {
		const $list = page.getListElement?.();
		if (!$list) return;
		refreshHero();
		const values = settings.value;
		const signedIn = Boolean(values.ghUserLogin || values.ghToken);

		setRow(
			$list,
			"gh-account",
			values.ghUserLogin
				? `${values.ghUserLogin}${values.ghUserName ? ` · ${values.ghUserName}` : ""}`
				: signedIn
					? strings["github token only"] || "Token set — no profile"
					: strings["not signed in"] || "Not signed in",
		);
		setRow($list, "ghToken", values.ghToken ? "••••••••" : "");
		setRow($list, "gh-repos", values.ghRepo || "");
		setRow($list, "gitRemoteUrl", values.gitRemoteUrl || "");
		setRow($list, "ghBranch", values.ghBranch || "main");
		setRow($list, "ghOAuthClientId", values.ghOAuthClientId || "");

		const $signin = $list.get('[data-key="gh-signin"]');
		const $signout = $list.get('[data-key="gh-signout"]');
		if ($signin) $signin.style.display = signedIn ? "none" : "";
		if ($signout) $signout.style.display = signedIn ? "" : "none";
	}

	/**
	 * Sets the visible subtitle of one row.
	 * @param {HTMLElement} $list
	 * @param {string} key
	 * @param {string} text
	 */
	function setRow($list, key, text) {
		const $value = $list.get(`[data-key="${key}"] small.value`);
		if ($value) $value.textContent = text || "";
	}

	/**
	 * Prompt with account actions when a session already exists.
	 */
	async function promptAccountActions() {
		const values = settings.value;
		const choice = await select(strings["github account"] || "GitHub account", [
			[
				"refresh",
				strings["github refresh profile"] || "Refresh profile",
				"account",
			],
			["signout", strings.logout || "Logout", "logout"],
		]);
		if (!choice) return;
		if (choice === "refresh") {
			await fetchProfile(values.ghToken);
		} else {
			await signOut();
		}
	}

	/**
	 * Full device-flow sign in: client id → device code → browser → poll.
	 */
	async function signInDeviceFlow() {
		try {
			let clientId = String(settings.value.ghOAuthClientId || "").trim();

			if (!clientId) {
				const ok = await confirm(
					strings["sign in with github"] || "Sign in with GitHub",
					strings["github sign in steps"] ||
						"Create an OAuth App at github.com/settings/developers, enable 'Device Flow', then paste its client id here. No client secret or backend is needed.",
				);
				if (!ok) return;

				const input = await prompt(
					strings["github client id"] || "OAuth App client id",
					"",
					"text",
				);
				if (!input || !input.trim()) return;

				clientId = input.trim();
				settings.value.ghOAuthClientId = clientId;
				await settings.update();
			}

			const code = await requestDeviceCode(clientId);
			const proceed = await confirm(
				strings["sign in with github"] || "Sign in with GitHub",
				`${strings["device code"] || "Code"}: ${code.userCode}\n\n${
					strings["github device steps"] ||
					"Open the verification page in your browser and enter the code above."
				}`,
			);
			if (!proceed) return;

			system.openInBrowser(code.verificationUri);

			const hide = await loader.show();
			try {
				const { token, user } = await pollForToken(
					clientId,
					code.deviceCode,
					code.interval,
					{ maxMs: code.expiresIn * 1000 },
				);
				saveSession(token, user);
				toast(
					`${strings["signed in as"] || "Signed in as"} ${user?.login || "?"}`,
				);
			} finally {
				hide();
			}
		} catch (error) {
			toast(
				`${strings["sign in failed"] || "Sign in failed"}: ${error.message || error}`,
			);
		}
	}

	/**
	 * Stores token + profile.
	 * @param {string} token
	 * @param {object} user
	 */
	async function saveSession(token, user) {
		settings.value.ghToken = token;
		settings.value.ghUserLogin = user?.login || "";
		settings.value.ghUserName = user?.name || "";
		settings.value.ghUserAvatar = user?.avatarUrl || "";
		await settings.update();
	}

	/**
	 * Fetches and stores the profile for a manually set PAT.
	 * @param {string} token
	 */
	async function fetchProfile(token) {
		if (!token) return;
		try {
			const user = await fetchGhUser(token);
			settings.value.ghUserLogin = user?.login || "";
			settings.value.ghUserName = user?.name || "";
			settings.value.ghUserAvatar = user?.avatarUrl || "";
			await settings.update();
			toast(
				`${strings["signed in as"] || "Signed in as"} ${user?.login || "?"}`,
			);
		} catch (error) {
			toast(
				`${strings["github profile failed"] || "Could not load profile"}: ${error.message || error}`,
			);
		}
	}

	/**
	 * Removes the stored token and profile.
	 */
	async function signOut() {
		settings.value.ghToken = "";
		settings.value.ghUserLogin = "";
		settings.value.ghUserName = "";
		settings.value.ghUserAvatar = "";
		await settings.update();
		toast(strings.logout || "Logout");
	}

	/**
	 * Lists the user's repositories and saves the chosen one as remote.
	 */
	async function pickRepo() {
		const token = String(settings.value.ghToken || "").trim();
		if (!token) {
			toast(
				strings["github token needed"] ||
					"Sign in or set a token to list repositories",
				3000,
			);
			return;
		}

		const hide = await loader.show();
		let repos = [];
		try {
			repos = (await ghGet(REPOS_URL, token)) || [];
		} catch (error) {
			toast(String(error.message || error), 4000);
			return;
		} finally {
			hide();
		}

		if (!Array.isArray(repos) || !repos.length) {
			toast(strings["github no repos"] || "No repositories found", 3000);
			return;
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
		if (!fullName) return;

		const chosen = repos.find((repo) => repo.full_name === fullName);
		if (!chosen) return;

		settings.value.ghRepo = chosen.full_name || "";
		settings.value.gitRemoteUrl =
			chosen.clone_url || `https://github.com/${chosen.full_name}.git`;
		settings.value.ghBranch = chosen.default_branch || "main";
		await settings.update();
		toast(
			`${strings["github repo saved"] || "Repository"}: ${settings.value.ghRepo}`,
			2500,
		);
	}
}
