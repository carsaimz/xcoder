/**
 * XCoder AI providers page — one flexible card per provider.
 *
 * Card layout (full width, wrap_content — no fixed heights):
 *   [icon tile] [name + "active" tag]                 [status chip]
 *               [group badge]
 *   [summary: key owner · max tokens · autonomy]
 *   [actions row: pencil · eye · test · docs · expand]
 *   [advanced (collapsible): max tokens slider + number, autonomy dropdown,
 *    base url, provider note]
 *
 * The action buttons live on a footer row so long provider names keep the
 * full remaining width (no more "Free…" truncation on narrow screens).
 * Tapping the card body selects the provider; per-provider overrides are
 * stored under settings.aiProviderPrefs (key/url/maxTokens/autonomy/status).
 */

import "./aiProviders.scss";
import Page from "components/page";
import toast from "components/toast";
import alert from "dialogs/alert";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import actionStack from "lib/actionStack";
import { listModels } from "lib/ai/client";
import {
	badgeLabel,
	DEFAULT_PROVIDER_ID,
	getProviderPrefs,
	isProviderEnabled,
	keyShapeWarning,
	PROVIDER_MAP,
	PROVIDERS,
	resolveApiKey,
	resolveBaseUrl,
	resolveMaxTokens,
	setProviderEnabled,
	updateProviderPrefs,
} from "lib/ai/providers";
import settings from "lib/settings";
import helpers from "utils/helpers";

const GROUP_ORDER = /** @type {const} */ (["free", "freetier", "premium"]);
const TEST_TIMEOUT = 8000;

const AUTONOMY_COLORS = /** @type {const} */ ({
	ask: "#4CAF50",
	safe: "#FFC107",
	auto: "#F44336",
});

/**
 * Opens the AI providers management page.
 * @returns {HTMLElement} the page element
 */
export default function aiProviders() {
	const title = strings["ai providers"] || "Providers";
	const $page = Page(title);
	$page.classList.add("ai-providers-page");

	const $list = <div className="ai-providers-list" />;

	const $empty = (
		<div className="ai-pempty">
			<span className="icon search" />
			<span>{strings["ai providers empty"] || "No providers found"}</span>
		</div>
	);

	$page.body = (
		<div className="ai-providers">
			<div className="ai-psearch" role="search">
				<span className="icon search" />
				<input
					type="search"
					placeholder={strings["ai providers search"] || "Search providers"}
					oninput={onSearchInput}
				/>
			</div>
			<p className="ai-providers-hint">
				{strings["ai providers hint"] ||
					"Tap a card to use the provider. The power icon enables or disables it. Pencil sets its key, eye checks it, arrow tests the connection and launch opens the docs. Advanced settings live under the chevron."}
			</p>
			{$list}
			{$empty}
		</div>
	);

	/** @type {Map<string, () => void>} providerId -> rerender card fn */
	const rerender = new Map();
	/** @type {{el: HTMLElement, cards: HTMLElement[]}[]} group refs for filtering */
	const groupEls = [];

	/**
	 * Filters cards by the search box (name or id, case/diacritic loose).
	 * @param {InputEvent} e
	 */
	function onSearchInput(e) {
		const query = e.target.value.trim().toLowerCase();
		let visible = 0;
		for (const group of groupEls) {
			let groupVisible = 0;
			for (const $card of group.cards) {
				const haystack = `${$card.dataset.name} ${$card.dataset.provider}`;
				const match = !query || haystack.includes(query);
				$card.style.display = match ? "" : "none";
				if (match) groupVisible++;
			}
			group.el.style.display = groupVisible ? "" : "none";
			visible += groupVisible;
		}
		$empty.style.display = visible ? "none" : "flex";
	}

	/**
	 * Builds one provider card.
	 * @param {object} provider entry from PROVIDERS
	 */
	function buildCard(provider) {
		const id = provider.id;
		const $card = (
			<div
				className="ai-pcard"
				data-provider={id}
				data-name={provider.name.toLowerCase()}
			/>
		);

		const render = () => {
			const prefs = getProviderPrefs(id);
			const active = (settings.value.aiProvider || DEFAULT_PROVIDER_ID) === id;
			const enabled = isProviderEnabled(id);
			const keyOwner = prefs.apiKey
				? "own"
				: settings.value.aiApiKey
					? "global"
					: "none";
			// keyless providers: no key is EXPECTED, not a warning
			const noKeyNeeded =
				Boolean(provider.noKeyRequired) && keyOwner === "none";
			const autonomy = prefs.autonomy || settings.value.aiAutonomy || "safe";
			const maxTokens = resolveMaxTokens(id);
			const status = prefs.status || "idle";
			const baseUrl = prefs.baseUrl || "";

			$card.dataset.active = String(active);
			$card.dataset.enabled = String(enabled);
			$card.dataset.expanded = $card.dataset.expanded || "false";
			$card.dataset.nokey = String(keyOwner === "none" && !noKeyNeeded);

			const $chip = (
				<span className={`ai-pchip is-${!enabled ? "off" : status}`}>
					{!enabled
						? strings["ai provider off"] || "Off"
						: status === "connected"
							? strings["ai provider connected"] || "Connected"
							: status === "offline"
								? strings["ai provider offline"] || "Offline"
								: status === "testing"
									? strings["ai provider testing"] || "Testing..."
									: strings["ai provider untested"] || "Not tested"}
				</span>
			);

			// warn when the key in use looks like it belongs to another
			// provider (gsk_… key on the Gemini card etc.) — the top cause
			// of "falha de autenticação"
			const keyWarn = keyShapeWarning(id, resolveApiKey(id));

			const $summary = (
				<div className="ai-psummary">
					<span
						className={`ai-psummary-item is-key${keyOwner === "none" && !noKeyNeeded ? " warn" : ""}`}
					>
						<span className="icon vpn_key" />
						{keyOwner === "own"
							? strings["ai provider key own"] || "Own key"
							: keyOwner === "global"
								? strings["ai provider key global"] || "Global key"
								: noKeyNeeded
									? strings["ai provider key free"] || "No key needed ✓"
									: strings["ai provider key none"] || "No key"}
					</span>
					<span className="ai-psummary-item">
						{strings["ai max tokens"] || "Max tokens"}: {maxTokens}
					</span>
					<span className="ai-psummary-item">
						<span
							className="ai-pdot"
							style={`background:${AUTONOMY_COLORS[autonomy] || "#FFC107"}`}
						/>
						{autonomyLabel(autonomy)}
					</span>
				</div>
			);

			const $keyWarn = keyWarn ? (
				<div className="ai-pkeywarn" role="alert">
					{keyWarn}
				</div>
			) : null;

			// ---- advanced (collapsible) section ----------------------------
			const effectiveTokens = maxTokens;
			const $num = (
				<input
					type="number"
					className="ai-pnum"
					min={256}
					max={8192}
					step={128}
					value={effectiveTokens}
					onchange={(e) => {
						const value = clampTokens(e.target.value, effectiveTokens);
						e.target.value = String(value);
						const $range = $card.get("input[type=range]");
						if ($range) $range.value = String(value);
						updateProviderPrefs(id, { maxTokens: value })
							.then(() => toast(`${strings.saved || "Saved"}: ${value}`, 1200))
							.catch((error) => helpers.error(error));
					}}
				/>
			);
			const $range = (
				<input
					type="range"
					className="ai-pslider"
					min={256}
					max={8192}
					step={128}
					value={effectiveTokens}
					oninput={(e) => {
						$num.value = e.target.value;
					}}
					onchange={(e) => {
						const value = clampTokens(e.target.value, effectiveTokens);
						updateProviderPrefs(id, { maxTokens: value }).catch((error) =>
							helpers.error(error),
						);
					}}
				/>
			);

			const $baseUrl = (
				<div className="ai-prow" role="button" onclick={editBaseUrl}>
					<span className="ai-prow-label">Base URL</span>
					<span className="ai-prow-value">
						{baseUrl ||
							strings["ai provider url default"] ||
							"Provider default"}
					</span>
					<span className="icon edit ai-prow-ico" />
				</div>
			);

			const $adv = (
				<div className="ai-padv">
					<div className="ai-padv-row">
						<span className="ai-padv-label">
							{strings["ai max tokens"] || "Max tokens"}
						</span>
						{$range}
						{$num}
					</div>
					<div className="ai-padv-row" role="button" onclick={chooseAutonomy}>
						<span className="ai-padv-label">
							{strings["ai autonomy"] || "Autonomy"}
						</span>
						<span className="ai-padv-value">
							<span
								className="ai-pdot"
								style={`background:${AUTONOMY_COLORS[autonomy] || "#FFC107"}`}
							/>
							{autonomyLabel(autonomy)}
						</span>
						<span className="icon expand_more ai-prow-ico" />
					</div>
					{$baseUrl}
					{provider.note && <p className="ai-padv-note">{provider.note}</p>}
				</div>
			);

			$card.content = (
				<>
					<div className="ai-pcard-head">
						<div
							className="ai-pcard-main"
							role="button"
							onclick={selectProvider}
						>
							<span className={`ai-picon g-${provider.group}`}>
								{provider.name.charAt(0).toUpperCase()}
							</span>
							<div className="ai-pcard-text">
								<div className="ai-pname">
									{provider.name}
									{active && (
										<span className="ai-pactive">
											<span className="icon check" />
											{strings["ai provider active"] || "Active"}
										</span>
									)}
								</div>
								<span className={`ai-pbadge g-${provider.group}`}>
									{badgeLabel(provider.group)}
								</span>
							</div>
						</div>
						{$chip}
					</div>
					{$summary}
					{$keyWarn}
					<div className="ai-pactions">
						<button
							className={`ai-pbtn power${enabled ? " on" : ""}`}
							title={
								enabled
									? strings["ai provider disable"] || "Disable provider"
									: strings["ai provider enable"] || "Enable provider"
							}
							onclick={toggleEnabled}
						>
							<span className="icon power_settings_new" />
						</button>
						<button
							className={`ai-pbtn edit${keyOwner === "own" ? " ownkey" : ""}`}
							title={strings["ai api key"] || "API key"}
							onclick={editKey}
						>
							<span className="icon edit" />
						</button>
						<button
							className="ai-pbtn eye"
							title={strings["ai provider view key"] || "View key"}
							onclick={viewKey}
						>
							<span className="icon visibility" />
						</button>
						<button
							className="ai-pbtn test"
							title={strings["ai provider test"] || "Test connection"}
							onclick={() => runTest(id, $card, render)}
						>
							<span className="icon play_arrow" />
						</button>
						{provider.docs && (
							<button
								className="ai-pbtn docs"
								title={strings["ai provider docs"] || "Get API key"}
								onclick={() => openDocs(provider)}
							>
								<span className="icon launch" />
							</button>
						)}
						<button
							className="ai-pbtn toggle"
							title={strings.advanced || "Advanced"}
							onclick={toggleAdvanced}
						>
							<span className="icon expand_more" />
						</button>
					</div>
					{$adv}
				</>
			);

			function selectProvider() {
				if ((settings.value.aiProvider || DEFAULT_PROVIDER_ID) === id) return;
				if (!isProviderEnabled(id)) {
					// tapping a disabled card enables it first
					setProviderEnabled(id, true)
						.then(() =>
							settings.update({ aiProvider: id, aiModel: "" }).then(() => {
								toast(
									`${provider.name}: ${strings["ai provider enabled toast"] || "enabled"}`,
									1800,
								);
								rerenderAll();
							}),
						)
						.catch((error) => helpers.error(error));
					return;
				}
				settings
					.update({ aiProvider: id, aiModel: "" })
					.then(() => {
						toast(provider.name, 1600);
						rerenderAll();
					})
					.catch((error) => helpers.error(error));
			}

			function toggleEnabled() {
				const next = !isProviderEnabled(id);
				setProviderEnabled(id, next)
					.then(() => {
						if (
							!next &&
							(settings.value.aiProvider || DEFAULT_PROVIDER_ID) === id
						) {
							// cannot keep a disabled provider selected
							const fallback = PROVIDERS.find(
								(candidate) =>
									candidate.id !== id && isProviderEnabled(candidate.id),
							);
							return settings
								.update({
									aiProvider: fallback?.id || "",
									aiModel: "",
								})
								.then(() => {
									toast(
										`${provider.name}: ${strings["ai provider disabled toast"] || "disabled"}`,
										1800,
									);
								});
						}
						toast(
							`${provider.name}: ${
								next
									? strings["ai provider enabled toast"] || "enabled"
									: strings["ai provider disabled toast"] || "disabled"
							}`,
							1800,
						);
						return undefined;
					})
					.then(() => {
						render();
					})
					.catch((error) => helpers.error(error));
			}

			function toggleAdvanced() {
				$card.dataset.expanded =
					$card.dataset.expanded === "true" ? "false" : "true";
			}

			async function editKey() {
				const value = await prompt(
					`${strings["ai api key"] || "API key"} — ${provider.name}`,
					"",
					"text",
					{
						required: false,
					},
				);
				if (value === null) return;
				const key = String(value).trim();
				await updateProviderPrefs(id, { apiKey: key || undefined });
				toast(
					key
						? strings["ai provider key saved"] || "API key saved"
						: strings["ai provider key cleared"] ||
								"Key cleared — using global",
				);
				render();
			}

			async function viewKey() {
				const key = resolveApiKey(id);
				if (!key) {
					toast(
						strings["ai provider key none"] ||
							"No key — get one at the provider docs",
					);
					openDocs(provider);
					return;
				}
				const masked = key.slice(0, 8) + "•".repeat(12) + ` (${key.length})`;
				const current = getProviderPrefs(id);
				if (current.apiKey) {
					await alert(provider.name, masked);
				} else {
					toast(
						`${strings["ai provider key global"] || "Global key"}: ${masked}`,
						4000,
					);
				}
			}

			async function chooseAutonomy() {
				const choice = await select(strings["ai autonomy"] || "Autonomy", [
					["ask", autonomyLabel("ask"), "ask"],
					["safe", autonomyLabel("safe"), "safe"],
					["auto", autonomyLabel("auto"), "auto"],
				]);
				if (!choice) return;
				await updateProviderPrefs(id, { autonomy: choice });
				render();
			}

			async function editBaseUrl() {
				const value = await prompt("Base URL", baseUrl || "", "text", {
					required: false,
				});
				if (value === null) return;
				const url = String(value).trim().replace(/\/+$/, "");
				await updateProviderPrefs(id, { baseUrl: url || undefined });
				render();
			}
		};

		rerender.set(id, render);
		render();
		return $card;
	}

	/** Re-renders every card (provider selection changed). */
	function rerenderAll() {
		for (const render of rerender.values()) render();
	}

	// ---- build sections per group ------------------------------------------
	for (const group of GROUP_ORDER) {
		const providers = PROVIDERS.filter((p) => p.group === group);
		if (!providers.length) continue;

		const $cards = (
			<div className="ai-pgroup-cards">
				{providers.map((provider) => buildCard(provider))}
			</div>
		);
		const $group = (
			<div className="ai-pgroup">
				<div className="ai-pgroup-title">{groupTitle(group)}</div>
				{$cards}
			</div>
		);
		groupEls.push({ el: $group, cards: [...$cards.children] });
		$list.append($group);
	}

	actionStack.push({
		id: "ai-providers",
		action: $page.hide,
	});

	$page.onhide = function () {
		actionStack.remove("ai-providers");
	};

	app.append($page);

	return $page;

	// ---- helpers ------------------------------------------------------------

	/**
	 * @param {string} group
	 */
	function groupTitle(group) {
		if (group === "free") return strings["ai badge free"] || "Free";
		if (group === "freetier")
			return strings["ai badge freetier"] || "Free tier";
		return strings["ai badge premium"] || "Premium";
	}

	/**
	 * @param {string} value
	 * @param {number} fallback
	 */
	function clampTokens(value, fallback) {
		const num = Number.parseInt(value, 10);
		if (!Number.isFinite(num)) return fallback;
		return Math.max(256, Math.min(8192, Math.round(num / 128) * 128));
	}

	/**
	 * Localized autonomy label (Baixa / Média / Alta).
	 * @param {string} autonomy
	 */
	function autonomyLabel(autonomy) {
		if (autonomy === "ask") return strings["ai autonomy low"] || "Baixa";
		if (autonomy === "auto") return strings["ai autonomy high"] || "Alta";
		return strings["ai autonomy medium"] || "Média";
	}

	/**
	 * Opens the provider docs (where the user gets an API key).
	 * @param {object} provider
	 */
	function openDocs(provider) {
		if (!provider.docs) return;
		try {
			system.openInBrowser(provider.docs);
		} catch (error) {
			helpers.error(error);
		}
	}

	/**
	 * Runs the connection test for a provider card.
	 * @param {string} providerId
	 * @param {HTMLElement} $cardEl
	 * @param {() => void} render
	 */
	async function runTest(providerId, $cardEl, render) {
		if ($cardEl.dataset.testing === "true") return;
		const provider = PROVIDER_MAP[providerId];

		if (!resolveApiKey(providerId)) {
			toast(strings["ai provider key needed"] || "Add an API key first", 2500);
			return;
		}

		const $chip = $cardEl.get(".ai-pchip");
		if ($chip) {
			$chip.className = "ai-pchip is-testing";
			$chip.textContent = strings["ai provider testing"] || "Testing...";
		}
		$cardEl.dataset.testing = "true";
		let ok = false;
		/** @type {string} the real provider answer (status + body) on failure */
		let failReason = "";
		try {
			// strict: true makes HTTP errors (401 bad key, 404 wrong base
			// url, 429 quota...) THROW instead of resolving to [] — the
			// test used to always report "Connected".
			const models = await Promise.race([
				listModels({
					baseURL: resolveBaseURLFor(provider, providerId),
					apiKey: resolveApiKey(providerId),
					providerId,
					strict: true,
				}),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error("timeout")), TEST_TIMEOUT),
				),
			]);
			ok = Array.isArray(models);
		} catch (error) {
			ok = false;
			failReason = String(error?.message || error).slice(0, 140);
		}
		await updateProviderPrefs(providerId, {
			status: ok ? "connected" : "offline",
			testedAt: Date.now(),
		});
		delete $cardEl.dataset.testing;
		render();
		if (ok) {
			toast(
				`${provider?.name || providerId}: ${strings["ai provider connected"] || "Connected"}`,
				2500,
			);
		} else {
			const warn = keyShapeWarning(providerId, resolveApiKey(providerId));
			const extra = failReason ? ` — ${failReason}` : "";
			toast(
				`${provider?.name || providerId}: ${strings["ai provider offline"] || "Offline"}${extra}${warn ? ` ${warn}` : ""}`,
				4500,
			);
		}
	}

	/**
	 * @param {object} provider
	 * @param {string} providerId
	 */
	function resolveBaseURLFor(provider, providerId) {
		return resolveBaseUrl(providerId) || provider?.baseURL || "";
	}
}
