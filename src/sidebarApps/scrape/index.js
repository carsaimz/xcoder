import "./style.scss";
import fsOperation from "fileSystem";
import toast from "components/toast";
import prompt from "dialogs/prompt";
import { defaultDownloadDir, startDownload } from "lib/downloadManager";
import { fetchRenderedHtml } from "lib/webInspector";
import {
	beautifyCode,
	extractAssets,
	extractMeta,
	findEndpoints,
	findSecrets,
	guessLanguage,
	httpFetch,
} from "lib/webScraper";
import { copyText } from "utils/clipboard";
import Url from "utils/Url";

/**
 * Web Scraper sidebar app — baixa o código-fonte de qualquer site
 * (bruto ou renderizado), lista e descarrega recursos (imagens, JS, CSS,
 * fontes, media) e inclui um painel de engenharia reversa: metadados,
 * segredos/credenciais no código e endpoints de API.
 */

const t = (key, fallback) => strings[key] || fallback;

/** @type {HTMLElement|null} */
let container = null;
/** @type {HTMLInputElement|null} */
let $url = null;
/** @type {HTMLElement|null} */
let $status = null;
/** @type {HTMLElement|null} */
let $source = null;
/** @type {HTMLElement|null} */
let $assets = null;
/** @type {HTMLElement|null} */
let $analysis = null;
/** @type {HTMLElement|null} */
let $sourceBadge = null;
/** @type {HTMLElement|null} */
let $assetsBadge = null;
/** @type {HTMLElement|null} */
let $analysisBadge = null;

/** @type {{text: string, url: string, mode: string, title: string}|null} */
let source = null;
/** @type {ReturnType<typeof extractAssets>|null} */
let assets = null;
/** @type {Array<any>} */
let secrets = [];
/** @type {ReturnType<typeof findEndpoints>|null} */
let endpoints = null;
/** @type {{title: string, description: string, generator: string, viewport: string, lang: string, canonical: string, openGraph: Array<[string, string]>}|null} */
let meta = null;
let assetsFilter = "all";
/** @type {Set<string>} selected asset urls */
const selectedAssets = new Set();

function initApp(el) {
	container = el;
	el.classList.add("scr-app");
	el.content = buildUi();

	const onLangChange = () => {};
	document.addEventListener("langchange", onLangChange);

	return () => {
		document.removeEventListener("langchange", onLangChange);
		container = null;
		$url = null;
		$status = null;
		$source = null;
		$assets = null;
		$analysis = null;
		$sourceBadge = null;
		$assetsBadge = null;
		$analysisBadge = null;
	};
}

function buildUi() {
	$url = (
		<input
			type="url"
			className="scr-url"
			placeholder="https://exemplo.com"
			enterKeyHint="go"
			spellcheck={false}
			onkeydown={(e) => {
				if (e.key === "Enter") fetchSource("raw");
			}}
		/>
	);

	$status = (
		<div className="scr-status">
			{t("scraper idle", "Introduza um endereço para capturar")}
		</div>
	);

	const $tabs = (
		<div className="scr-tabs">
			<button
				type="button"
				className="scr-tab active"
				data-tab="source"
				onclick={() => switchTab("source")}
			>
				<span className="icon codicon-file-code" />
				{t("scraper source", "Código")}
				<span className="ins-badge hidden" ref={(el) => ($sourceBadge = el)} />
			</button>
			<button
				type="button"
				className="scr-tab"
				data-tab="assets"
				onclick={() => switchTab("assets")}
			>
				<span className="icon codicon-desktop-download" />
				{t("scraper assets", "Recursos")}
				<span className="ins-badge hidden" ref={(el) => ($assetsBadge = el)} />
			</button>
			<button
				type="button"
				className="scr-tab"
				data-tab="analysis"
				onclick={() => switchTab("analysis")}
			>
				<span className="icon codicon-search" />
				{t("scraper analysis", "Análise")}
				<span
					className="ins-badge hidden"
					ref={(el) => ($analysisBadge = el)}
				/>
			</button>
		</div>
	);

	const $sourcePanel = (
		<div className="scr-panel" data-panel="source">
			<div className="scr-actions">
				<button type="button" onclick={() => saveSource()}>
					<span className="icon codicon-save" />
					{t("scraper save", "Guardar")}
				</button>
				<button type="button" onclick={() => openInEditor()}>
					<span className="icon codicon-export" />
					{t("scraper open editor", "No editor")}
				</button>
				<button type="button" onclick={() => beautify()}>
					<span className="icon codicon-wand" />
					{t("scraper beautify", "Embelezar")}
				</button>
				<button type="button" onclick={() => source && copyText(source.text)}>
					<span className="icon codicon-copy" />
					{t("scraper copy", "Copiar")}
				</button>
			</div>
			<pre className="scr-source scroll" ref={(el) => ($source = el)} />
		</div>
	);

	const $assetsPanel = (
		<div className="scr-panel hidden" data-panel="assets">
			<div className="scr-panel-toolbar">
				<div className="ins-chips">
					{["all", "img", "js", "css", "font", "media"].map((chip) => (
						<button
							type="button"
							className={`ins-chip${chip === "all" ? " active" : ""}`}
							data-chip={chip}
							onclick={() => setAssetsFilter(chip)}
						>
							{assetChipLabel(chip)}
						</button>
					))}
				</div>
			</div>
			<div className="scr-asset-actions">
				<button type="button" onclick={() => downloadSelected()}>
					<span className="icon codicon-cloud-download" />
					{t("scraper download selected", "Descarregar seleccionados")}
				</button>
				<button type="button" onclick={() => downloadAllImages()}>
					<span className="icon codicon-file-media" />
					{t("scraper download images", "Todas as imagens")}
				</button>
			</div>
			<div className="scr-assets scroll" ref={(el) => ($assets = el)} />
		</div>
	);

	const $analysisPanel = (
		<div className="scr-panel hidden" data-panel="analysis">
			<div className="scr-analysis scroll" ref={(el) => ($analysis = el)} />
		</div>
	);

	return (
		<div className="scr-app-body">
			<div className="scr-urlbar">
				{$url}
				<span
					className="icon codicon-file-code"
					title={t("scraper fetch raw", "Código-fonte bruto")}
					onclick={() => fetchSource("raw")}
				/>
				<span
					className="icon codicon-browser"
					title={t("scraper fetch rendered", "Página renderizada")}
					onclick={() => fetchSource("rendered")}
				/>
			</div>
			{$status}
			{$tabs}
			{$sourcePanel}
			{$assetsPanel}
			{$analysisPanel}
		</div>
	);
}

// ------------------------------------------------------------------ fetch

/** @param {"raw"|"rendered"} mode */
async function fetchSource(mode) {
	const target = $url?.value?.trim();
	if (!target) {
		toast(t("scraper invalid url", "Endereço inválido"), 2000);
		return;
	}
	const url = /^(https?:\/\/)/i.test(target) ? target : `https://${target}`;
	if ($url) $url.value = url;

	setStatus(
		mode === "raw"
			? t("scraper fetching raw", "A obter código-fonte…")
			: t("scraper fetching rendered", "A renderizar página…"),
	);

	try {
		let text = "";
		let finalUrl = url;
		let title = "";
		if (mode === "raw") {
			text = String(await httpFetch(url));
		} else {
			const result = await fetchRenderedHtml(url);
			text = result.html;
			finalUrl = result.url;
			title = result.title;
		}

		source = { text, url: finalUrl, mode, title };
		analyse();
		renderSource();
		renderAssets();
		renderAnalysis();
		const lines = String(text).split("\n").length;
		setStatus(
			`${lines} ${t("scraper lines", "linhas")} • ${(text.length / 1024).toFixed(0)} KB • ${
				mode === "raw"
					? t("scraper mode raw", "bruto")
					: t("scraper mode rendered", "renderizado")
			}`,
		);
	} catch (error) {
		setStatus(`${t("scraper failed", "Falhou")}: ${error?.message || error}`);
		toast(`${t("scraper failed", "Falhou")}: ${error?.message || error}`, 3000);
	}
}

function analyse() {
	if (!source) return;
	const base = source.url;
	assets = extractAssets(source.text, base);
	meta = extractMeta(source.text);
	secrets = findSecrets(source.text);
	endpoints = findEndpoints(source.text);
	selectedAssets.clear();
	updateBadges();
}

function updateBadges() {
	if ($sourceBadge) {
		$sourceBadge.textContent = source ? "1" : "";
		$sourceBadge.classList.toggle("hidden", !source);
	}
	if ($assetsBadge) {
		$assetsBadge.textContent = assets?.all.length
			? String(assets.all.length)
			: "";
		$assetsBadge.classList.toggle("hidden", !assets?.all.length);
	}
	if ($analysisBadge) {
		$analysisBadge.textContent = secrets.length ? String(secrets.length) : "";
		$analysisBadge.classList.toggle("hidden", !secrets.length);
	}
}

function setStatus(text) {
	if ($status) $status.textContent = text;
}

// ------------------------------------------------------------------- tabs

/** @param {string} tab */
function switchTab(tab) {
	container?.querySelectorAll(".scr-tab").forEach(($el) => {
		$el.classList.toggle("active", $el.dataset.tab === tab);
	});
	container?.querySelectorAll(".scr-panel").forEach(($el) => {
		$el.classList.toggle("hidden", $el.dataset.panel !== tab);
	});
}

// ----------------------------------------------------------------- source

function renderSource() {
	if (!$source) return;
	$source.innerHTML = "";
	if (!source) {
		$source.append(
			<div className="ins-empty">
				{t(
					"scraper empty source",
					"Sem código capturado. Use os botões da barra de endereço: «bruto» (HTTP) ou «renderizado» (browser).",
				)}
			</div>,
		);
		return;
	}
	// cap the preview — full source is copyable/saveable anyway
	const MAX = 120000;
	$source.textContent =
		source.text.length > MAX
			? `${source.text.slice(0, MAX)}\n\n… ${t("scraper truncated", "truncado na pré-visualização — usar Copiar/Guardar para o código completo")}`
			: source.text;
}

/** Default save directory for a host. @param {string} url */
function hostDir(url) {
	const host = (() => {
		try {
			return new URL(url).host.replace(/[^\w.-]/g, "_");
		} catch {
			return "site";
		}
	})();
	return Url.join(defaultDownloadDir(), host);
}

async function saveSource() {
	if (!source) return;
	const dir = hostDir(source.url);
	const name =
		source.mode === "rendered" ? "index-rendered.html" : "index.html";
	const defaultPath = Url.join(dir, name);
	const path = await prompt(
		t("scraper save as", "Guardar como"),
		defaultPath,
		"text",
	);
	if (!path) return;
	try {
		const dirFs = fsOperation(Url.dirname(path));
		if (!(await dirFs.exists())) {
			await fsOperation(Url.dirname(Url.dirname(path))).createDirectory(
				Url.basename(Url.dirname(path)),
			);
		}
		const fs = fsOperation(path);
		if (await fs.exists()) {
			await fs.writeFile(source.text);
		} else {
			await dirFs.createFile(Url.basename(path), source.text);
		}
		toast(`${t("scraper saved", "Guardado")}: ${path}`, 2500);
	} catch (error) {
		toast(String(error?.message || error), 3000);
	}
}

async function openInEditor() {
	if (!source) return;
	try {
		const dir = hostDir(source.url);
		const name =
			source.mode === "rendered" ? "index-rendered.html" : "index.html";
		const path = Url.join(dir, name);
		const dirFs = fsOperation(dir);
		if (!(await dirFs.exists())) {
			await fsOperation(Url.dirname(dir)).createDirectory(Url.basename(dir));
		}
		const fs = fsOperation(path);
		if (await fs.exists()) {
			await fs.writeFile(source.text);
		} else {
			await dirFs.createFile(name, source.text);
		}
		const { default: openFile } = await import("lib/openFile");
		await openFile(path, { render: true });
	} catch (error) {
		toast(String(error?.message || error), 3000);
	}
}

async function beautify() {
	if (!source) return;
	setStatus(t("scraper beautifying", "A embelezar…"));
	try {
		const lang = guessLanguage(source.url, source.text);
		source.text = await beautifyCode(source.text, lang);
		renderSource();
		setStatus(`${t("scraper beautified", "Embelezado")} (${lang})`);
	} catch (error) {
		setStatus(
			`${t("scraper beautify failed", "Embelezar falhou")}: ${error?.message || error}`,
		);
	}
}

// ----------------------------------------------------------------- assets

function assetChipLabel(chip) {
	const map = {
		all: t("scraper assets all", "Todos"),
		img: t("scraper assets img", "Imagens"),
		js: "JS",
		css: "CSS",
		font: t("scraper assets font", "Fontes"),
		media: t("scraper assets media", "Media"),
	};
	return map[chip] || chip;
}

/** @param {string} chip */
function setAssetsFilter(chip) {
	assetsFilter = chip;
	container?.querySelectorAll(".scr-tab, .ins-chip").forEach(($el) => {
		if ($el.dataset.chip) {
			$el.classList.toggle("active", $el.dataset.chip === chip);
		}
	});
	renderAssets();
}

function renderAssets() {
	if (!$assets) return;
	$assets.innerHTML = "";

	if (!assets?.all.length) {
		$assets.append(
			<div className="ins-empty">
				{t(
					"scraper empty assets",
					"Sem recursos. Capture primeiro o código de um site.",
				)}
			</div>,
		);
		return;
	}

	const rows =
		assetsFilter === "all"
			? assets.all
			: assets.all.filter((asset) => asset.type === assetsFilter);

	for (const asset of rows) {
		$assets.append(
			<div
				className={`scr-asset-row${selectedAssets.has(asset.url) ? " selected" : ""}`}
				onclick={() => {
					if (selectedAssets.has(asset.url)) selectedAssets.delete(asset.url);
					else selectedAssets.add(asset.url);
					renderAssets();
				}}
			>
				<span
					className={`icon codicon-${selectedAssets.has(asset.url) ? "check" : "blank"}`}
				/>
				<span className={`scr-asset-type type-${asset.type}`}>
					{asset.type}
				</span>
				<span className="scr-asset-name">{asset.name}</span>
				<span
					className="icon codicon-cloud-download scr-asset-dl"
					title={t("scraper download one", "Descarregar")}
					onclick={(e) => {
						e.stopPropagation();
						downloadAssets([asset.url]);
					}}
				/>
			</div>,
		);
	}
}

/** @param {string[]} urls */
function downloadAssets(urls) {
	if (!source || !urls.length) return;
	const dir = hostDir(source.url);
	for (const url of urls) {
		startDownload({ url, dir });
	}
	toast(
		`${t("scraper downloading", "A descarregar")} ${urls.length} → ${dir}`,
		3000,
	);
}

function downloadSelected() {
	downloadAssets(Array.from(selectedAssets));
}

function downloadAllImages() {
	if (!assets) return;
	downloadAssets(assets.images.map((asset) => asset.url));
}

// --------------------------------------------------------------- analysis

function renderAnalysis() {
	if (!$analysis) return;
	$analysis.innerHTML = "";

	if (!source) {
		$analysis.append(
			<div className="ins-empty">
				{t(
					"scraper empty analysis",
					"Análise de engenharia reversa: capture um site primeiro.",
				)}
			</div>,
		);
		return;
	}

	// --- meta ------------------------------------------------------------
	if (meta) {
		$analysis.append(
			<div className="scr-analysis-card">
				<div className="scr-analysis-title">
					<span className="icon codicon-info" />
					{t("scraper meta", "Metadados")}
				</div>
				<div className="scr-meta-row" onclick={() => copyText(meta.title)}>
					<span className="scr-meta-key">title</span>
					<span className="scr-meta-value">{meta.title || "—"}</span>
				</div>
				{meta.description ? (
					<div
						className="scr-meta-row"
						onclick={() => copyText(meta.description)}
					>
						<span className="scr-meta-key">description</span>
						<span className="scr-meta-value">
							{meta.description.slice(0, 160)}
						</span>
					</div>
				) : null}
				{meta.generator ? (
					<div
						className="scr-meta-row"
						onclick={() => copyText(meta.generator)}
					>
						<span className="scr-meta-key">generator</span>
						<span className="scr-meta-value">{meta.generator}</span>
					</div>
				) : null}
				{meta.lang ? (
					<div className="scr-meta-row" onclick={() => copyText(meta.lang)}>
						<span className="scr-meta-key">lang</span>
						<span className="scr-meta-value">{meta.lang}</span>
					</div>
				) : null}
				{meta.canonical ? (
					<div
						className="scr-meta-row"
						onclick={() => copyText(meta.canonical)}
					>
						<span className="scr-meta-key">canonical</span>
						<span className="scr-meta-value">{meta.canonical}</span>
					</div>
				) : null}
				{meta.openGraph.length ? (
					<details open>
						<summary>Open Graph ({meta.openGraph.length})</summary>
						{meta.openGraph.slice(0, 12).map(([key, value]) => (
							<div className="scr-meta-row" onclick={() => copyText(value)}>
								<span className="scr-meta-key">{key}</span>
								<span className="scr-meta-value">
									{String(value).slice(0, 120)}
								</span>
							</div>
						))}
					</details>
				) : null}
			</div>,
		);
	}

	// --- secrets -----------------------------------------------------------
	$analysis.append(
		<div className="scr-analysis-card">
			<div className="scr-analysis-title">
				<span className="icon codicon-shield" />
				{t("scraper secrets", "Segredos encontrados")} ({secrets.length})
			</div>
			{secrets.length ? (
				secrets.slice(0, 60).map((secret) => (
					<div
						className={`scr-secret kind-${secret.kind}`}
						onclick={() => copyText(secret.value)}
					>
						<span className="scr-secret-kind">{secret.kind}</span>
						<span className="scr-secret-value">
							{secret.masked}{" "}
							<span className="scr-secret-line">
								{t("scraper line", "linha")} {secret.line}
							</span>
						</span>
						<span className="scr-secret-context">
							{secret.context.slice(0, 120)}
						</span>
					</div>
				))
			) : (
				<div className="ins-empty">
					{t("scraper no secrets", "Nenhum segredo detectado")}
				</div>
			)}
		</div>,
	);

	// --- endpoints -----------------------------------------------------------
	if (endpoints) {
		$analysis.append(
			<div className="scr-analysis-card">
				<div className="scr-analysis-title">
					<span className="icon codicon-remote" />
					{t("scraper endpoints", "Endpoints de API")} (
					{endpoints.apiPaths.length})
				</div>
				{endpoints.apiPaths.length ? (
					endpoints.apiPaths.slice(0, 60).map((endpoint) => (
						<div
							className="scr-endpoint"
							onclick={() => copyText(endpoint.value)}
						>
							<span className="scr-endpoint-value">{endpoint.value}</span>
							<span className="scr-secret-line">
								{t("scraper line", "linha")} {endpoint.line}
							</span>
						</div>
					))
				) : (
					<div className="ins-empty">
						{t("scraper no endpoints", "Nenhum endpoint /api/ detectado")}
					</div>
				)}
				<details>
					<summary>
						{t("scraper urls", "URLs absolutos")} ({endpoints.urls.length})
					</summary>
					{endpoints.urls.slice(0, 80).map((endpoint) => (
						<div
							className="scr-endpoint"
							onclick={() => copyText(endpoint.value)}
						>
							<span className="scr-endpoint-value">
								{endpoint.value.slice(0, 100)}
							</span>
						</div>
					))}
				</details>
			</div>,
		);
	}
}

/**
 * Opens the scraper at `url` — used by the native preview screen's
 * "Scrape" menu and by intents (xcoder_tool extras).
 * @param {string} url
 * @param {"raw"|"rendered"} [mode]
 */
export async function openScraperWith(url, mode = "raw") {
	if (!$url) return;
	$url.value = url;
	await fetchSource(mode);
}

export default [
	"cod:cloud-download",
	"scrapeApp",
	strings["scraper"] || "Scraper",
	initApp,
	false,
	() => {},
	{ titleKey: "scraper", group: "tools", floating: true },
];
