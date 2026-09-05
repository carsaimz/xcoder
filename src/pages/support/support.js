import "./support.scss";
import Page from "components/page";
import Sidebar from "components/sidebar";
import toast from "components/toast";
import prompt from "dialogs/prompt";
import actionStack from "lib/actionStack";
import config from "lib/config";
import {
	getPremiumStatus,
	isPremium,
	redeemCode,
	supportInfo,
} from "lib/premium";
import supabase from "lib/supabase";

/**
 * Support page — a REAL page (no modal/dialog): premium status, payment
 * methods from the project database (URL methods open the browser,
 * account methods copy the value, QR methods show the code) and the
 * offline unlock code. Account sign-in lives in the Profile page
 * (pages/profile) — support never asks for a login.
 */

const t = (key, fallback) => strings[key] || fallback;

export default function renderSupport() {
	Sidebar.hide();

	const premium = isPremium();
	const info = supportInfo();

	const $page = Page(t("support the project", "Apoie o XCoder").capitalize());
	$page.body = (
		<div className="support-page">
			<section className={`support-status ${premium ? "is-premium" : ""}`}>
				<span className="icon favorite" />
				<div className="support-status-text">
					<p className="support-status-title">
						{premium
							? t("premium active", "Premium ativo")
							: t("free badge", "Grátis")}
					</p>
					<p className="support-status-sub">
						{premium
							? getPremiumStatus()?.expiresAt
								? `${t("premium until", "até")} ${new Date(getPremiumStatus().expiresAt).toLocaleDateString()}`
								: t("premium forever", "para sempre")
							: t(
									"support perks",
									"Sem anúncios + limites maiores de IA para apoiadores",
								)}
					</p>
				</div>
			</section>

			<p className="support-pitch">
				{premium
					? t(
							"support thanks",
							"Obrigado por apoiar o XCoder! Você tem Premium ativo: sem anúncios e IA com limites maiores (agente ilimitado, 8k tokens, autonomia total).",
						)
					: t(
							"support pitch",
							"O XCoder é gratuito — TODOS os recursos são livres. Doando você ativa o Premium: remove anúncios, libera os limites de IA (agente ilimitado, 8k tokens, autonomia total) e dá o badge de apoiador.",
						)}
			</p>

			<section className="support-section">
				<p className="support-section-title">
					{t("payment methods", "Formas de pagamento")}
				</p>
				<div className="support-methods">
					{info.methods.map((method) => renderMethod(method))}
				</div>
			</section>

			<section className="support-section">
				<button
					className="support-action is-primary"
					onclick={() => openWebsite("/sponsor")}
				>
					<span className="icon favorite" />
					{t("become sponsor", "Quero patrocinar — abrir no site")}
				</button>
				{!premium && (
					<button className="support-action" onclick={onRedeem}>
						<span className="icon redeem" />
						{t("i donated code", "Já doei — inserir código")}
					</button>
				)}
				{!supabase.getUser() && (
					<button className="support-action" onclick={openAccount}>
						<span className="icon person" />
						{t("go to account", "Entrar na minha conta")}
					</button>
				)}
			</section>
		</div>
	);

	$page.onhide = () => {
		actionStack.remove("support");
	};
	actionStack.push({
		id: "support",
		callback: () => {
			$page.hide();
			actionStack.remove("support");
		},
	});
	$page.show();

	function openWebsite(path) {
		const url = `${String(config.WEBSITE_URL || "").replace(/\/+$/, "")}${path}`;
		try {
			system.openInBrowser(url);
		} catch {
			window.open(url, "_blank", "noopener");
		}
	}

	function openAccount() {
		import(/* webpackChunkName: "profile" */ "pages/profile/profile")
			.then(({ default: profile }) => {
				$page.hide();
				profile();
			})
			.catch((error) => {
				logger.log("error", `Profile page failed: ${error?.message || error}`);
				toast(
					strings["account page error"] || "Não foi possível abrir a conta.",
					4000,
				);
			});
	}

	async function onRedeem() {
		const code = await prompt(t("premium code", "Código premium"), "", "text", {
			required: true,
		});
		if (!code) return;
		try {
			await redeemCode(code);
			toast(
				t("premium activated", "Premium ativado — muito obrigado! ♥"),
				3500,
			);
			document.dispatchEvent(new CustomEvent("premiumchange"));
			// re-render so the status card flips to Premium
			$page.hide();
			import(/* webpackChunkName: "support" */ "./support").then((res) =>
				res.default(),
			);
		} catch (error) {
			toast(String(error.message || error), 3500);
		}
	}
}

/**
 * One payment-method row: URL methods open the browser; account methods
 * copy the value (M-Pesa number, PayPal e-mail…); QR methods show the
 * code image so the donor can pay and register the donation.
 * @param {{method: string, label: string, url: string, account: string, accountLabel: string, instructions: string, qr_image_url?: string}} method
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
		<div className="support-method">
			<button
				className="support-method-main"
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
				<span className="support-method-label">{method.label}</span>
				<span
					className={`icon ${method.url ? "open_in_browser" : "content_copy"}`}
				/>
			</button>
			{method.account && (
				<button className="support-method-copy" onclick={copyValue}>
					<span className="icon content_copy" />
					<span>
						{method.accountLabel || t("copy account", "copiar conta")}
					</span>
					<span className="support-method-value">
						{maskAccount(method.account)}
					</span>
				</button>
			)}
			{method.instructions && (
				<p className="support-method-instructions">{method.instructions}</p>
			)}
			{method.qr_image_url && (
				<img
					className="support-method-qr"
					src={method.qr_image_url}
					alt={`${method.label} QR`}
					loading="lazy"
				/>
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
