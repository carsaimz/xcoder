import "./style.scss";
import config from "lib/config";

/**
 * Website sidebar app — an in-app webview (iframe) that opens the
 * official XCoder site (config.WEBSITE_URL) directly inside the editor.
 *
 * The Cordova webview already allows https navigation (the
 * "allow-navigation" entries in config.xml), so the site loads embedded:
 * docs, marketplace, sponsor page and account area all stay in the app
 * with no context switch. A compact toolbar offers reload, back and
 * "open in system browser".
 */

const t = (key, fallback) => strings[key] || fallback;

/** @type {HTMLElement|null} */
let $iframe = null;
/** @type {HTMLElement|null} */
let $error = null;
/** @type {HTMLElement|null} */
let $loading = null;
/** @type {HTMLElement|null} */
let $address = null;
/** @type {number|null} */
let errorTimer = null;

function siteUrl(path = "") {
	const base = String(config.WEBSITE_URL || "").replace(/\/+$/, "");
	return `${base}${path}`;
}

/** Reloads the embedded site (busting the webview cache). */
function reload() {
	if (!$iframe) return;
	$error.style.display = "none";
	$loading.style.display = "flex";
	// reassign the src — the cache-buster avoids a stale webview snapshot
	$iframe.src = `${siteUrl()}?xcoder=${Date.now()}`;
}

/** Navigates one step back inside the embedded webview. */
function goBack() {
	try {
		$iframe?.contentWindow?.history?.back();
	} catch {
		/* cross-origin frame refusing access — ignore */
	}
}

/** Opens the site in the system browser (custom tabs). */
function openExternal() {
	try {
		system.openInBrowser(siteUrl());
	} catch {
		window.open(siteUrl(), "_blank", "noopener");
	}
}

function buildUi() {
	$loading = (
		<div className="web-loading">
			<span className="spinner" />
		</div>
	);
	$error = (
		<div className="web-error" style={{ display: "none" }}>
			<span className="icon wifi_off" />
			<p>
				{t(
					"website offline",
					"Sem conexão — verifique a internet e tente de novo.",
				)}
			</p>
			<button
				className="web-retry"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					reload();
				}}
			>
				{t("retry", "Tentar novamente")}
			</button>
		</div>
	);

	$iframe = (
		<iframe
			className="web-frame"
			src={siteUrl()}
			title="XCoder website"
			referrerPolicy="no-referrer-when-downgrade"
			/* the official site is ours — scripts needed; rest is locked */
			sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
			onload={() => {
				if ($loading) $loading.style.display = "none";
			}}
			onerror={() => {
				if ($error) $error.style.display = "flex";
			}}
		/>
	);

	$address = (
		<span className="web-address">{siteUrl().replace(/^https?:\/\//, "")}</span>
	);

	// network failures inside iframes often surface as a blank frame — a
	// timeout flips the spinner into the offline card when navigator
	// already knows we are offline
	errorTimer = setTimeout(() => {
		if ($loading?.style.display !== "none" && navigator.onLine === false) {
			$loading.style.display = "none";
			$error.style.display = "flex";
		}
	}, 8000);

	return (
		<div className="web-app">
			<div className="web-header">
				<span
					className="icon arrow_back web-act"
					role="button"
					aria-label={t("back", "Voltar")}
					onclick={goBack}
				/>
				{$address}
				<span
					className="icon refresh web-act"
					role="button"
					aria-label={t("reload", "Recarregar")}
					onclick={reload}
				/>
				<span
					className="icon open_in_browser web-act"
					role="button"
					aria-label={t("open external", "Abrir no navegador")}
					onclick={openExternal}
				/>
			</div>
			<div className="web-body">
				{$iframe}
				{$loading}
				{$error}
			</div>
		</div>
	);
}

function retranslate() {
	if ($address) {
		$address.textContent = siteUrl().replace(/^https?:\/\//, "");
	}
	if ($error) {
		const $text = $error.get("p");
		if ($text) {
			$text.textContent = t(
				"website offline",
				"Sem conexão — verifique a internet e tente de novo.",
			);
		}
		const $retry = $error.get(".web-retry");
		if ($retry) $retry.textContent = t("retry", "Tentar novamente");
	}
}

/**
 * @param {HTMLElement} el container provided by the sidebar
 */
function initApp(el) {
	el.classList.add("website-app");
	el.content = buildUi();

	const onLangChange = () => retranslate();
	document.addEventListener("langchange", onLangChange);

	return () => {
		document.removeEventListener("langchange", onLangChange);
		clearTimeout(errorTimer);
		$iframe = null;
		$error = null;
		$loading = null;
		$address = null;
	};
}

function onSelected() {
	// (re)load the site only when the panel is actually opened
	if ($iframe && !$iframe.getAttribute("src")) {
		$iframe.src = siteUrl();
	}
}

export default [
	"svg:globe",
	"websiteApp",
	strings["website"] || "Website",
	initApp,
	false,
	onSelected,
	{ titleKey: "website" },
];
