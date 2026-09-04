import toast from "components/toast";
import { addIntentHandler, removeIntentHandler } from "handlers/intent";
import { syncCloudPremium } from "lib/premium";
import supabase, { applyOAuthTokens, fetchProfile } from "lib/supabase";

/**
 * OAuth return handler — the community site redirects back into the app
 * with `xcoder://auth/oauth#access_token=…&refresh_token=…`. This module
 * completes the sign-in (stores the session, fetches the profile, syncs
 * the cloud Premium grant). Registered once at boot in main.js.
 */
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
