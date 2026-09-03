import toast from "components/toast";
import prompt from "dialogs/prompt";
import {
	getPremiumStatus,
	isPremium,
	redeemCode,
	supportInfo,
	syncCloudPremium,
} from "lib/premium";
import supabase from "lib/supabase";
import { swalConfirm } from "lib/sweetalert";

/**
 * UI for the support/premium/account system. Kept apart from
 * lib/premium.js so the logic stays JSX-free (bundlers transform JSX
 * here; unit tests import the logic module directly).
 *
 * The dialog shows:
 *  - the payment methods stored in the project database (served by the
 *    site remote config): URL methods open the browser, account methods
 *    (e.g. M-Pesa number) copy the value — the owner is Mozambican, so
 *    mobile money sits next to PayPal/Stripe/BMC; no Pix anywhere;
 *  - the XCoder account (Supabase auth): signing in is how a donation
 *    becomes Premium automatically — the owner confirms it in the site
 *    /admin and the grant reaches every device with no unlock code;
 *  - the offline unlock code for people who prefer not to create an
 *    account.
 */

const t = (key, fallback) => strings[key] || fallback;

// -------------------------------------------------------------------- ui

/**
 * Opens the "Apoie o XCoder" dialog: payment methods, account sign-in
 * and the premium unlock-code entry. Self-contained so every entry point
 * (settings, ads, agent quota, About) can reuse it.
 * @returns {Promise<void>}
 */
export async function showSupportDialog() {
	const info = supportInfo();
	const premium = isPremium();
	const user = supabase.getUser();

	const $account = renderAccountSection(user, premium);

	const $links = (
		<div className="xcoder-support">
			<p className="xcoder-support-text">
				{premium
					? t(
							"support thanks",
							"Obrigado por apoiar o XCoder! Você tem Premium ativo: sem anúncios, temas exclusivos e agente IA ilimitado.",
						)
					: t(
							"support pitch",
							"O XCoder é gratuito e open source. Doando você ativa o Premium: sem anúncios, temas exclusivos, agente IA ilimitado e badge de apoiador.",
						)}
			</p>
			<div className="xcoder-support-links">
				{info.methods.map((method) => renderMethod(method))}
			</div>
			{$account}
			{premium ? (
				<div className="xcoder-support-status is-active">
					✓ {t("premium active", "Premium ativo")}
					{getPremiumStatus()?.expiresAt
						? ` ${t("premium until", "até")} ${new Date(getPremiumStatus().expiresAt).toLocaleDateString()}`
						: ` — ${t("premium forever", "para sempre")}`}
				</div>
			) : (
				<button
					className="xcoder-support-redeem"
					onclick={async () => {
						const code = await prompt(
							t("premium code", "Código premium"),
							"",
							"text",
							{ required: true },
						);
						if (!code) return;
						try {
							await redeemCode(code);
							toast(
								t("premium activated", "Premium ativado — muito obrigado! ♥"),
								3500,
							);
							document.dispatchEvent(new CustomEvent("premiumchange"));
							$dialog.remove();
						} catch (error) {
							toast(String(error.message || error), 3500);
						}
					}}
				>
					{t("i donated code", "Já doei — inserir código")}
				</button>
			)}
		</div>
	);

	const $dialog = (
		<div className="xcoder-support-overlay" role="dialog">
			<div className="xcoder-support-card">
				<span
					className="icon clearclose xcoder-support-close"
					role="button"
					onclick={() => $dialog.remove()}
				/>
				<h3>{t("support the project", "Apoie o XCoder")}</h3>
				{$links}
			</div>
		</div>
	);

	document.body.append($dialog);
}

/**
 * One payment-method row: URL methods open the browser; account methods
 * copy the value (M-Pesa number, PayPal e-mail, key…).
 * @param {{method: string, label: string, url: string, account: string, accountLabel: string, instructions: string}} method
 */
function renderMethod(method) {
	const copyValue = async () => {
		try {
			await navigator.clipboard.writeText(method.account);
			toast(`${method.accountLabel || method.label}: ${method.account}`, 4000);
			toast(t("copied", "Copiado ✓"), 1500);
		} catch {
			toast(`${method.label}: ${method.account}`, 5000);
		}
	};

	return (
		<div className="xcoder-support-method">
			<button
				className="xcoder-support-link"
				onclick={() => {
					if (method.url) {
						try {
							system.openInBrowser(method.url);
						} catch {
							/* ignore */
						}
					} else if (method.account) {
						copyValue();
					}
				}}
			>
				<span className="xcoder-support-method-label">{method.label}</span>
				<span
					className={`icon ${method.url ? "open_in_browser" : "content_copy"}`}
				/>
			</button>
			{method.account && (
				<button
					className="xcoder-support-copy"
					onclick={copyValue}
					aria-label={t("copy", "Copiar")}
				>
					<span className="icon content_copy" />
					<span>
						{method.accountLabel || t("copy account", "copiar conta")}
					</span>
					<span className="xcoder-support-copy-value">
						{maskAccount(method.account)}
					</span>
				</button>
			)}
			{method.instructions && (
				<p className="xcoder-support-instructions">{method.instructions}</p>
			)}
		</div>
	);
}

/**
 * Shortens an account value for display (keeps first/last 4 chars).
 * @param {string} value
 * @returns {string}
 */
function maskAccount(value) {
	const clean = String(value || "").trim();
	if (clean.length <= 12) return clean;
	return `${clean.slice(0, 8)}…${clean.slice(-4)}`;
}

/**
 * Account (Supabase auth) section: status + sign in/sign up/sign out.
 * Signing in immediately syncs the cloud premium grant.
 * @param {object | null} user current supabase user
 * @param {boolean} premium whether premium is active
 * @returns {HTMLElement}
 */
function renderAccountSection(user, premium) {
	const $section = (
		<div className="xcoder-support-account">
			<div className="xcoder-support-account-head">
				<span className="icon person" />
				<span>
					{user?.email
						? `${t("signed in as", "Sessão:")} ${user.email}`
						: t(
								"account hint",
								"Use a MESMA conta do site oficial — o login é partilhado entre site e app. A doação vira Premium em todos os dispositivos automaticamente.",
							)}
				</span>
			</div>
			{user ? (
				<button
					className="xcoder-support-link"
					onclick={async () => {
						const ok = await swalConfirm(
							t("sign out", "Terminar sessão"),
							t("sign out confirm", "Terminar a sessão nesta conta?"),
							{ icon: "question" },
						);
						if (!ok) return;
						await supabase.signOut();
						toast(t("signed out", "Sessão terminada"), 2500);
						$section.remove();
						document.dispatchEvent(new CustomEvent("premiumchange"));
					}}
				>
					{t("sign out", "Terminar sessão")}
				</button>
			) : (
				<div className="xcoder-support-auth">
					<input
						className="xcoder-support-input"
						type="email"
						name="xcoder-account-email"
						placeholder={t("email", "E-mail")}
						autoComplete="email"
					/>
					<input
						className="xcoder-support-input"
						type="password"
						name="xcoder-account-password"
						placeholder={t("password", "Palavra-passe")}
						autoComplete="current-password"
					/>
					<div className="xcoder-support-auth-row">
						<button
							className="xcoder-support-link is-primary"
							onclick={() => handleAuth($section, true)}
						>
							{t("sign in", "Entrar")}
						</button>
						<button
							className="xcoder-support-link"
							onclick={() => handleAuth($section, false)}
						>
							{t("sign up", "Criar conta")}
						</button>
					</div>
					{!premium && (
						<p className="xcoder-support-instructions">
							{t(
								"account sync hint",
								"Depois de confirmarmos a sua doação, o Premium é ativado sozinho nesta conta.",
							)}
						</p>
					)}
				</div>
			)}
		</div>
	);
	return $section;
}

/**
 * Shared sign-in / sign-up handler.
 * @param {HTMLElement} $section account section to re-render on success
 * @param {boolean} signIn true = sign in, false = create account
 */
async function handleAuth($section, signIn) {
	const $root = $section.querySelector(".xcoder-support-auth");
	const email = $root?.querySelector('input[type="email"]')?.value?.trim();
	const password = $root?.querySelector('input[type="password"]')?.value || "";
	if (!email || !password) {
		toast(t("fill email password", "Preencha e-mail e palavra-passe"), 3000);
		return;
	}
	try {
		if (signIn) {
			await supabase.signInWithPassword(email, password);
			const granted = await syncCloudPremium();
			toast(
				granted
					? t("signed in premium", "Sessão iniciada — Premium sincronizado ♥")
					: t("signed in", "Sessão iniciada ✓"),
				3500,
			);
		} else {
			const result = await supabase.signUpWithPassword(email, password);
			if (result.needsEmailConfirmation) {
				toast(
					t(
						"confirm email",
						"Conta criada! Confirme o e-mail e entre para sincronizar o Premium.",
					),
					5000,
				);
			} else {
				await syncCloudPremium();
				toast(t("account created", "Conta criada ✓"), 3500);
			}
		}
		document.dispatchEvent(new CustomEvent("premiumchange"));
		$section.replaceWith(renderAccountSection(supabase.getUser(), isPremium()));
	} catch (error) {
		toast(String(error.message || error), 4000);
	}
}

// --------------------------------------------------------------- themes

/** App themes reserved for supporters (free users keep every other one). */
export const PREMIUM_THEMES = ["neon", "sunset", "obsidian"];

/**
 * Whether the theme id requires premium.
 * @param {string} id
 */
export function isThemePremium(id) {
	return PREMIUM_THEMES.includes(String(id || "").toLowerCase());
}

/**
 * Whether the user may apply that theme right now.
 * @param {string} id
 */
export function canUseTheme(id) {
	return isPremium() || !isThemePremium(id);
}

export default { showSupportDialog };
