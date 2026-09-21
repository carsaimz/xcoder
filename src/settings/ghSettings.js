import settingsPage from "components/settingsPage";
import toast from "components/toast";
import select from "dialogs/select";
import { looksLikeGhToken, normalizeGhToken } from "lib/ghAuth";
import { refreshGhProfile, signInGitHubFlow } from "lib/ghSignIn";
import settings from "lib/settings";
import "./gh-settings.scss";

/**
 * XCoder GitHub settings — account (PAT or the official device-flow
 * sign in) plus the remote URL/branch rows. Repository LISTING moved to
 * the Git sidebar app (and the AI chat) — that is where repos are used.
 */

/**
 * Opens the GitHub configuration page.
 */
export default function ghSettings() {
	const title = strings["github settings"] || "GitHub";

	const page = settingsPage(title, buildItems(), handleCallback, "united", {
		// detail-settings-page activates the shared themed settings
		// shell (background, rows, buttons, info tips); the extra
		// gh-settings-page class only scopes the hero card styles.
		pageClassName: "detail-settings-page gh-settings-page",
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
					"Sign in with your GitHub account or a personal access token (PAT).",
				chevron: true,
			},
			{
				key: "gh-signin",
				text: strings["sign in with github"] || "Sign in with GitHub",
				button: "primary",
				info:
					strings["settings-info-gh-signin"] ||
					"Sign in with your GitHub account (device flow with the official app client) or paste a personal access token (PAT). No client setup required.",
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
					await signInGitHubFlow();
				}
				refresh();
				break;
			}

			case "gh-signin":
				await signInGitHubFlow();
				refresh();
				break;

			case "gh-signout":
				await signOut();
				refresh();
				break;

			case "ghToken": {
				// The settings kit does NOT persist prompt values — it only
				// updates the row and calls this callback. Persist here
				// (v1.6.1 and earlier silently dropped the pasted PAT, so
				// repositories never listed and no account ever appeared).
				if (typeof value === "string") {
					const token = normalizeGhToken(value);
					if (token !== settings.value.ghToken) {
						if (!token) {
							// token cleared — drop the whole GitHub session
							await signOut();
							refresh();
							break;
						}
						if (!looksLikeGhToken(token)) {
							toast(
								strings["github pat shape"] ||
									"O token não parece um PAT do GitHub (ghp_… / github_pat_…) — vamos tentar mesmo assim.",
								4000,
							);
						}
						settings.value.ghToken = token;
						await settings.update();
					}
				}
				if (settings.value.ghToken && !settings.value.ghUserLogin) {
					// shared flow: validates the token, saves the profile and
					// reports a friendly 401 hint when the token is bad
					await refreshGhProfile();
				}
				refresh();
				break;
			}

			case "gitRemoteUrl":
			case "ghBranch":
				// persisted here too — the kit does not persist prompts
				if (typeof value === "string") {
					const trimmed = value.trim();
					if (trimmed !== settings.value[key]) {
						settings.value[key] = trimmed;
						await settings.update();
					}
				}
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
		setRow($list, "gitRemoteUrl", values.gitRemoteUrl || "");
		setRow($list, "ghBranch", values.ghBranch || "main");

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
			await refreshGhProfile();
		} else {
			await signOut();
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
}
