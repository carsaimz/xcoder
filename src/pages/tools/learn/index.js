import "./style.scss";
import toast from "components/toast";
import { embeddingPolicy } from "lib/techDetect";
import { httpFetchDetailed } from "lib/webScraper";
import webviewApi from "lib/webview";
import LEARN_SITES from "res/learn-sites.json";
import { openToolPage } from "../toolPage";

/**
 * Learn sidebar app — «opções de sites principais para aprender qualquer
 * linguagem ou ferramentas de programação». A curated catalog of study
 * sites (MDN, W3Schools, freeCodeCamp, javascript.info…) that opens each
 * one in an internal WebView: embedded iframe inside the floating window
 * when the site allows framing, native fullscreen WebView otherwise.
 */

const t = (key, fallback) => strings[key] || fallback;

const CATEGORY_ORDER = [
	"general",
	"htmlcss",
	"js",
	"python",
	"jvm",
	"clang",
	"git",
	"backend",
	"practice",
	"data",
	"devops",
];

/** @type {HTMLElement|null} */
let container = null;
/** @type {HTMLInputElement|null} */
let $search = null;
/** @type {HTMLElement|null} */
let $list = null;
/** @type {HTMLElement|null} */
let $catalog = null;
/** @type {HTMLElement|null} */
let $viewer = null;
/** @type {HTMLElement|null} */
let $title = null;
/** @type {HTMLElement|null} */
let $status = null;
/** @type {HTMLElement|null} */
let $iframe = null;
/** @type {HTMLElement|null} */
let $blocked = null;
/** @type {HTMLElement|null} */
let $chips = null;
let activeFilter = "all";
let filterText = "";
/** @type {{name: string, url: string}|null} */
let currentSite = null;
/** @type {import("lib/webview").default|null} */
let nativeSession = null;

function initApp(el) {
	container = el;
	el.classList.add("lrn-app");
	el.content = buildUi();
	const onLangChange = () => renderCatalog();
	document.addEventListener("langchange", onLangChange);
	return () => {
		document.removeEventListener("langchange", onLangChange);
		destroyNative();
		container = null;
		$search = null;
		$list = null;
		$catalog = null;
		$viewer = null;
		$title = null;
		$status = null;
		$iframe = null;
		$blocked = null;
		$chips = null;
		currentSite = null;
	};
}

function categoryLabel(cat) {
	return strings[`learn cat ${cat}`] || cat;
}

function buildUi() {
	$search = (
		<input
			type="search"
			className="lrn-search"
			placeholder={t("learn search", "Procurar sites…")}
			enterKeyHint="search"
			spellcheck={false}
			oninput={() => {
				filterText = String($search?.value || "").toLowerCase();
				renderCatalog();
			}}
		/>
	);

	$list = <div className="lrn-list scroll" />;
	$chips = <div className="lrn-chips" />;

	$catalog = (
		<div className="lrn-catalog" data-view="catalog">
			<div className="lrn-head">
				<p className="lrn-intro">
					{t(
						"learn intro",
						"Estude e consulte qualquer linguagem ou ferramenta — cada site abre na WebView interna.",
					)}
				</p>
				{$search}
				{$chips}
			</div>
			{$list}
		</div>
	);

	$iframe = (
		<iframe
			className="lrn-frame"
			title="learn viewer"
			referrerPolicy="no-referrer-when-downgrade"
			sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
			onload={() => {
				if ($status && currentSite) {
					$status.style.display = "none";
				}
			}}
		/>
	);

	$status = (
		<div className="lrn-loading">
			<span className="spinner" />
		</div>
	);

	$blocked = (
		<div className="lrn-blocked" style={{ display: "none" }}>
			<span className="icon codicon-shield" />
			<p>{t("learn blocked", "Este site não permite ser incorporado.")}</p>
			<button type="button" data-role="native" onclick={() => openNative()}>
				<span className="icon codicon-screen-full" />
				{t("learn native", "Abrir na WebView interna")}
			</button>
		</div>
	);

	$viewer = (
		<div className="lrn-viewer" data-view="viewer">
			<div className="lrn-toolbar">
				<span
					className="icon codicon-arrow-left lrn-act"
					role="button"
					aria-label={t("learn back", "Voltar")}
					onclick={showCatalog}
				/>
				<span className="lrn-title" ref={(el) => ($title = el)} />
				<span
					className="icon codicon-refresh lrn-act"
					role="button"
					aria-label={t("reload", "Recarregar")}
					onclick={() => reloadSite()}
				/>
				<span
					className="icon codicon-screen-full lrn-act"
					role="button"
					aria-label={t("learn native", "Abrir na WebView interna")}
					onclick={() => openNative()}
				/>
				<span
					className="icon codicon-open-preview lrn-act"
					role="button"
					aria-label={t("open external", "Abrir no navegador")}
					onclick={() => openExternal()}
				/>
			</div>
			<div className="lrn-body">
				{$iframe}
				{$status}
				{$blocked}
			</div>
		</div>
	);

	renderCatalog();

	return (
		<div className="scr-app-body">
			{$catalog}
			{$viewer}
		</div>
	);
}

function renderCatalog() {
	if (!$chips || !$list) return;

	// category chips
	const chips = ["all", ...CATEGORY_ORDER];
	$chips.replaceChildren(
		...chips.map((cat) => (
			<button
				type="button"
				className={`lrn-chip${cat === activeFilter ? " active" : ""}`}
				data-chip={cat}
				onclick={() => {
					activeFilter = cat;
					renderCatalog();
				}}
			>
				{cat === "all" ? t("learn all", "Todos") : categoryLabel(cat)}
			</button>
		)),
	);

	// filtered list
	const sites = LEARN_SITES.filter((site) => {
		const matchesCat = activeFilter === "all" || site.cat === activeFilter;
		const text = `${site.name} ${site.desc}`.toLowerCase();
		return matchesCat && (!filterText || text.includes(filterText));
	});
	const grouped = new Map();
	for (const site of sites) {
		const list = grouped.get(site.cat) || [];
		list.push(site);
		grouped.set(site.cat, list);
	}

	const groups = CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map((cat) => (
		<section className="lrn-group">
			<h3>{categoryLabel(cat)}</h3>
			{grouped.get(cat).map((site) => (
				<button
					type="button"
					className="lrn-site"
					data-url={site.url}
					onclick={() => openSite(site)}
				>
					<span className="lrn-site-text">
						<span className="lrn-site-name">{site.name}</span>
						<span className="lrn-site-desc">{site.desc}</span>
					</span>
					<span className="icon codicon-chevron-right" />
				</button>
			))}
		</section>
	));

	$list.replaceChildren(
		...(groups.length
			? groups
			: [
					<p className="lrn-empty">
						{t("learn empty", "Nenhum site encontrado.")}
					</p>,
				]),
	);
}

function showCatalog() {
	if ($catalog) $catalog.classList.remove("hidden");
	if ($viewer) $viewer.classList.add("hidden");
	if ($iframe) $iframe.src = "about:blank";
	currentSite = null;
	destroyNative();
}

function showViewer(site) {
	currentSite = site;
	if ($catalog) $catalog.classList.add("hidden");
	if ($viewer) $viewer.classList.remove("hidden");
	if ($title) $title.textContent = site.name;
	if ($blocked) $blocked.style.display = "none";
	if ($status) $status.style.display = "flex";
}

function reloadSite() {
	if (!currentSite) return;
	if (nativeSession) {
		nativeSession.reload().catch(() => {});
		return;
	}
	if ($blocked) $blocked.style.display = "none";
	if ($status) $status.style.display = "flex";
	if ($iframe && currentSite) {
		$iframe.src = `${currentSite.url}${currentSite.url.includes("?") ? "&" : "?"}xcoder=${Date.now()}`;
	}
}

/** Opens the site in the embedded iframe — internal floating WebView. */
async function openSite(site) {
	showViewer(site);
	if (!$iframe) return;
	$iframe.src = "about:blank";

	// best-effort framing probe: the native HTTP client reads response
	// headers without CORS; desktop fetch may be opaque (probe fails →
	// we still try the iframe)
	let policy = { blocked: false, reason: "" };
	try {
		const response = await httpFetchDetailed(site.url, { timeoutMs: 12000 });
		policy = embeddingPolicy(response.headers);
	} catch {
		/* probe failed — attempt the iframe anyway */
	}
	if (!currentSite || currentSite.url !== site.url) return;

	if (policy.blocked) {
		// the site refuses embedding — go straight to the native viewer
		showBlocked(site);
		openNative();
		return;
	}
	$iframe.src = site.url;
	// if the frame errors silently the spinner would sit forever — a
	// timeout flips it into the blocked card with the native option
	setTimeout(() => {
		if ($status?.style.display !== "none" && navigator.onLine === false) {
			showBlocked(site);
		}
	}, 8000);
}

function showBlocked(site) {
	if ($status) $status.style.display = "none";
	if ($blocked) $blocked.style.display = "flex";
	if ($iframe) $iframe.src = "about:blank";
	toast(
		`${site.name}: ${t(
			"learn blocked short",
			"não permite incorporação — aberto na WebView interna",
		)}`,
		3500,
	);
}

/**
 * Opens the site in the native fullscreen WebView — the real internal
 * browser view (no X-Frame-Options limits there).
 */
async function openNative() {
	if (!currentSite || typeof cordova === "undefined") {
		if (currentSite) openExternal();
		return;
	}
	try {
		destroyNative();
		nativeSession = await webviewApi.create({
			mode: "fullscreen",
			title: currentSite.name,
			allowNavigation: true,
			allowDownloads: true,
		});
		nativeSession.on("closed", () => {
			nativeSession = null;
		});
		await nativeSession.loadURL(currentSite.url);
	} catch (error) {
		// native webview unavailable (e.g. desktop) — system browser
		console.error(error);
		openExternal();
	}
}

function destroyNative() {
	if (nativeSession) {
		const session = nativeSession;
		nativeSession = null;
		session.destroy().catch(() => {});
	}
}

function openExternal() {
	if (!currentSite) return;
	try {
		system.openInBrowser(currentSite.url);
	} catch {
		window.open(currentSite.url, "_blank", "noopener");
	}
}

/**
 * Opens the catalog at a specific site — entry point for future deep
 * links (e.g. handing a URL from other tools).
 * @param {string} url
 */
export async function openLearnWith(url) {
	openLearnPage();
	const site = LEARN_SITES.find((entry) => entry.url === url);
	if (site) await openSite(site);
}
/**
 * Opens the tool as an independent full-screen page (fora da
 * sidebar e da janela flutuante) — results always visible.
 * @returns {HTMLElement} the page element
 */
export function openLearnPage() {
	return openToolPage({
		id: "learn-page",
		titleKey: "learn",
		title: "Learn",
		className: "lrn-app",
		build: initApp,
		onHide: destroyNative,
	});
}
