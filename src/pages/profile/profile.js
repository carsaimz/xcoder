import "./profile.scss";
import Page from "components/page";
import Sidebar from "components/sidebar";
import toast from "components/toast";
import loader from "dialogs/loader";
import actionStack from "lib/actionStack";
import logger from "lib/logger";
import { getPremiumStatus, isPremium, syncCloudPremium } from "lib/premium";
import { openSupportPage } from "lib/premiumUI";
import supabase, {
	appHandoffUrl,
	completeOAuthFromPaste,
	ensureFreshSession,
	OAUTH_PROVIDERS,
	oauthProviderEnabled,
	signInWithOAuth,
	supabaseConfigured,
} from "lib/supabase";

/**
 * Profile page — the XCoder account hub: avatar/name, Premium status,
 * sign in (e-mail/password, Google/GitHub) and sign out. Opened from the
 * person icon in the sidebar (launcher, like Settings).
 */

const t = (key, fallback) => strings[key] || fallback;

export default function renderProfile() {
	// Guard the WHOLE render (not only the chunk import): a synchronous
	// error inside the page body used to leave a blank screen and make
	// the sidebar icon feel dead ("Ícone de conta não funciona").
	try {
		// renderProfilePage is async — both the synchronous path and the
		// promise rejection must surface the visible error toast
		Promise.resolve(renderProfilePage()).catch((error) => {
			logger.log(
				"error",
				`Profile page render failed: ${error?.message || error}`,
			);
			toast(
				strings["account page error"] ||
					"Não foi possível abrir a conta — reinicie o app e tente de novo.",
				4000,
			);
		});
	} catch (error) {
		logger.log(
			"error",
			`Profile page render failed: ${error?.message || error}`,
		);
		toast(
			strings["account page error"] ||
				"Não foi possível abrir a conta — reinicie o app e tente de novo.",
			4000,
		);
	}
}

async function renderProfilePage() {
	Sidebar.hide();

	// A stored session whose access token merely expired used to render as
	// "Convidado" until the next successful sign-in. Refresh it lazily —
	// in the BACKGROUND (the page mounts synchronously with the current
	// user) and re-render via the authchange listener when it succeeds.
	ensureFreshSession()
		.then((refreshed) => {
			if (refreshed) document.dispatchEvent(new CustomEvent("authchange"));
		})
		.catch(() => {
			/* offline — render with whatever we have */
		});

	const user = supabase.getUser();
	const premium = isPremium();
	const status = getPremiumStatus();

	const $page = Page(t("profile", "Perfil").capitalize());
	$page.body = (
		<div className="profile-page">
			<section className="profile-card">
				{user?.user_metadata?.avatar_url || user?.photoUrl ? (
					<img
						className="profile-avatar"
						src={user.user_metadata?.avatar_url || user.photoUrl}
						alt=""
					/>
				) : (
					<span className="profile-avatar profile-avatar-fallback icon person" />
				)}
				<div className="profile-identity">
					<p className="profile-name">
						{user?.user_metadata?.display_name ||
							user?.user_metadata?.full_name ||
							user?.email?.split("@")[0] ||
							t("guest", "Convidado")}
					</p>
					<p className="profile-email overflow-wrap">
						{user?.email || t("not signed in", "Sessão não iniciada")}
					</p>
				</div>
				<span className={`profile-badge ${premium ? "is-premium" : ""}`}>
					{premium
						? t("premium active", "Premium ativo")
						: t("free badge", "Grátis")}
				</span>
			</section>

			{premium && status?.expiresAt ? (
				<p className="profile-note">
					{t("premium until", "até")}{" "}
					{new Date(status.expiresAt).toLocaleDateString()}
				</p>
			) : null}

			{user ? (
				<section className="profile-section">
					<button className="profile-action" onclick={() => openSupportPage()}>
						<span className="icon favorite" />
						{t("support the project", "Apoie o XCoder")}
					</button>
					<button className="profile-action is-danger" onclick={onSignOut}>
						<span className="icon logout" />
						{t("sign out", "Terminar sessão")}
					</button>
				</section>
			) : supabaseConfigured() ? (
				<section className="profile-section">
					<p className="profile-hint">
						{t(
							"profile account hint",
							"Use a mesma conta do site — o login é partilhado entre site e app, e doações viram Premium automaticamente.",
						)}
					</p>
					<input
						className="profile-input"
						type="email"
						name="profile-email"
						placeholder={t("email", "E-mail")}
						autoComplete="email"
					/>
					<input
						className="profile-input"
						type="password"
						name="profile-password"
						placeholder={t("password", "Palavra-passe")}
						autoComplete="current-password"
					/>
					<p className="profile-form-error" data-form-error hidden />
					<div className="profile-row">
						<button className="profile-action is-primary" onclick={onSignIn}>
							<span className="icon login" />
							{t("sign in", "Entrar")}
						</button>
						<button className="profile-action" onclick={onSignUp}>
							<span className="icon person_add" />
							{t("sign up", "Criar conta")}
						</button>
					</div>
					<div className="profile-divider">
						<span>{t("or", "ou")}</span>
					</div>
					{/* OAuth buttons render ONLY after the project settings
                                            confirm the providers are active (default-deny) —
                                            no more buttons that flash and always fail. */}
					<div className="profile-oauth" data-oauth-slot />
					<button className="profile-action" onclick={onSiteHandoff}>
						<span className="icon public" />
						{t("continue on site", "Continuar com a conta do site")}
					</button>
					<p className="profile-hint">
						{t(
							"site handoff hint",
							"Se você já entrou no site, o login é concluído aqui automaticamente.",
						)}
					</p>
					<button className="profile-action" onclick={onPasteLink}>
						<span className="icon content_paste" />
						{t("oauth paste", "Já entrei — colar link de retorno")}
					</button>
				</section>
			) : (
				<section className="profile-section">
					<p className="profile-hint">
						{t(
							"account sign in unavailable",
							"A área de conta não está ativa neste dispositivo — configure a Backend URL nas definições ou entre pelo site oficial.",
						)}
					</p>
				</section>
			)}
		</div>
	);

	const onAuthChange = () => {
		// the session arrived via the xcoder://auth/oauth intent (site → app
		// handoff) while this page is open — re-render so the account card
		// stops showing "Convidado" without the user reopening the page
		refreshPage();
	};
	document.addEventListener("authchange", onAuthChange);

	$page.onhide = () => {
		document.removeEventListener("authchange", onAuthChange);
		actionStack.remove("profile");
	};
	actionStack.push({
		id: "profile",
		callback: () => {
			$page.hide();
			actionStack.remove("profile");
		},
	});
	// WCPage has no show() - a page becomes visible when connected to
	// the app root (same as About/Plugins). The old `$page.show()` threw
	// TypeError on every tap and the account page never opened.
	app.append($page);

	// Hide federated providers that are not enabled in the project —
	// tapping a button that always fails is worse than not showing it.
	updateOAuthAvailability();

	return $page;

	async function refreshPage() {
		const { default: render } = await import("./profile");
		$page.hide();
		render();
	}

	/**
	 * Shows a persistent error INSIDE the sign-in form — toasts disappear
	 * and failures used to look like "the form does nothing".
	 * @param {string} message
	 */
	function showFormError(message) {
		const $error = $page.body?.querySelector("[data-form-error]");
		if (!$error) return;
		$error.textContent = message || "";
		$error.hidden = !message;
	}

	async function updateOAuthAvailability() {
		const slot = $page.body?.querySelector("[data-oauth-slot]");
		if (!slot) return;
		let enabled = [];
		try {
			const checks = await Promise.all(
				OAUTH_PROVIDERS.map(async (provider) => ({
					provider,
					enabled: await oauthProviderEnabled(provider),
				})),
			);
			enabled = checks
				.filter((check) => check.enabled)
				.map((check) => check.provider);
		} catch {
			enabled = []; // unreachable settings → hide federated buttons
		}

		const divider = $page.body.querySelector(".profile-divider");
		if (!enabled.length) {
			slot.content = (
				<p className="profile-hint">
					{t(
						"oauth none active",
						"Entrada com Google/GitHub não está ativa neste projeto — use e-mail e palavra-passe ou entre pelo site oficial.",
					)}
				</p>
			);
			divider?.remove();
			return;
		}
		slot.content = enabled.map((provider) => (
			<button
				key={provider}
				className="profile-action"
				data-oauth-provider={provider}
				onclick={() => onOAuth(provider)}
			>
				{brandIcon(provider)}
				{provider === "google"
					? t("continue google", "Continuar com Google")
					: t("continue github", "Continuar com GitHub")}
			</button>
		));
	}

	/** Real brand mark (not a generic glyph) for a federated provider. */
	function brandIcon(provider) {
		const $span = <span className="profile-brandicon" />;
		$span.innerHTML =
			provider === "google"
				? '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"/></svg>'
				: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/></svg>';
		return $span;
	}

	async function onSignIn() {
		const email = $page.body
			.querySelector('input[type="email"]')
			?.value?.trim();
		const password =
			$page.body.querySelector('input[type="password"]')?.value || "";
		if (!email || !password) {
			toast(t("fill email password", "Preencha e-mail e palavra-passe"), 3000);
			return;
		}
		showFormError("");
		const hide = await loader.show(t("signing in", "A entrar…"));
		try {
			await supabase.signInWithPassword(email, password);
			await syncCloudPremium().catch(() => undefined);
			hide();
			toast(t("signed in", "Sessão iniciada ✓"), 3000);
			document.dispatchEvent(new CustomEvent("premiumchange"));
			refreshPage();
		} catch (error) {
			hide();
			showFormError(String(error.message || error));
		}
	}

	async function onSignUp() {
		const email = $page.body
			.querySelector('input[type="email"]')
			?.value?.trim();
		const password =
			$page.body.querySelector('input[type="password"]')?.value || "";
		if (!email || !password) {
			toast(t("fill email password", "Preencha e-mail e palavra-passe"), 3000);
			return;
		}
		showFormError("");
		const hide = await loader.show(t("creating account", "A criar conta…"));
		try {
			const result = await supabase.signUpWithPassword(email, password);
			hide();
			if (result.needsEmailConfirmation) {
				toast(
					t(
						"confirm email",
						"Conta criada! Confirme o e-mail e entre para sincronizar o Premium.",
					),
					5000,
				);
			} else {
				toast(t("account created", "Conta criada ✓"), 3500);
				document.dispatchEvent(new CustomEvent("premiumchange"));
				refreshPage();
			}
		} catch (error) {
			hide();
			showFormError(String(error.message || error));
		}
	}

	async function onOAuth(provider) {
		try {
			if (!(await oauthProviderEnabled(provider))) {
				toast(
					t(
						"provider not configured",
						"O login com {provider} não está configurado neste projeto.",
					).replace(
						"{provider}",
						provider === "google"
							? "Google"
							: provider === "github"
								? "GitHub"
								: provider,
					),
					4000,
				);
				return;
			}
			await signInWithOAuth(provider);
			toast(
				t(
					"oauth browser hint",
					"Conclua o login no navegador — você volta ao app automaticamente",
				),
				6000,
			);
			$page.hide();
		} catch (error) {
			toast(String(error.message || error), 4000);
		}
	}

	async function onSiteHandoff() {
		const url = appHandoffUrl();
		try {
			system.openInBrowser(url);
		} catch {
			window.open(url, "_blank", "noopener");
		}
		toast(
			t(
				"site handoff browser hint",
				"Conclua no navegador — você volta ao app automaticamente",
			),
			6000,
		);
	}

	async function onPasteLink() {
		const ok = await completeOAuthFromPaste();
		if (ok) {
			toast(t("signed in", "Sessão iniciada ✓"), 3000);
			await syncCloudPremium().catch(() => undefined);
			document.dispatchEvent(new CustomEvent("premiumchange"));
			refreshPage();
		} else if (ok === false) {
			// prompt cancelled — do nothing; an invalid link shows nothing too
		}
	}

	async function onSignOut() {
		const { default: confirm } = await import("dialogs/confirm");
		const ok = await confirm(
			t("sign out", "Terminar sessão"),
			t("sign out confirm", "Terminar a sessão nesta conta?"),
		);
		if (!ok) return;
		await supabase.signOut();
		toast(t("signed out", "Sessão terminada"), 2500);
		document.dispatchEvent(new CustomEvent("premiumchange"));
		refreshPage();
	}
}
