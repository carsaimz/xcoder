import "./profile.scss";
import Page from "components/page";
import Sidebar from "components/sidebar";
import toast from "components/toast";
import loader from "dialogs/loader";
import actionStack from "lib/actionStack";
import { getPremiumStatus, isPremium, syncCloudPremium } from "lib/premium";
import { showSupportDialog } from "lib/premiumUI";
import supabase, {
	completeOAuthFromPaste,
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
	Sidebar.hide();

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
					<button
						className="profile-action"
						onclick={() => showSupportDialog()}
					>
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
					{OAUTH_PROVIDERS.map((provider) => (
						<button
							key={provider}
							className="profile-action"
							data-oauth-provider={provider}
							onclick={() => onOAuth(provider)}
						>
							<span
								className={`icon ${provider === "google" ? "public" : "code"}`}
							/>
							{provider === "google"
								? t("continue google", "Continuar com Google")
								: t("continue github", "Continuar com GitHub")}
						</button>
					))}
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

	$page.onhide = () => {
		actionStack.remove("profile");
	};
	actionStack.push({
		id: "profile",
		callback: () => {
			$page.hide();
			actionStack.remove("profile");
		},
	});
	$page.show();

	// Hide federated providers that are not enabled in the project —
	// tapping a button that always fails is worse than not showing it.
	updateOAuthAvailability();

	async function refreshPage() {
		const { default: render } = await import("./profile");
		$page.hide();
		render();
	}

	async function updateOAuthAvailability() {
		try {
			const buttons = [...$page.body.querySelectorAll("[data-oauth-provider]")];
			for (const button of buttons) {
				const provider = button.getAttribute("data-oauth-provider");
				if (!(await oauthProviderEnabled(provider))) {
					button.remove();
				}
			}
			if (!$page.body.querySelector("[data-oauth-provider]")) {
				$page.body.querySelector(".profile-divider")?.remove();
			}
		} catch {
			/* availability is best-effort — keep buttons visible */
		}
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
			toast(String(error.message || error), 4000);
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
			toast(String(error.message || error), 4000);
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
