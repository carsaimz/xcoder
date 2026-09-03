import toast from "components/toast";
import prompt from "dialogs/prompt";
import {
	getPremiumStatus,
	isPremium,
	redeemCode,
	supportInfo,
} from "lib/premium";

/**
 * UI for the support/premium system. Kept apart from lib/premium.js so
 * the logic stays JSX-free (bundlers transform JSX here; unit tests import
 * the logic module directly).
 */

// -------------------------------------------------------------------- ui

/**
 * Opens the "Apoie o XCoder" dialog: donation links, Pix (when the site
 * provides a key) and the premium unlock-code entry. Self-contained so
 * every entry point (settings, ads, agent quota, About) can reuse it.
 * @returns {Promise<void>}
 */
export async function showSupportDialog() {
	const info = supportInfo();
	const premium = isPremium();

	const $links = (
		<div className="xcoder-support">
			<p className="xcoder-support-text">
				{premium
					? "Obrigado por apoiar o XCoder! Você tem Premium ativo: sem anúncios, temas exclusivos e agente IA ilimitado."
					: "O XCoder é gratuito e open source. Doando você ativa o Premium: sem anúncios, temas exclusivos, agente IA ilimitado e badge de apoiador."}
			</p>
			<div className="xcoder-support-links">
				{info.links.map((link) => (
					<button
						className="xcoder-support-link"
						onclick={() => {
							try {
								system.openInBrowser(link.url);
							} catch {
								/* ignore */
							}
						}}
					>
						{link.label}
					</button>
				))}
				{info.pixKey && (
					<button
						className="xcoder-support-link"
						onclick={async () => {
							try {
								await navigator.clipboard.writeText(info.pixKey);
								toast("Chave Pix copiada ✓", 2000);
							} catch {
								toast(`Pix: ${info.pixKey}`, 4000);
							}
						}}
					>
						Pix (copiar chave)
					</button>
				)}
			</div>
			{premium ? (
				<div className="xcoder-support-status is-active">
					✓ Premium ativo
					{getPremiumStatus()?.expiresAt
						? ` até ${new Date(getPremiumStatus().expiresAt).toLocaleDateString()}`
						: " — para sempre"}
				</div>
			) : (
				<button
					className="xcoder-support-redeem"
					onclick={async () => {
						const code = await prompt("Código premium", "", "text", {
							required: true,
						});
						if (!code) return;
						try {
							await redeemCode(code);
							toast("Premium ativado — muito obrigado! ♥", 3500);
							document.dispatchEvent(new CustomEvent("premiumchange"));
							$dialog.remove();
						} catch (error) {
							toast(String(error.message || error), 3500);
						}
					}}
				>
					Já doei — inserir código
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
				<h3>Apoie o XCoder</h3>
				{$links}
			</div>
		</div>
	);

	document.body.append($dialog);
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
