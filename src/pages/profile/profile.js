import "./profile.scss";
import Page from "components/page";
import Sidebar from "components/sidebar";
import toast from "components/toast";
import actionStack from "lib/actionStack";
import logger from "lib/logger";
import { getPremiumStatus, isPremium, syncCloudPremium } from "lib/premium";
import { openSupportPage } from "lib/premiumUI";
import supabase, {
	appHandoffUrl,
	completeOAuthFromPaste,
	ensureFreshSession,
	supabaseConfigured,
} from "lib/supabase";

/**
 * Profile page — the XCoder account hub: avatar/name, Premium status,
 * sign in (SITE-ONLY handoff: the app never asks for credentials itself)
 * and sign out. Opened from the person icon in the sidebar (launcher,
 * like Settings).
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

	// Capture the body element in a local reference. WCPage's body setter
	// replaces the internal .main container with this element, and the
	// body getter only resolves elements matching ".main"/"main" — which
	// this div is not (that is why it also needs the main/scroll classes
	// below, same pattern as the About page). Reading the page body
	// property afterwards returned null and every interaction touching it
	// (Entrar/Criar conta) died on a silent TypeError.
	const $body = (
		<div className="profile-page main scroll">
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
							"O login acontece apenas no site oficial — toque no botão abaixo, entre com a sua conta (e-mail, Google ou GitHub) e você volta automaticamente para o app. A conta é a mesma do site, e doações viram Premium automaticamente.",
						)}
					</p>
					{/* Site-only sign-in (user request: login NEVER inside the
                                            app) — the site handles every provider and hands the
                                            session back through the xcoder://auth/oauth intent. */}
					<button className="profile-action is-primary" onclick={onSiteHandoff}>
						<span className="icon public" />
						{t("continue on site", "Entrar pelo site")}
					</button>
					<p className="profile-hint">
						{t(
							"site handoff hint",
							"Se o app não reabrir sozinho depois do login, use o botão abaixo para colar o link de retorno.",
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
	$page.body = $body;

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
		// `action` is the key actionStack.pop() invokes — `callback`
		// is silently ignored, so the hardware back button used to
		// throw ("fun.action is not a function") and strand the page
		action: () => {
			$page.hide();
			actionStack.remove("profile");
		},
	});
	// WCPage has no show() - a page becomes visible when connected to
	// the app root (same as About/Plugins). The old `$page.show()` threw
	// TypeError on every tap and the account page never opened.
	app.append($page);

	return $page;

	async function refreshPage() {
		const { default: render } = await import("./profile");
		$page.hide();
		render();
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
		try {
			await supabase.signOut();
		} catch (error) {
			// signOut is best-effort — a network failure must never
			// leave the button feeling dead ("não aceita sair")
			logger.log("error", `signOut failed: ${error?.message || error}`);
		}
		toast(t("signed out", "Sessão terminada"), 2500);
		document.dispatchEvent(new CustomEvent("premiumchange"));
		refreshPage();
	}
}
