import "./style.scss";
import toast from "components/toast";
import { extractMeta, httpFetchDetailed } from "lib/webScraper";
import {
	buildAnalyzerReport,
	detectTechnologies,
	TECH_CATEGORY_ORDER,
} from "lib/techDetect";
import { fetchRenderedHtml } from "lib/webInspector";
import { copyText } from "utils/clipboard";

/**
 * Site Analyzer sidebar app — «descobrir o que foi usado para se basear»:
 * detects frameworks, languages, servers, CDNs, CMSs, analytics, fonts,
 * widgets… from the response headers + HTML of any URL, always showing
 * the evidence that produced each match, plus a copyable report.
 */

const t = (key, fallback) => strings[key] || fallback;

/** @type {HTMLElement|null} */
let container = null;
/** @type {HTMLInputElement|null} */
let $url = null;
/** @type {HTMLElement|null} */
let $status = null;
/** @type {HTMLElement|null} */
let $techs = null;
/** @type {HTMLElement|null} */
let $details = null;
/** @type {HTMLElement|null} */
let $report = null;
/** @type {HTMLElement|null} */
let $techBadge = null;
/** @type {HTMLElement|null} */
let $summary = null;
/** @type {HTMLButtonElement|null} */
let $renderedBtn = null;
/** @type {HTMLButtonElement|null} */
let $reportRenderedBtn = null;

/** last raw fetch result — headers survive the "rendered" re-analysis */
/** @type {{headers: Record<string, string>, status: number, statusText: string, url: string}|null} */
let lastResponse = null;
/** @type {string} */
let activeTab = "tech";
/** @type {boolean} */
let busy = false;

function initApp(el) {
	container = el;
	el.classList.add("ana-app");
	el.content = buildUi();
	const onLangChange = () => retranslate();
	document.addEventListener("langchange", onLangChange);
	return () => {
		document.removeEventListener("langchange", onLangChange);
		container = null;
		$url = null;
		$status = null;
		$techs = null;
		$details = null;
		$report = null;
		$techBadge = null;
		$summary = null;
		$renderedBtn = null;
		$reportRenderedBtn = null;
		lastResponse = null;
	};
}

function normalizeUrl(value) {
	let url = String(value || "").trim();
	if (!url) return "";
	if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = `https://${url}`;
	return url;
}

function buildUi() {
	$url = (
		<input
			type="url"
			className="scr-url ana-url"
			placeholder="https://exemplo.com"
			enterKeyHint="go"
			spellcheck={false}
			onkeydown={(e) => {
				if (e.key === "Enter") analyze();
			}}
		/>
	);

	$status = (
		<div className="scr-status">
			{t("analyzer idle", "Introduza um endereço para analisar")}
		</div>
	);

	const $tabs = (
		<div className="scr-tabs">
			<button
				type="button"
				className="scr-tab active"
				data-tab="tech"
				onclick={() => switchTab("tech")}
			>
				<span className="icon codicon-telescope" />
				{t("analyzer tech", "Tecnologias")}
				<span className="ins-badge hidden" ref={(el) => ($techBadge = el)} />
			</button>
			<button
				type="button"
				className="scr-tab"
				data-tab="details"
				onclick={() => switchTab("details")}
			>
				<span className="icon codicon-server-process" />
				{t("analyzer details", "Detalhes")}
			</button>
			<button
				type="button"
				className="scr-tab"
				data-tab="report"
				onclick={() => switchTab("report")}
			>
				<span className="icon codicon-output" />
				{t("analyzer report", "Relatório")}
			</button>
		</div>
	);

	const $techPanel = (
		<div className="scr-panel" data-panel="tech">
			<div className="ana-summary hidden" ref={(el) => ($summary = el)} />
			<div className="ana-groups scroll" ref={(el) => ($techs = el)} />
			<div className="ana-empty hidden" data-role="empty">
				<span className="icon codicon-telescope" />
				<p>{t("analyzer no results", "Nenhuma tecnologia detetada")}</p>
				<p className="ana-empty-hint">
					{t(
						"analyzer no results hint",
						"O site pode ter bloqueado o pedido — tente «Versão renderizada».",
					)}
				</p>
			</div>
		</div>
	);

	const $detailsPanel = (
		<div className="scr-panel hidden" data-panel="details">
			<div className="ana-details scroll" ref={(el) => ($details = el)}>
				<div className="ana-actions">
					<button
						type="button"
						ref={(el) => ($renderedBtn = el)}
						onclick={() => analyzeRendered()}
					>
						<span className="icon codicon-wand" />
						{t("analyzer rendered", "Versão renderizada")}
					</button>
				</div>
				<p className="ana-details-hint">
					{t(
						"analyzer rendered hint",
						"«Versão renderizada» carrega a página numa WebView interna e analisa o DOM final — resolve sites SPA e bloqueios.",
					)}
				</p>
				<div data-role="details-body" />
			</div>
		</div>
	);

	const $reportPanel = (
		<div className="scr-panel hidden" data-panel="report">
			<div className="ana-actions">
				<button
					type="button"
					onclick={() => copyReport()}
					data-role="copy-report"
				>
					<span className="icon codicon-copy" />
					{t("analyzer copy report", "Copiar relatório")}
				</button>
				<button
					type="button"
					ref={(el) => ($reportRenderedBtn = el)}
					onclick={() => analyzeRendered()}
				>
					<span className="icon codicon-wand" />
					{t("analyzer rendered", "Versão renderizada")}
				</button>
			</div>
			<pre className="ana-report scroll" ref={(el) => ($report = el)} />
		</div>
	);

	return (
		<div className="scr-app-body">
			<div className="scr-urlbar">
				{$url}
				<span
					className="icon codicon-search"
					role="button"
					aria-label={t("analyze", "Analisar")}
					onclick={() => analyze()}
				/>
			</div>
			{$status}
			{$tabs}
			{$techPanel}
			{$detailsPanel}
			{$reportPanel}
		</div>
	);
}

function retranslate() {
	// rendered buttons rebuild (icon + text)
	for (const $btn of [$renderedBtn, $reportRenderedBtn]) {
		if (!$btn) continue;
		$btn.innerHTML = "";
		$btn.append(
			<span className="icon codicon-wand" />,
			document.createTextNode(t("analyzer rendered", "Versão renderizada")),
		);
	}
}

function switchTab(tab) {
	activeTab = tab;
	container?.querySelectorAll(".scr-tab").forEach(($tab) => {
		$tab.classList.toggle("active", $tab.dataset.tab === tab);
	});
	container?.querySelectorAll(".scr-panel").forEach(($panel) => {
		$panel.classList.toggle("hidden", $panel.dataset.panel !== tab);
	});
}

function setStatus(text, busyNow = false) {
	if (!$status) return;
	$status.textContent = text;
	$status.dataset.busy = busyNow ? "1" : "";
	$status.classList.toggle("ana-busy", busyNow);
}

/** One category group: label + technology cards with evidence. */
function techGroupMarkup(category, list) {
	const label =
		strings[`tech cat ${category}`] ||
		category.replace(/^\w/, (c) => c.toUpperCase());
	const items = list.map((tech) => {
		const evidence = tech.evidence || [];
		const site = tech.site ? (
			<a
				className="ana-link"
				href={tech.site}
				target="_blank"
				rel="noopener noreferrer"
			>
				{tech.site.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
			</a>
		) : null;
		return (
			<details className="ana-tech">
				<summary>
					<span className="ana-tech-name">{tech.name}</span>
					<span className="ana-tech-count">{evidence.length}</span>
				</summary>
				<div className="ana-evidence">
					{evidence.map((ev) => (
						<code className="ana-ev">{ev}</code>
					))}
					{site}
				</div>
			</details>
		);
	});
	return (
		<section className="ana-group" data-cat={category}>
			<h3>{label}</h3>
			{items}
		</section>
	);
}

/** Key/value rows for meta + headers on the Details tab. */
function rowsMarkup(title, rows) {
	if (!rows.length) return null;
	return (
		<section className="ana-group">
			<h3>{title}</h3>
			{rows.map(([key, value]) => (
				<div className="ana-row">
					<span className="ana-row-key">{key}</span>
					<span className="ana-row-value">{value}</span>
				</div>
			))}
		</section>
	);
}

/**
 * Renders one analysis result into all three tabs.
 * @param {{html: string, headers: Record<string, string>, status: number, statusText: string, url: string, elapsedMs: number}} page
 */
function renderResults(page) {
	const techs = detectTechnologies(page);
	const meta = extractMeta(page.html) || {};

	// summary chips
	if ($summary) {
		$summary.classList.remove("hidden");
		const chips = [
			[t("status code", "Estado"), `${page.status || "—"}`],
			[t("load time", "Tempo"), `${(page.elapsedMs / 1000).toFixed(1)} s`],
			[
				t("page size", "Tamanho"),
				`${(new Blob([page.html || ""]).size / 1024).toFixed(1)} kB`,
			],
			[t("analyzer found", "Encontradas"), `${techs.length}`],
		];
		$summary.replaceChildren(
			...chips.map(([label, value]) => (
				<span className="ana-chip">
					<span className="ana-chip-label">{label}</span>
					<span className="ana-chip-value">{value}</span>
				</span>
			)),
		);
	}

	// technologies grouped by category
	if ($techs) {
		const grouped = new Map();
		for (const tech of techs) {
			const list = grouped.get(tech.category) || [];
			list.push(tech);
			grouped.set(tech.category, list);
		}
		const groups = TECH_CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map(
			(cat) => techGroupMarkup(cat, grouped.get(cat)),
		);
		$techs.replaceChildren(...groups);
	}

	// details: meta + headers
	if ($details) {
		const body = $details.querySelector('[data-role="details-body"]');
		if (body) {
			const metaRows = Object.entries({
				[t("title", "Título")]: meta.title || "",
				[t("description", "Descrição")]: meta.description || "",
				[t("generator", "Generator")]: meta.generator || "",
				[t("viewport", "Viewport")]: meta.viewport || "",
				[t("language", "Idioma")]: meta.lang || "",
				[t("canonical", "Canonical")]: meta.canonical || "",
			})
				.filter(([, value]) => value && String(value).trim())
				.map(([key, value]) => [key, String(value)]);
			const ogRows = (meta.openGraph || []).map(([key, value]) => [
				`og:${key}`,
				String(value),
			]);
			const headerRows = Object.entries(page.headers || {}).map(
				([key, value]) => [key, String(value).slice(0, 300)],
			);
			const sections = [
				rowsMarkup(t("page info", "Informação da página"), [
					...metaRows,
					...ogRows,
				]),
				rowsMarkup(t("response headers", "Cabeçalhos da resposta"), headerRows),
			].filter(Boolean);
			body.replaceChildren(...sections);
			if (!sections.length) {
				body.append(
					<p className="ana-details-hint">
						{t("analyzer no details", "Sem detalhes disponíveis.")}
					</p>,
				);
			}
		}
	}

	// report text
	if ($report) {
		$report.textContent = buildAnalyzerReport(
			{
				url: page.url,
				status: page.status,
				statusText: page.statusText,
				elapsedMs: page.elapsedMs,
				sizeBytes: new Blob([page.html || ""]).size,
				headers: page.headers,
				techs,
				meta: {
					[t("title", "Título")]: meta.title,
					[t("description", "Descrição")]: meta.description,
					[t("generator", "Generator")]: meta.generator,
					[t("language", "Idioma")]: meta.lang,
				},
			},
			(key) => strings[key] || key,
		);
	}

	// empty state + badge
	const empty = container?.querySelector('[data-role="empty"]');
	if (empty) empty.classList.toggle("hidden", techs.length > 0);
	if ($techBadge) {
		$techBadge.textContent = techs.length ? `${techs.length}` : "";
		$techBadge.classList.toggle("hidden", !techs.length);
	}
}

async function analyze() {
	const url = normalizeUrl($url?.value);
	if (!url) {
		setStatus(t("analyzer idle", "Introduza um endereço para analisar"));
		return;
	}
	if (busy) return;
	busy = true;
	setStatus(`${t("analyzer running", "A analisar")} ${url} …`, true);
	try {
		const started = performance.now();
		const response = await httpFetchDetailed(url, { timeoutMs: 30000 });
		lastResponse = {
			headers: response.headers,
			status: response.status,
			statusText: response.statusText,
			url: response.url,
		};
		const elapsedMs = performance.now() - started;
		renderResults({
			html: response.text,
			headers: response.headers,
			status: response.status,
			statusText: response.statusText,
			url: response.url,
			elapsedMs,
		});
		setStatus(
			`${t("analyzer done", "Análise concluída")} — ${response.status} · ${(elapsedMs / 1000).toFixed(1)} s`,
		);
	} catch (error) {
		setStatus(
			`${t("analyzer failed", "Falha ao obter o site")}: ${error?.message || error}`,
		);
		if (lastResponse) {
			renderResults({
				html: "",
				headers: lastResponse.headers,
				status: lastResponse.status,
				statusText: lastResponse.statusText,
				url: lastResponse.url,
				elapsedMs: 0,
			});
		} else {
			const empty = container?.querySelector('[data-role="empty"]');
			if (empty) empty.classList.remove("hidden");
		}
	} finally {
		busy = false;
	}
}

/** Re-analyzes with the final DOM of a hidden WebView (SPA/blocked sites). */
async function analyzeRendered() {
	const url = normalizeUrl($url?.value);
	if (!url || busy) return;
	busy = true;
	setStatus(
		t("analyzer rendered running", "A carregar a versão renderizada…"),
		true,
	);
	try {
		const started = performance.now();
		const rendered = await fetchRenderedHtml(url, { timeoutMs: 45000 });
		const elapsedMs = performance.now() - started;
		renderResults({
			html: rendered.html,
			headers: lastResponse?.headers || {},
			status: lastResponse?.status || 200,
			statusText: lastResponse?.statusText || "",
			url: rendered.url || url,
			elapsedMs,
		});
		setStatus(t("analyzer rendered done", "Versão renderizada analisada"));
	} catch (error) {
		setStatus(
			`${t("analyzer failed", "Falha ao obter o site")}: ${error?.message || error}`,
		);
	} finally {
		busy = false;
	}
}

function copyReport() {
	const text = $report?.textContent?.trim();
	if (!text) {
		toast(t("analyzer no report", "Análise um site primeiro"), 2500);
		return;
	}
	copyText(text)
		.then(() => toast(t("analyzer report copied", "Relatório copiado"), 2000))
		.catch(() =>
			toast(t("analyzer copy failed", "Não foi possível copiar"), 2500),
		);
}

/**
 * Opens the analyzer with `url` — used by the native preview screen's
 * "Analyze" menu item and by intents (xcoder_tool extras).
 * @param {string} url
 */
export async function openAnalyzerWith(url) {
	// the hand-off can arrive before the app rendered its input — wait for it
	for (let i = 0; i < 50 && !$url; i += 1) {
		await new Promise((resolve) => setTimeout(resolve, 60));
	}
	if (!$url) return;
	$url.value = url;
	activeTab = "tech";
	switchTab("tech");
	await analyze();
}

export default [
	"cod:telescope",
	"analyzerApp",
	strings["analyzer"] || "Site Analyzer",
	initApp,
	false,
	() => {},
	{ titleKey: "analyzer", group: "tools", floating: true },
];
