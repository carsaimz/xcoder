import toast from "components/toast";
import { addIntentHandler, removeIntentHandler } from "handlers/intent";
import { fetchGhUser, normalizeGhToken } from "lib/ghAuth";
import { saveGhSession } from "lib/ghSignIn";
import { syncCloudPremium } from "lib/premium";
import settings from "lib/settings";
import supabase, {
	applyOAuthTokens,
	fetchProfile,
	getSession,
} from "lib/supabase";

/**
 * OAuth return handler — the community site redirects back into the app
 * with `xcoder://auth/oauth#access_token=…&refresh_token=…`. This module
 * completes the sign-in (stores the session, fetches the profile, syncs
 * the cloud Premium grant). Registered once at boot in main.js.
 */

/**
 * VS Code-style one-login bridge: when the site sign-in used the GitHub
 * provider, the fragment carries the user's GitHub OAuth token — store it
 * as the git credential session so the Source Control panel (account
 * card, repositories, push/pull) works WITHOUT a second authorization.
 * Best effort: a failing GitHub profile fetch leaves the previous state
 * untouched (the sign-in buttons remain available).
 */
async function bridgeGitHubFromProvider() {
	try {
		if (settings.value.ghToken) return; // git already connected
		const providerToken = normalizeGhToken(getSession()?.provider_token);
		if (!providerToken) return;
		const user = await fetchGhUser(providerToken).catch(() => null);
		await saveGhSession(providerToken, user);
		toast(
			strings["github linked"] ||
				`GitHub ligado ✓ ${user?.login ? `(@${user.login})` : ""}`.trim(),
			3500,
		);
		// the git panel refreshes itself via the settings "update:ghToken"
		// event fired by saveGhSession()
	} catch (error) {
		window.log?.(
			"warn",
			`GitHub provider bridge failed: ${error?.message || error}`,
		);
	}
}

let handler = null;

export function registerOAuthIntentHandler() {
	if (handler) return;
	handler = (event) => {
		if (event.module !== "auth" || event.action !== "oauth") return;
		event.preventDefault();
		const ok = applyOAuthTokens(event.url);
		if (!ok) {
			toast(
				strings["oauth failed"] || "Não foi possível concluir o login",
				3500,
			);
			return;
		}
		toast(strings["oauth success"] || "Login concluído ✓", 3000);
		bridgeGitHubFromProvider();
		fetchProfile().then(async () => {
			try {
				await syncCloudPremium();
			} catch {
				/* premium sync is best effort */
			}
			document.dispatchEvent(new CustomEvent("premiumchange"));
			supabase.getUser();
		});
	};
	addIntentHandler(handler);
}

export function unregisterOAuthIntentHandler() {
	if (handler) {
		removeIntentHandler(handler);
		handler = null;
	}
}
