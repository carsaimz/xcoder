import "./style.scss";
import fsOperation from "fileSystem";
import toast from "components/toast";
import prompt from "dialogs/prompt";
import {
	defaultDownloadDir,
	downloadUrl,
	ensureDirDeep,
	startDownload,
} from "lib/downloadManager";
import { fetchRenderedHtml } from "lib/webInspector";
import {
	beautifyCode,
	buildReport,
	extractAssets,
	extractLinks,
	extractMeta,
	extractTables,
	findEndpoints,
	findSecrets,
	guessLanguage,
	httpFetch,
	looksMinified,
	seoAudit,
	tableToCsv,
} from "lib/webScraper";
import { copyText } from "utils/clipboard";
import Url from "utils/Url";
import { openToolPage } from "../toolPage";

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
/** @type {HTMLElement|null} */
let $beautifyLabel = null;

/** @type {{text: string, raw: string, url: string, mode: string, title: string, formatted: boolean}|null} */
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
/**
 * Result of every image download of the current capture, keyed by source
 * url — feeds the local gallery so the user SEES the files that landed
 * («não consigo ver as imagens»): thumbnails read from disk, tap opens
 * the image in the editor.
 * @type {Map<string, {path: string, size: number, ok: boolean, error?: string, thumbLoaded?: boolean}>}
 */
const downloadedImages = new Map();
/** @type {HTMLElement|null} */
let $gallery = null;

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
		$gallery = null;
		$analysis = null;
		$sourceBadge = null;
		$assetsBadge = null;
		$analysisBadge = null;
		$beautifyLabel = null;
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
					<span ref={(el) => ($beautifyLabel = el)}>
						{t("scraper beautify", "Embelezar")}
					</span>
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
				<button type="button" onclick={() => selectAllImages()}>
					<span className="icon codicon-check-all" />
					{t("scraper select images", "Selecionar imagens")}
				</button>
				<button
					type="button"
					onclick={() => {
						selectedAssets.clear();
						renderAssets();
					}}
				>
					<span className="icon codicon-clear-all" />
					{t("scraper clear selection", "Limpar seleção")}
				</button>
				<button type="button" onclick={() => downloadSelected()}>
					<span className="icon codicon-cloud-download" />
					{t("scraper download selected", "Descarregar seleccionados")}
				</button>
				<button type="button" onclick={() => downloadAllImages()}>
					<span className="icon codicon-file-media" />
					{t("scraper download images", "Todas as imagens")}
				</button>
			</div>
			<div className="scr-gallery hidden" ref={(el) => ($gallery = el)} />
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

	// clear previous capture so a failed attempt never leaves stale rows
	source = null;
	analyse();
	renderSource();
	renderAssets();
	renderAnalysis();
	updateBadges();
	downloadedImages.clear();
	renderGallery();

	const log = (message) => setStatus(message);

	try {
		let text = "";
		let finalUrl = url;
		let title = "";
		let effectiveMode = mode;

		if (mode === "raw") {
			log(t("scraper fetching raw", "A obter código-fonte…"));
			try {
				text = String(await httpFetch(url));
			} catch (rawError) {
				// raw capture failed (403 / bot-blocked / offline) — try the
				// rendered page so the user still gets content
				log(
					`${t("scraper raw failed", "Bruto falhou")}: ${rawError?.message || rawError} — ${t("scraper trying rendered", "a tentar renderizado…")}`,
				);
				effectiveMode = "rendered";
			}
		}

		if (effectiveMode === "rendered") {
			log(t("scraper fetching rendered", "A renderizar página…"));
			try {
				const result = await fetchRenderedHtml(url, { timeoutMs: 25000 });
				text = result.html;
				finalUrl = result.url;
				title = result.title;
			} catch (renderError) {
				if (mode === "rendered") {
					// user explicitly asked for the rendered page — fall back to
					// the raw source rather than showing nothing
					log(
						`${t("scraper rendered failed", "Renderizado falhou")}: ${renderError?.message || renderError} — ${t("scraper trying raw", "a tentar bruto…")}`,
					);
					text = String(await httpFetch(url));
					effectiveMode = "raw";
				} else {
					throw renderError;
				}
			}
		}

		if (!String(text).trim()) {
			throw new Error(t("scraper empty response", "resposta vazia"));
		}

		source = {
			text,
			raw: text,
			url: finalUrl,
			mode: effectiveMode,
			title,
			formatted: false,
		};
		analyse();
		renderSource();
		renderAssets();
		renderAnalysis();
		updateBeautifyLabel();
		const lines = String(text).split("\n").length;
		setStatus(
			`${lines} ${t("scraper lines", "linhas")} • ${(text.length / 1024).toFixed(0)} KB • ${
				effectiveMode === "raw"
					? t("scraper mode raw", "bruto")
					: t("scraper mode rendered", "renderizado")
			}`,
		);
		// bundled/minified pages read like "código criptografado" — format
		// them automatically. The upgrade runs AFTER a paint delay: awaiting
		// prettier inline blocked the main thread before the captured source
		// was ever painted, so the UI looked stuck on «A obter código-fonte…»
		// with nothing rendered.
		if (looksMinified(source.raw)) {
			setTimeout(() => {
				autoFormat();
			}, 120);
		}
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
		await ensureDirDeep(Url.dirname(path));
		const dirFs = fsOperation(Url.dirname(path));
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

/**
 * Saves one extracted table as a CSV file next to the captured source.
 * @param {{rows: string[][]}} table
 * @param {number} index
 */
async function saveTableCsv(table, index) {
	const dir = source ? hostDir(source.url) : defaultDownloadDir();
	const defaultPath = Url.join(dir, `tabela-${index + 1}.csv`);
	const path = await prompt(
		t("scraper save as", "Guardar como"),
		defaultPath,
		"text",
	);
	if (!path) return;
	try {
		await ensureDirDeep(Url.dirname(path));
		const dirFs = fsOperation(Url.dirname(path));
		const csvFs = fsOperation(path);
		const csv = tableToCsv(table.rows);
		if (await csvFs.exists()) {
			await csvFs.writeFile(csv);
		} else {
			await dirFs.createFile(Url.basename(path), csv);
		}
		toast(`${t("scraper csv saved", "CSV guardado")}: ${path}`, 2500);
	} catch (error) {
		toast(String(error?.message || error), 3000);
	}
}

/**
 * Saves the Markdown reverse-engineering report (SEO + meta + segredos +
 * endpoints + tabelas + links) next to the captured source.
 * @param {{seo: any, tables: any[], links: any}} data
 */
async function saveReport(data) {
	if (!source) return;
	const dir = hostDir(source.url);
	const defaultPath = Url.join(dir, "relatorio.md");
	const path = await prompt(
		t("scraper report save", "Guardar relatório"),
		defaultPath,
		"text",
	);
	if (!path) return;
	try {
		await ensureDirDeep(Url.dirname(path));
		const dirFs = fsOperation(Url.dirname(path));
		const reportFs = fsOperation(path);
		const report = buildReport({
			url: source.url,
			seo: data.seo,
			meta,
			secrets,
			endpoints,
			tables: data.tables,
			links: { ...data.links, total: data.links.links.length },
		});
		if (await reportFs.exists()) {
			await reportFs.writeFile(report);
		} else {
			await dirFs.createFile(Url.basename(path), report);
		}
		toast(`${t("scraper report saved", "Relatório guardado")}: ${path}`, 2500);
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
		await ensureDirDeep(dir);
		const dirFs = fsOperation(dir);
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

/**
 * Formats source.raw with Prettier into source.text (keeps the original
 * bytes around so the Embelezar button can toggle back).
 */
async function formatSource() {
	const lang = guessLanguage(source.url, source.raw);
	const formatted = await beautifyCode(source.raw, lang);
	source.text = formatted;
	source.formatted = true;
	renderSource();
	updateBeautifyLabel();
	return lang;
}

/** Auto-formats a minified capture right after fetch (silent on failure). */
async function autoFormat() {
	if (!source || source.formatted) return;
	// prettier runs on the main thread — a multi-megabyte bundle would freeze
	// the app for minutes, so only small sources are formatted automatically.
	if (source.raw.length > 120000) {
		setStatus(
			t(
				"scraper format skipped big",
				"Código grande demais para formatar automaticamente — use «Embelezar»",
			),
		);
		return;
	}
	setStatus(
		t("scraper formatting", "Código minificado detetado — a formatar…"),
	);
	try {
		const lang = await withFormatTimeout(formatSource());
		setStatus(
			`${t("scraper auto formatted", "Formatado automaticamente")} (${lang}) — ${t("scraper toggle raw", "«Bruto» restaura o original")}`,
		);
	} catch {
		setStatus(
			t(
				"scraper format failed",
				"Não foi possível formatar — a mostrar o original",
			),
		);
	}
}

/**
 * Races a formatting promise against a hard timeout so a pathological
 * input can never leave the UI spinning forever.
 * @param {Promise<string>} promise
 */
function withFormatTimeout(promise, ms = 15000) {
	return Promise.race([
		promise,
		new Promise((_, reject) =>
			setTimeout(() => reject(new Error("format timeout")), ms),
		),
	]);
}

async function beautify() {
	if (!source) return;
	// toggle: formatted → back to the original raw bytes
	if (source.formatted) {
		source.text = source.raw;
		source.formatted = false;
		renderSource();
		updateBeautifyLabel();
		setStatus(t("scraper raw restored", "Código original (bruto)"));
		return;
	}
	setStatus(t("scraper beautifying", "A embelezar…"));
	try {
		source.raw = source.raw || source.text;
		const lang = await withFormatTimeout(formatSource());
		setStatus(`${t("scraper beautified", "Embelezado")} (${lang})`);
	} catch (error) {
		setStatus(
			`${t("scraper beautify failed", "Embelezar falhou")}: ${error?.message || error}`,
		);
	}
}

/** Keeps the Embelezar/Bruto button label in sync with the toggle state. */
function updateBeautifyLabel() {
	if (!$beautifyLabel) return;
	$beautifyLabel.textContent = source?.formatted
		? t("scraper show raw", "Bruto")
		: t("scraper beautify", "Embelezar");
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
		const $thumb =
			asset.type === "img" ? (
				<img
					className="scr-asset-thumb"
					src={asset.url}
					loading="lazy"
					referrerpolicy="no-referrer"
					alt=""
					onerror={(e) => {
						e.target.classList.add("hidden");
					}}
				/>
			) : null;
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
				{$thumb}
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
	const imageUrls = urls.filter((url) => {
		const asset = assets?.all.find((candidate) => candidate.url === url);
		if (asset) return asset.type === "img";
		return /\.(png|jpe?g|gif|webp|svg|ico|avif|bmp)(\?|#|$)/i.test(url);
	});
	const otherUrls = urls.filter((url) => !imageUrls.includes(url));
	// images go through the sequential downloader + local gallery (visible
	// results, live progress); the rest keep the notification queue
	if (imageUrls.length) downloadImagesSequential(imageUrls);
	if (otherUrls.length) {
		const dir = hostDir(source.url);
		for (const url of otherUrls) {
			startDownload({ url, dir, noBrowserFallback: true });
		}
		toast(
			`${t("scraper downloading", "A descarregar")} ${otherUrls.length} → ${dir}`,
			3000,
		);
	}
}

function downloadSelected() {
	if (!selectedAssets.size) {
		toast(
			t("scraper nothing selected", "Selecione itens na lista primeiro"),
			2500,
		);
		return;
	}
	downloadAssets(Array.from(selectedAssets));
}

/** Checks every image asset of the current capture (fast bulk select). */
function selectAllImages() {
	if (!assets?.images.length) {
		toast(t("scraper no images", "Nenhuma imagem nesta página"), 2500);
		return;
	}
	for (const asset of assets.images) selectedAssets.add(asset.url);
	renderAssets();
}

function downloadAllImages() {
	if (!assets?.images.length) {
		toast(t("scraper no images", "Nenhuma imagem nesta página"), 2500);
		return;
	}
	downloadImagesSequential(assets.images.map((asset) => asset.url));
}

/**
 * Downloads images one by one into the capture folder, tracking every
 * result in `downloadedImages` and rendering the local gallery live.
 * Sequential on purpose: parallel streams stall on mobile radios and
 * hide per-file errors.
 * @param {string[]} urls
 */
async function downloadImagesSequential(urls) {
	if (!source || !urls.length) return;
	const dir = hostDir(source.url);
	let ok = 0;
	let index = 0;
	for (const url of urls) {
		index += 1;
		const name = assetName(url);
		setStatus(
			`${t("scraper downloading", "A descarregar")} ${index}/${urls.length} — ${name}`,
		);
		try {
			const { destUrl, size } = await downloadUrl({
				url,
				dir,
				name,
				overwrite: false,
			});
			ok += 1;
			downloadedImages.set(url, {
				path: destUrl,
				size,
				ok: true,
			});
		} catch (error) {
			downloadedImages.set(url, {
				path: "",
				size: 0,
				ok: false,
				error: String(error?.message || error),
			});
		}
		renderGallery();
	}
	setStatus(
		`${ok}/${urls.length} ${t("scraper images ok", "imagens guardadas")} → ${dir}`,
	);
	toast(
		`${ok}/${urls.length} ${t("scraper images ok", "imagens guardadas")}`,
		2500,
	);
}

/**
 * Local gallery of the downloaded images — thumbnails are read from the
 * saved files (object URLs, ≤1.5 MB each) so what the user sees is what
 * actually landed on disk. Tap opens the image in the editor viewer.
 */
function renderGallery() {
	if (!$gallery) return;
	const entries = [...downloadedImages.entries()];
	$gallery.innerHTML = "";
	$gallery.classList.toggle("hidden", !entries.length);
	if (!entries.length) return;

	const okCount = entries.filter(([, item]) => item.ok).length;
	const title = `${t("scraper gallery title", "Imagens descarregadas")} — ${okCount}/${entries.length}`;
	const $title = (
		<div className="scr-gallery-title">
			<span className="icon codicon-file-media" />
			{title}
		</div>
	);

	const $grid = <div className="scr-gallery-grid" />;
	for (const [url, item] of entries.slice(0, 60)) {
		$grid.append(galleryCell(url, item));
	}
	$gallery.append($title, $grid);
}

/**
 * One gallery cell. Logic lives in named handlers OUTSIDE the JSX —
 * big inline arrow bodies inside JSX attributes trip the parser
 * tooling (biome 2.5.x fails to parse this file otherwise).
 * @param {string} url source url of the image
 * @param {{path: string, size: number, ok: boolean, error?: string}} item download result
 */
function galleryCell(url, item) {
	const label = item.ok ? assetName(url) : `${assetName(url)} — ${item.error}`;
	const open = () => {
		if (!item.ok) {
			toast(item.error || t("scraper failed", "Falhou"), 2500);
			return;
		}
		import("lib/openFile")
			.then(({ default: openFile }) => openFile(item.path, { render: true }))
			.catch((error) => toast(String(error?.message || error), 2500));
	};
	const thumb = item.ok ? (
		<img
			className="scr-gallery-thumb"
			alt=""
			ref={($el) => loadGalleryThumb(item, $el)}
		/>
	) : (
		<span className="icon codicon-error scr-gallery-thumb-icon" />
	);
	const size = item.ok ? formatSizeShort(item.size) : "";
	return (
		<div
			className={item.ok ? "scr-gallery-cell" : "scr-gallery-cell failed"}
			title={item.ok ? item.path : item.error}
			onclick={open}
		>
			{thumb}
			<span className="scr-gallery-name">{label}</span>
			<span className="scr-gallery-size">{size}</span>
		</div>
	);
}

/**
 * Swaps a thumbnail <img> for a media-type icon. DOM APIs on purpose —
 * HTML strings inside JSX attributes break the JSX tooling.
 * @param {HTMLElement} $el
 */
function replaceWithMediaIcon($el) {
	const $icon = document.createElement("span");
	$icon.className = "icon codicon-file-media scr-gallery-thumb-icon";
	$el.replaceWith($icon);
}

/**
 * Loads a local thumbnail into the gallery cell — object URL from the
 * saved file, so what the user sees is what actually landed on disk.
 * Files over 1.5 MB render as icons (memory).
 * @param {{path: string, size: number, ok: boolean, thumbLoaded?: boolean}} item
 * @param {HTMLImageElement|null} $el
 */
function loadGalleryThumb(item, $el) {
	if (!$el || item.thumbLoaded) return;
	item.thumbLoaded = true;
	if (item.size > 1500000) {
		replaceWithMediaIcon($el);
		return;
	}
	fsOperation(item.path)
		.readFile()
		.then((bin) => URL.createObjectURL(new Blob([bin])))
		.then((objectUrl) => {
			$el.src = objectUrl;
		})
		.catch(() => {
			replaceWithMediaIcon($el);
		});
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

	// --- SEO ------------------------------------------------------------
	const seo = seoAudit(source.raw || source.text, source.url);
	const tables = extractTables(source.raw || source.text);
	const links = extractLinks(source.raw || source.text, source.url);
	$analysis.append(
		<div className="scr-analysis-card scr-seo">
			<div className="scr-analysis-title">
				<span className="icon codicon-search" />
				{t("scraper seo", "Auditoria SEO")} —{" "}
				<strong
					className={`scr-seo-score ${seo.overall >= 90 ? "good" : seo.overall >= 50 ? "mid" : "bad"}`}
				>
					{seo.overall}/100
				</strong>
				<span
					className="icon codicon-save-as scr-title-action"
					title={t("scraper report save", "Guardar relatório")}
					onclick={() => saveReport({ seo, tables, links })}
				/>
			</div>
			{seo.categories.map((category) => (
				<details className="scr-seo-cat">
					<summary>
						{category.name}
						<span
							className={`scr-seo-score ${category.score >= 90 ? "good" : category.score >= 50 ? "mid" : "bad"}`}
						>
							{category.score}
						</span>
					</summary>
					{category.checks.map((check) => (
						<div className={`scr-seo-check ${check.status}`}>
							<span className="scr-seo-mark">
								{check.status === "pass"
									? "✓"
									: check.status === "warn"
										? "!"
										: "✕"}
							</span>
							<div className="scr-seo-check-body">
								<span className="scr-seo-check-title">{check.title}</span>
								<span className="scr-seo-check-detail">{check.detail}</span>
								{check.tip ? (
									<span className="scr-seo-tip">💡 {check.tip}</span>
								) : null}
							</div>
						</div>
					))}
				</details>
			))}
		</div>,
	);

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

	// --- tabelas -----------------------------------------------------------
	$analysis.append(
		<div className="scr-analysis-card">
			<div className="scr-analysis-title">
				<span className="icon codicon-table" />
				{t("scraper tables", "Tabelas")} ({tables.length})
			</div>
			{tables.length ? (
				tables.map((table, index) => (
					<details className="scr-table">
						<summary>
							{t("scraper table", "Tabela")} {index + 1} — {table.rows.length}{" "}
							{t("scraper rows", "linhas")}
							{table.header ? (
								<span className="scr-table-head-mark">
									{t("scraper table header", "cabeçalho")}
								</span>
							) : null}
						</summary>
						<pre className="scr-table-preview">
							{table.rows
								.slice(0, 5)
								.map((row) => row.join(" | "))
								.join("\n")}
						</pre>
						<div className="scr-table-actions">
							<button
								type="button"
								onclick={() => copyText(tableToCsv(table.rows))}
							>
								<span className="icon codicon-copy" />
								{t("scraper table csv copy", "Copiar CSV")}
							</button>
							<button type="button" onclick={() => saveTableCsv(table, index)}>
								<span className="icon codicon-save-as" />
								{t("scraper table csv save", "Guardar CSV")}
							</button>
						</div>
					</details>
				))
			) : (
				<div className="ins-empty">
					{t("scraper tables none", "Nenhuma tabela detectada na página")}
				</div>
			)}
		</div>,
	);

	// --- links -----------------------------------------------------------
	$analysis.append(
		<div className="scr-analysis-card">
			<div className="scr-analysis-title">
				<span className="icon codicon-globe" />
				{t("scraper links", "Links")} ({links.links.length})
				<span
					className="icon codicon-copy scr-title-action"
					title={t("scraper copy links", "Copiar todos")}
					onclick={() => {
						if (!links.links.length) {
							toast(t("scraper links none", "Nenhum link na página"), 2000);
							return;
						}
						copyText(links.links.map((link) => link.href).join("\n"));
					}}
				/>
			</div>
			{links.links.length ? (
				<div>
					<div className="scr-links-counts">
						<span>
							{links.internal} {t("scraper links internal", "internos")}
						</span>
						<span>
							{links.external} {t("scraper links external", "externos")}
						</span>
					</div>
					{links.links.slice(0, 80).map((link) => (
						<div className="scr-link" onclick={() => copyText(link.href)}>
							<span className="scr-link-href">{link.href}</span>
							{link.text ? (
								<span className="scr-link-text">{link.text}</span>
							) : null}
						</div>
					))}
					{links.links.length > 80 ? (
						<div className="ins-empty">
							+{links.links.length - 80}{" "}
							{t("scraper links more", "links — usar Copiar todos")}
						</div>
					) : null}
				</div>
			) : (
				<div className="ins-empty">
					{t("scraper links none", "Nenhum link na página")}
				</div>
			)}
		</div>,
	);

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
	openScraperPage();
	if (!$url) return;
	$url.value = url;
	switchTab("source");
	await fetchSource(mode);
}
/**
 * Opens the tool as an independent full-screen page (fora da
 * sidebar e da janela flutuante) — results always visible.
 * @returns {HTMLElement} the page element
 */
export function openScraperPage() {
	return openToolPage({
		id: "scraper-page",
		titleKey: "scraper",
		title: "Scraper",
		className: "scr-app",
		build: initApp,
	});
}
