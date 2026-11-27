import "./style.scss";
import toast from "components/toast";
import confirm from "dialogs/confirm";
import prompt from "dialogs/prompt";
import {
	activeInspectorSession,
	closeInspectorSession,
	evaluateInPage,
	networkLabel,
	networkType,
	normalizeAddress,
	onInspectorEvent,
	openInspectorSession,
	reloadInspectorSession,
	sendInspectorCommand,
	showInspectorPage,
} from "lib/webInspector";
import { httpFetch } from "lib/webScraper";
import { copyText } from "utils/clipboard";
import { openToolPage } from "../toolPage";

/**
 * Inspector sidebar app — DevTools-grade page inspection ("ferramentas de
 * inspecção como no PC, incluindo URL").
 *
 * A native webview loads the target address with the capture script
 * (lib/webInspector) injected at document start. The app renders three
 * panels: Elementos (DOM tree + attributes/computed styles/box model +
 * highlight), Consola (console capture + JS runner) and Rede (fetch/XHR
 * log). The page itself opens fullscreen on demand.
 */

const t = (key, fallback) => strings[key] || fallback;

/** @type {HTMLElement|null} */
let container = null;
/** @type {HTMLInputElement|null} */
let $url = null;
/** @type {HTMLElement|null} */
let $status = null;
/** @type {HTMLElement|null} */
let $tree = null;
/** @type {HTMLElement|null} */
let $details = null;
/** @type {HTMLElement|null} */
let $console = null;
/** @type {HTMLElement|null} */
let $network = null;
/** @type {HTMLElement|null} */
let $consoleBadge = null;
/** @type {HTMLElement|null} */
let $networkBadge = null;

let activeTab = "elements";
let pageTitle = "";
let pageUrl = "";

/** @type {Set<string>} expanded tree paths */
const expanded = new Set([""]);
/** @type {Map<string, {self: any, children: any[], total: number}>} tree cache keyed by requested path */
const treeCache = new Map();
/** @type {string|null} selected path */
let selectedPath = null;
/** @type {Set<string>} highlighted paths */
const highlightedPaths = new Set();

/** @type {Array<{level: string, text: string, ts: number}>} */
const consoleEntries = [];
/** @type {Array<any>} */
const networkEntries = [];
let networkFilter = "all";
let consoleErrors = 0;
/** lowercase text filter for the network list (url, method or status) */
let networkTextFilter = "";

/** console command history (DevTools-style ↑/↓ recall) */
const consoleHistory = [];
let consoleHistoryIndex = -1;

/** DevTools-style element picker state («selecionar na página») */
let pickMode = false;
/** @type {HTMLElement|null} pick-mode toolbar button */
let $pick = null;
/** @type {HTMLElement|null} open bottom sheet (body preview / HTML editor) */
let $sheet = null;

/**
 * Raw-HTML fallback (DOMParser document) — keeps Elementos/selector search
 * working even when the native webview never reports pageFinished (some
 * sites block the headless load; the user still sees the DOM from the
 * HTTP source, and a live session upgrades it when it loads).
 * @type {{doc: Document, url: string}|null}
 */
let fallbackPage = null;

/**
 * @param {HTMLElement} el container provided by the sidebar
 */
function initApp(el) {
	container = el;
	el.classList.add("ins-app");
	el.content = buildUi();

	onInspectorEvent(handleEvent);

	const onLangChange = () => {};
	document.addEventListener("langchange", onLangChange);

	return () => {
		document.removeEventListener("langchange", onLangChange);
		onInspectorEvent(() => {});
		container = null;
		$url = null;
		$status = null;
		$tree = null;
		$details = null;
		$console = null;
		$network = null;
		$consoleBadge = null;
		$networkBadge = null;
		$pick = null;
		pickMode = false;
		$sheet = null;
	};
}

function buildUi() {
	$url = (
		<input
			type="url"
			className="ins-url"
			placeholder="https://exemplo.com"
			enterKeyHint="go"
			spellcheck={false}
			onkeydown={(e) => {
				if (e.key === "Enter") go();
			}}
		/>
	);

	$status = (
		<div className="ins-status">
			{t("inspector idle", "Introduza um endereço para inspecionar")}
		</div>
	);

	const $tabs = (
		<div className="ins-tabs">
			<button
				type="button"
				className="ins-tab active"
				data-tab="elements"
				onclick={() => switchTab("elements")}
			>
				<span className="icon codicon-code" />
				{t("inspector elements", "Elementos")}
			</button>
			<button
				type="button"
				className="ins-tab"
				data-tab="console"
				onclick={() => switchTab("console")}
			>
				<span className="icon codicon-debug-console" />
				{t("inspector console", "Consola")}
				<span className="ins-badge hidden" ref={(el) => ($consoleBadge = el)} />
			</button>
			<button
				type="button"
				className="ins-tab"
				data-tab="network"
				onclick={() => switchTab("network")}
			>
				<span className="icon codicon-remote" />
				{t("inspector network", "Rede")}
				<span className="ins-badge hidden" ref={(el) => ($networkBadge = el)} />
			</button>
		</div>
	);

	const $elementsPanel = (
		<div className="ins-panel" data-panel="elements">
			<div className="ins-panel-toolbar">
				<input
					type="search"
					className="ins-dom-search"
					placeholder={t(
						"inspector dom search",
						"selector CSS (ex: #app, .btn)",
					)}
					onkeydown={(e) => {
						if (e.key === "Enter") searchDom(e.target);
					}}
				/>
				<span
					className="icon codicon-target"
					ref={(el) => ($pick = el)}
					title={t("inspector pick mode", "Selecionar na página")}
					onclick={togglePickMode}
				/>
				<span
					className="icon codicon-clear-all"
					title={t("inspector clear highlight", "Limpar realce")}
					onclick={clearHighlight}
				/>
			</div>
			<div className="ins-tree scroll" ref={(el) => ($tree = el)} />
			<div className="ins-details scroll" ref={(el) => ($details = el)} />
		</div>
	);

	const $consolePanel = (
		<div className="ins-panel hidden" data-panel="console">
			<div className="ins-panel-toolbar">
				<span className="ins-toolbar-hint">
					{t(
						"inspector console hint",
						"logs, erros e pedidos capturados na página",
					)}
				</span>
				<span
					className="icon codicon-clear-all"
					title={t("inspector clear console", "Limpar consola")}
					onclick={() => {
						consoleEntries.length = 0;
						consoleErrors = 0;
						updateBadges();
						renderConsole();
					}}
				/>
			</div>
			<div className="ins-console scroll" ref={(el) => ($console = el)} />
			<div className="ins-console-row">
				<input
					type="text"
					className="ins-console-input"
					placeholder={t("inspector run js", "Executar JavaScript…")}
					spellcheck={false}
					onkeydown={(e) => {
						if (e.key === "Enter") runJs(e.target);
						else if (e.key === "ArrowUp") {
							e.preventDefault();
							consoleHistoryNav(e.target, -1);
						} else if (e.key === "ArrowDown") {
							e.preventDefault();
							consoleHistoryNav(e.target, 1);
						}
					}}
				/>
				<span
					className="icon codicon-play"
					title={t("inspector run", "Executar")}
					onclick={(e) => {
						const $input = e.target.parentElement?.querySelector("input");
						if ($input) runJs($input);
					}}
				/>
			</div>
		</div>
	);

	const $networkPanel = (
		<div className="ins-panel hidden" data-panel="network">
			<div className="ins-panel-toolbar">
				<input
					type="search"
					className="ins-net-filter"
					placeholder={t(
						"inspector net filter",
						"Filtrar url, método ou estado",
					)}
					oninput={(e) => {
						networkTextFilter = String(e.target.value || "")
							.trim()
							.toLowerCase();
						renderNetwork();
					}}
				/>
				<div className="ins-chips">
					{["all", "xhr", "js", "css", "img", "font"].map((chip) => (
						<button
							type="button"
							className={`ins-chip${chip === "all" ? " active" : ""}`}
							data-chip={chip}
							onclick={() => setNetworkFilter(chip)}
						>
							{chipLabel(chip)}
						</button>
					))}
				</div>
				<span
					className="icon codicon-clear-all"
					title={t("inspector clear network", "Limpar rede")}
					onclick={() => {
						networkEntries.length = 0;
						updateBadges();
						renderNetwork();
					}}
				/>
			</div>
			<div className="ins-network scroll" ref={(el) => ($network = el)} />
		</div>
	);

	// restore a live session on app reopen
	if (activeInspectorSession()) {
		setTimeout(() => {
			setStatus(
				t(
					"inspector session live",
					"Sessão activa — recarregue ou insira novo endereço",
				),
			);
			if (!treeCache.has("")) fetchTree("");
		}, 0);
	}

	return (
		<div className="ins-app-body">
			<div className="ins-urlbar">
				{$url}
				<span
					className="icon codicon-play"
					title={t("inspector go", "Abrir e inspecionar")}
					onclick={go}
				/>
				<span
					className="icon codicon-refresh"
					title={t("inspector reload", "Recarregar página")}
					onclick={reload}
				/>
				<span
					className="icon codicon-browser"
					title={t("inspector open page", "Ver página em tela cheia")}
					onclick={openPageFullscreen}
				/>
				<span
					className="icon codicon-close"
					title={t("inspector stop", "Fechar sessão")}
					onclick={stopSession}
				/>
			</div>
			{$status}
			{$tabs}
			{$elementsPanel}
			{$consolePanel}
			{$networkPanel}
		</div>
	);
}

// ------------------------------------------------------------- navigation

async function go() {
	const target = normalizeAddress($url?.value);
	if (!target) {
		toast(t("inspector invalid url", "Endereço inválido"), 2000);
		return;
	}
	if ($url) $url.value = target;
	setStatus(t("inspector loading", "A abrir página…"));
	treeCache.clear();
	expanded.clear();
	expanded.add("");
	selectedPath = null;
	networkEntries.length = 0;
	renderTree();
	renderDetails(null);
	updateBadges();
	renderNetwork();

	// guarantee visible content: parse the raw HTML while the live session
	// opens (the old flow showed an eternal spinner whenever the webview
	// never fired pageFinished)
	fallbackPage = null;
	loadFallbackPage(target);

	let pageLoaded = false;
	const finishedListener = () => {
		pageLoaded = true;
	};
	onInspectorEvent((event, data) => {
		if (event === "pageFinished") finishedListener();
		handleEvent(event, data);
	});

	try {
		await openInspectorSession(target, { mode: "fullscreen", visible: false });
	} catch (error) {
		setStatus(
			`${t("inspector failed", "Falhou ao abrir")}: ${error?.message || error}`,
		);
		toast(
			`${t("inspector failed", "Falhou ao abrir")}: ${error?.message || error}`,
			3000,
		);
		return;
	}

	// watchdog — surface a real diagnosis instead of hanging on «A abrir…»
	setTimeout(() => {
		if (container && !pageLoaded && activeInspectorSession()) {
			setStatus(
				`${t("inspector page quiet", "A página não respondeu")} — ${t("inspector fallback note", "a árvore abaixo vem da fonte (HTTP); tente recarregar ou ver em tela cheia")}`,
			);
		}
	}, 18000);
}

async function reload() {
	if (!activeInspectorSession()) {
		go();
		return;
	}
	setStatus(t("inspector loading", "A recarregar…"));
	try {
		await reloadInspectorSession();
	} catch (error) {
		toast(String(error?.message || error), 2500);
	}
}

async function openPageFullscreen() {
	if (!activeInspectorSession()) return;
	try {
		await showInspectorPage();
	} catch (error) {
		toast(String(error?.message || error), 2500);
	}
}

async function stopSession() {
	await closeInspectorSession();
	fallbackPage = null;
	pageTitle = "";
	pageUrl = "";
	setPickModeUi(false);
	closeSheet();
	networkTextFilter = "";
	setStatus(t("inspector idle", "Introduza um endereço para inspecionar"));
	treeCache.clear();
	expanded.clear();
	expanded.add("");
	renderTree();
	renderDetails(null);
}

// ----------------------------------------------------------------- events

function handleEvent(event, data) {
	if (!container) return;

	if (event === "pageFinished") {
		pageUrl = data?.url || pageUrl;
		pageTitle = data?.title || pageTitle;
		if ($url && pageUrl) $url.value = pageUrl;
		setStatus(pageTitle || pageUrl);
		setPickModeUi(false);
		treeCache.clear();
		expanded.clear();
		expanded.add("");
		selectedPath = null;
		highlightedPaths.clear();
		renderTree();
		renderDetails(null);
		consoleEntries.push({
			level: "info",
			text: `— ${t("inspector navigated", "navegou para")} ${pageUrl}`,
			ts: Date.now(),
		});
		renderConsole();
		// pull the DOM tree right away (previously the root fetch only
		// happened on tab switches, leaving a spinner forever) — with
		// one hydration retry for SPA pages that paint late
		fetchTree("");
		setTimeout(() => {
			if (activeInspectorSession() && !treeCache.has("")) {
				fetchTree("");
			}
		}, 1200);
		return;
	}

	if (event === "titleChanged") {
		pageTitle = data?.title || pageTitle;
		setStatus(pageTitle || pageUrl);
		return;
	}

	if (event === "inspectorMessage") {
		switch (data?.cmd) {
			case "console":
				consoleEntries.push({
					level: data.data?.level || "log",
					text: data.data?.text || "",
					ts: data.data?.ts || Date.now(),
				});
				if (consoleEntries.length > 500) consoleEntries.shift();
				if (data.data?.level === "error") consoleErrors += 1;
				updateBadges();
				renderConsole();
				break;
			case "network":
				networkEntries.push(data.data);
				if (networkEntries.length > 500) networkEntries.shift();
				updateBadges();
				renderNetwork();
				break;
			case "picked":
				// element chosen with the picker — leave pick mode
				// and jump to it in the tree
				setPickModeUi(false);
				if (data?.path) applySearchMatches([data], 1);
				break;
			case "inspect":
				renderDetails(data.data);
				break;
		}
	}
}

// ------------------------------------------------------------------- tabs

/** @param {string} tab */
function switchTab(tab) {
	activeTab = tab;
	container?.querySelectorAll(".ins-tab").forEach(($el) => {
		$el.classList.toggle("active", $el.dataset.tab === tab);
	});
	container?.querySelectorAll(".ins-panel").forEach(($el) => {
		$el.classList.toggle("hidden", $el.dataset.panel !== tab);
	});
	if (tab === "elements" && !treeCache.has("") && activeInspectorSession()) {
		fetchTree("");
	}
}

function setStatus(text) {
	if ($status) $status.textContent = text;
}

// ------------------------------------------------- raw-HTML fallback tree

/** Element-only child list mirroring the page-side inspector script. */
function fallbackChildren(node, parentPath) {
	const total = node.children ? node.children.length : 0;
	const children = [];
	for (let i = 0; i < total && children.length < 60; i += 1) {
		const child = node.children[i];
		const path = parentPath ? `${parentPath}.${i}` : String(i);
		children.push({
			path,
			tag:
				child.nodeType === 1
					? child.tagName.toLowerCase()
					: String(child.nodeName || "?"),
			id: child.id || "",
			classes: child.classList?.length
				? Array.prototype.join.call(child.classList, " ")
				: "",
			childCount: child.children ? child.children.length : 0,
			text: child.children?.length
				? ""
				: String(child.textContent || "")
						.trim()
						.slice(0, 120),
			attrs: fallbackAttrs(child),
		});
	}
	return { children, total };
}

function fallbackAttrs(node) {
	const attrs = {};
	if (node.attributes) {
		for (const attr of node.attributes) attrs[attr.name] = attr.value;
	}
	return attrs;
}

/** Walks an index chain of elements — same grammar as the page side. */
function fallbackNodeAt(path) {
	let node = fallbackPage?.doc;
	if (!node) return null;
	const parts = String(path || "")
		.split(".")
		.filter((part) => part !== "");
	for (const part of parts) {
		node = node.children?.[Number(part)];
		if (!node) return null;
	}
	return node;
}

/** Caches a fallback tree level so renderNode() can display it. */
function cacheFallbackLevel(path) {
	if (!fallbackPage) return;
	const node = path === "" ? fallbackPage.doc : fallbackNodeAt(path);
	if (!node) return;
	const { children, total } = fallbackChildren(node, path);
	const self =
		path === ""
			? {
					path: "",
					tag: "#document",
					id: "",
					classes: "",
					childCount: total,
					text: "",
					attrs: {},
				}
			: {
					path,
					tag:
						node.nodeType === 1
							? node.tagName.toLowerCase()
							: String(node.nodeName || "?"),
					id: node.id || "",
					classes: node.classList?.length
						? Array.prototype.join.call(node.classList, " ")
						: "",
					childCount: node.children ? node.children.length : 0,
					text: node.children?.length
						? ""
						: String(node.textContent || "")
								.trim()
								.slice(0, 120),
					attrs: fallbackAttrs(node),
				};
	treeCache.set(path, { self, children, total });
}

/**
 * Fetches the raw HTML and builds the fallback tree. Always safe to call:
 * failures simply leave the previous view in place.
 * @param {string} url
 */
async function loadFallbackPage(url) {
	try {
		const html = String(await httpFetch(url));
		if (!html.trim()) return;
		const doc = new DOMParser().parseFromString(html, "text/html");
		fallbackPage = { doc, url };
		treeCache.set("", null);
		treeCache.delete("");
		cacheFallbackLevel("");
		if (container && !treeCache.get("")) {
			// parse produced nothing useful — keep the empty state
			fallbackPage = null;
			return;
		}
		renderTree();
		if (!activeInspectorSession()) {
			setStatus(
				t(
					"inspector fallback mode",
					"Árvore pela fonte (HTTP) — consola/rede exigem a página viva",
				),
			);
		}
	} catch {
		/* offline / blocked — the live session may still work */
	}
}

function updateBadges() {
	if ($consoleBadge) {
		$consoleBadge.textContent = consoleErrors ? String(consoleErrors) : "";
		$consoleBadge.classList.toggle("hidden", !consoleErrors);
	}
	if ($networkBadge) {
		$networkBadge.textContent = networkEntries.length
			? String(networkEntries.length)
			: "";
		$networkBadge.classList.toggle("hidden", !networkEntries.length);
	}
}

// ------------------------------------------------------------------- tree

/** @param {string} path */
async function fetchTree(path) {
	if (fallbackPage && !activeInspectorSession()) {
		cacheFallbackLevel(path);
		renderTree();
		return;
	}
	if (!activeInspectorSession()) return;
	try {
		const data = await sendInspectorCommand("getTree", { path });
		if (data) {
			treeCache.set(path, data);
			renderTree();
		} else if (!path) {
			setStatus(
				t(
					"inspector tree empty",
					"A página viva não devolveu a árvore — mostrando a fonte (HTTP)",
				),
			);
		}
	} catch (error) {
		if (fallbackPage && !path) {
			cacheFallbackLevel("");
			renderTree();
			setStatus(
				`${t("inspector tree error", "Árvore viva falhou")}: ${error?.message || error} — ${t("inspector using fallback", "usando a fonte (HTTP)")}`,
			);
		}
	}
}

/**
 * @param {any} node
 * @returns {string}
 */
function nodeLabel(node) {
	const parts = [`<${node?.tag || "?"}>`];
	if (node?.id) parts.push(`#${node.id}`);
	if (node?.classes) {
		parts.push(
			`.${String(node.classes)
				.split(/\s+/)
				.filter(Boolean)
				.slice(0, 2)
				.join(".")}`,
		);
	}
	return parts.join("");
}

function renderTree() {
	if (!$tree) return;
	$tree.innerHTML = "";

	if (!activeInspectorSession() && !fallbackPage) {
		$tree.append(
			<div className="ins-empty">
				{t(
					"inspector empty tree",
					"Sem página. Use a barra de endereço acima para abrir um site.",
				)}
			</div>,
		);
		return;
	}
	if (!treeCache.has("")) {
		if (fallbackPage) cacheFallbackLevel("");
		else fetchTree("");
	}
	$tree.append(renderNode("", 0));
}

/**
 * @param {string} path
 * @param {number} depth
 * @returns {HTMLElement}
 */
function renderNode(path, depth) {
	const entry = treeCache.get(path);
	const $wrap = (
		<div className="ins-node" style={`padding-left:${depth * 12}px`} />
	);

	if (!entry) {
		$wrap.append(
			<div className="ins-tree-row">
				<span className="icon codicon-loading ins-spin" />
			</div>,
		);
		return $wrap;
	}

	const self = entry.self;
	const hasChildren = (entry.total || 0) > 0;
	const isOpen = expanded.has(path);

	const $row = (
		<div
			className={`ins-tree-row${selectedPath === path ? " selected" : ""}`}
			role="button"
			onclick={() => selectNode(path)}
		>
			<span
				className={`icon ${
					hasChildren
						? isOpen
							? "codicon-chevron-down"
							: "codicon-chevron-right"
						: "codicon-blank"
				}`}
				onclick={(e) => {
					e.stopPropagation();
					toggleNode(path);
				}}
			/>
			<span className="ins-node-tag">{nodeLabel(self)}</span>
			{self?.text ? (
				<span className="ins-node-text">{self.text.slice(0, 60)}</span>
			) : null}
			<span
				className={`icon codicon-eye${highlightedPaths.has(path) ? " ins-hl-on" : ""}`}
				title={t("inspector highlight", "Realçar na página")}
				onclick={(e) => {
					e.stopPropagation();
					toggleHighlight(path);
				}}
			/>
		</div>
	);
	$wrap.append($row);

	if (isOpen && hasChildren) {
		for (const child of entry.children || []) {
			$wrap.append(renderNode(child.path, depth + 1));
		}
		if ((entry.total || 0) > (entry.children || []).length) {
			$wrap.append(
				<div
					className="ins-tree-more"
					style={`padding-left:${(depth + 1) * 12}px`}
				>
					+{entry.total - (entry.children || []).length}{" "}
					{t("inspector more nodes", "elementos")}
				</div>,
			);
		}
	}

	return $wrap;
}

/** @param {string} path */
function toggleNode(path) {
	if (expanded.has(path)) {
		expanded.delete(path);
		renderTree();
		return;
	}
	expanded.add(path);
	if (!treeCache.has(path)) fetchTree(path);
	else renderTree();
}

/** @param {string} path */
async function selectNode(path) {
	selectedPath = path;
	renderTree();
	if (fallbackPage && !activeInspectorSession()) {
		renderDetails(fallbackInspect(path));
		return;
	}
	try {
		const data = await sendInspectorCommand("inspect", { path });
		renderDetails(data);
	} catch (error) {
		if (fallbackPage) {
			renderDetails(fallbackInspect(path));
			return;
		}
		renderDetails(null);
	}
}

/** Builds inspect-style details from the raw-HTML document. */
function fallbackInspect(path) {
	const node = fallbackNodeAt(path);
	if (!node) return null;
	const html = (node.outerHTML || "").slice(0, 20000);
	return {
		self: {
			path,
			tag: node.tagName?.toLowerCase() || String(node.nodeName || "?"),
			id: node.id || "",
			classes: node.classList?.length
				? Array.prototype.join.call(node.classList, " ")
				: "",
			childCount: node.children ? node.children.length : 0,
			text: node.children?.length
				? ""
				: String(node.textContent || "")
						.trim()
						.slice(0, 120),
			attrs: fallbackAttrs(node),
		},
		html,
		htmlTruncated: (node.outerHTML || "").length > 20000,
		box: null,
		styles: null,
		fallback: true,
	};
}

/** @param {any} data */
function renderDetails(data) {
	if (!$details) return;
	$details.innerHTML = "";

	if (!activeInspectorSession()) {
		$details.classList.add("hidden");
		return;
	}
	$details.classList.remove("hidden");

	if (!data?.self) {
		$details.append(
			<div className="ins-empty">
				{t("inspector select node", "Toque num elemento da árvore")}
			</div>,
		);
		return;
	}

	const self = data.self;
	const attrs = Object.entries(self.attrs || {});
	const box = data.box || null;
	const styles = data.styles
		? Object.entries(data.styles).filter(([, value]) =>
				String(value || "").trim(),
			)
		: [];

	$details.append(
		<div className="ins-details-body">
			<div className="ins-details-head">
				<span className="ins-node-tag">{nodeLabel(self)}</span>
				{box ? (
					<span className="ins-box">
						{box.w}×{box.h} @ {box.x},{box.y}
					</span>
				) : (
					<span className="ins-box">
						{t("inspector source mode", "modo fonte (HTTP)")}
					</span>
				)}
				{!data.fallback && self.path ? (
					<span className="ins-details-tools">
						<span
							className="icon codicon-edit"
							title={t("inspector edit html", "Editar HTML")}
							onclick={() =>
								editNodeHtml(self.path, data.html || "", nodeLabel(self))
							}
						/>
						<span
							className="icon codicon-trash"
							title={t("inspector delete node", "Apagar elemento")}
							onclick={() => deleteNode(self.path)}
						/>
					</span>
				) : null}
			</div>
			<div className="ins-attrs">
				{attrs.length ? (
					attrs.map(([name, value]) => (
						<div className="ins-attr">
							<span
								className="ins-attr-body"
								onclick={() =>
									data.fallback
										? copyText(`${name}="${value}"`)
										: editAttribute(self.path, name, value)
								}
							>
								<span className="ins-attr-name">{name}</span>
								<span className="ins-attr-value">
									{String(value).slice(0, 120)}
								</span>
							</span>
							{!data.fallback ? (
								<span
									className="icon codicon-close ins-attr-del"
									title={t("inspector remove attr", "Remover atributo")}
									onclick={() => removeAttribute(self.path, name)}
								/>
							) : null}
						</div>
					))
				) : (
					<div className="ins-empty">
						{t("inspector no attrs", "Sem atributos")}
					</div>
				)}
			</div>
			{styles.length ? (
				<details className="ins-styles">
					<summary>{t("inspector styles", "Estilos computados")}</summary>
					{styles.slice(0, 28).map(([prop, value]) => (
						<div
							className="ins-style"
							onclick={() => copyText(`${prop}: ${value};`)}
						>
							<span className="ins-attr-name">{prop}</span>
							<span className="ins-attr-value">
								{String(value).slice(0, 100)}
							</span>
						</div>
					))}
				</details>
			) : null}
			{data.html ? (
				<details className="ins-html">
					<summary>
						{t("inspector html", "HTML")}
						{data.htmlTruncated ? " (…)" : ""}
					</summary>
					<pre className="ins-html-pre">{data.html}</pre>
					<div className="ins-details-actions">
						<button type="button" onclick={() => copyText(data.html)}>
							<span className="icon codicon-copy" />
							{t("inspector copy html", "Copiar HTML")}
						</button>
						<button
							type="button"
							onclick={async () => {
								const { insertIntoEditorFile } = await import(
									"lib/ai/editorBridge"
								);
								const result = await insertIntoEditorFile(
									window.editorManager,
									data.html,
								);
								toast(
									result?.ok
										? t("inspector inserted", "Inserido no editor")
										: result?.message ||
												t(
													"inspector insert failed",
													"Não foi possível inserir",
												),
									2500,
								);
							}}
						>
							<span className="icon codicon-export" />
							{t("inspector to editor", "Inserir no editor")}
						</button>
					</div>
				</details>
			) : null}
		</div>,
	);
}

// ---------------------------------------------------------------- console

function renderConsole() {
	if (!$console) return;
	$console.innerHTML = "";

	if (!consoleEntries.length) {
		$console.append(
			<div className="ins-empty">
				{t("inspector console empty", "Sem registos ainda")}
			</div>,
		);
		return;
	}
	for (const entry of consoleEntries.slice(-200)) {
		$console.append(
			<div
				className={`ins-console-entry level-${entry.level}`}
				onclick={() => copyText(entry.text)}
			>
				<span className="ins-console-level">
					{entry.level === "error" ? "✕" : entry.level === "warn" ? "⚠" : "›"}
				</span>
				<span className="ins-console-text">{entry.text}</span>
			</div>,
		);
	}
	$console.scrollTop = $console.scrollHeight;
}

/** @param {HTMLInputElement} $input */
async function runJs($input) {
	const code = $input?.value?.trim();
	if (!code) return;
	if (!activeInspectorSession()) {
		toast(t("inspector no session", "Abra uma página primeiro"), 2000);
		return;
	}
	// DevTools-style history: the code is recalled with ↑/↓ later
	if (consoleHistory[consoleHistory.length - 1] !== code) {
		consoleHistory.push(code);
		if (consoleHistory.length > 100) consoleHistory.shift();
	}
	consoleHistoryIndex = -1;
	consoleEntries.push({ level: "log", text: `› ${code}`, ts: Date.now() });
	renderConsole();
	try {
		const result = await evaluateInPage(code);
		consoleEntries.push({
			level: result?.ok ? "log" : "error",
			text: result?.ok
				? typeof result.value === "string"
					? result.value
					: JSON.stringify(result.value)?.slice(0, 2000) || "undefined"
				: `✕ ${result?.error}`,
			ts: Date.now(),
		});
	} catch (error) {
		consoleEntries.push({
			level: "error",
			text: `✕ ${error?.message || error}`,
			ts: Date.now(),
		});
	}
	if ($input) $input.value = "";
	updateBadges();
	renderConsole();
}

/**
 * Recalls console commands with ↑/↓ (DevTools behaviour): ↑ walks back
 * through the history, ↓ forward; past the end restores an empty input.
 * @param {HTMLInputElement} $input
 * @param {number} dir -1 = older, 1 = newer
 */
function consoleHistoryNav($input, dir) {
	if (!consoleHistory.length) return;
	if (consoleHistoryIndex === -1 && dir < 0) {
		consoleHistoryIndex = consoleHistory.length;
	}
	consoleHistoryIndex += dir;
	if (consoleHistoryIndex >= consoleHistory.length) {
		consoleHistoryIndex = -1;
		if ($input) $input.value = "";
		return;
	}
	if (consoleHistoryIndex < 0) consoleHistoryIndex = 0;
	if ($input) $input.value = consoleHistory[consoleHistoryIndex] ?? "";
}

// ---------------------------------------------------------------- network

function chipLabel(chip) {
	const map = {
		all: t("inspector net all", "Todas"),
		xhr: "XHR/JSON",
		js: "JS",
		css: "CSS",
		img: t("inspector net img", "Imagens"),
		font: t("inspector net font", "Fontes"),
	};
	return map[chip] || chip;
}

/** @param {string} chip */
function setNetworkFilter(chip) {
	networkFilter = chip;
	container?.querySelectorAll(".ins-chip").forEach(($el) => {
		$el.classList.toggle("active", $el.dataset.chip === chip);
	});
	renderNetwork();
}

function renderNetwork() {
	if (!$network) return;
	$network.innerHTML = "";

	if (!activeInspectorSession()) {
		$network.append(
			<div className="ins-empty">
				{t("inspector network empty", "Sem pedidos — abra uma página")}
			</div>,
		);
		return;
	}

	const rows = networkEntries.filter((entry) => {
		if (networkFilter !== "all" && networkType(entry) !== networkFilter) {
			return false;
		}
		if (!networkTextFilter) return true;
		const haystack =
			`${entry.method || ""} ${entry.url || ""} ${entry.status ?? ""}`.toLowerCase();
		return haystack.includes(networkTextFilter);
	});
	if (!rows.length) {
		$network.append(
			<div className="ins-empty">
				{t("inspector network none", "Nenhum pedido capturado")}
			</div>,
		);
		return;
	}

	for (const entry of rows.slice().reverse()) {
		$network.append(
			<div
				className={`ins-net-row type-${networkType(entry)}${entry.failed ? " failed" : ""}${entry.body ? " has-body" : ""}`}
				onclick={() => openNetworkBody(entry)}
			>
				<span className="ins-net-method">{entry.method}</span>
				<span className="ins-net-url">{networkLabel(entry.url)}</span>
				<span
					className={`ins-net-status${entry.ok || entry.status === 200 ? "" : " bad"}`}
				>
					{entry.failed ? "ERR" : entry.status || "—"}
				</span>
				<span className="ins-net-meta">
					{entry.ms ? `${entry.ms}ms` : ""}
					{entry.size
						? ` · ${
								entry.size > 1024
									? `${(entry.size / 1024).toFixed(1)}KB`
									: `${entry.size}B`
							}`
						: ""}
				</span>
			</div>,
		);
	}
}

/**
 * Opens the captured response body (DevTools "Response" tab). Entries
 * without a body only copy the URL.
 * @param {any} entry
 */
function openNetworkBody(entry) {
	if (!entry?.body) {
		copyText(entry?.url || "");
		toast(t("inspector no body", "Sem corpo capturado — url copiada"), 2000);
		return;
	}
	openSheet({
		title: `${entry.method || "GET"} ${networkLabel(entry.url || "")} — ${entry.failed ? "ERR" : (entry.status ?? "")}`,
		text: entry.body,
		readOnly: true,
		copyLabel: t("inspector copy body", "Copiar corpo"),
		note: entry.bodyTruncated
			? t("inspector body truncated", "corpo truncado")
			: "",
	});
}

// -------------------------------------------------------------- utilities

/** @param {string} path */
async function toggleHighlight(path) {
	try {
		if (highlightedPaths.has(path)) {
			await sendInspectorCommand("clearHighlight");
			highlightedPaths.delete(path);
		} else {
			await sendInspectorCommand("highlight", { path });
			highlightedPaths.clear();
			highlightedPaths.add(path);
		}
		renderTree();
	} catch (error) {
		toast(String(error?.message || error), 2000);
	}
}

async function clearHighlight() {
	highlightedPaths.clear();
	try {
		await sendInspectorCommand("clearHighlight");
	} catch {
		/* session may be gone */
	}
	renderTree();
}

// ------------------------------------------------------------ pick mode

/** Toggles the DevTools-style element picker on the live page. */
async function togglePickMode() {
	if (!activeInspectorSession()) {
		toast(t("inspector live only", "Requer página viva (sessão activa)"), 2000);
		return;
	}
	const next = !pickMode;
	try {
		await sendInspectorCommand("setPickMode", { on: next });
		setPickModeUi(next);
		if (next) {
			toast(
				t(
					"inspector pick hint",
					"Toque num elemento na página para o inspecionar",
				),
				3000,
			);
		}
	} catch (error) {
		setPickModeUi(false);
		toast(String(error?.message || error), 2500);
	}
}

/** Syncs the toolbar button with the pick-mode state. */
function setPickModeUi(on) {
	pickMode = on;
	$pick?.classList.toggle("ins-btn-on", on);
}

// ---------------------------------------------------------- bottom sheet

function closeSheet() {
	if ($sheet) {
		$sheet.remove();
		$sheet = null;
	}
}

/**
 * Bottom-sheet overlay with an editable/readonly textarea — shared by the
 * network response viewer and the live HTML editor.
 * @param {{title: string, text: string, readOnly?: boolean, applyLabel?: string, copyLabel?: string, note?: string, onApply?: (value: string) => void}} options
 */
function openSheet(options) {
	closeSheet();
	if (!container) return;
	const $area = <textarea className="ins-sheet-text" spellcheck={false} />;
	if (options.readOnly) $area.readOnly = true;
	$area.value = options.text ?? "";

	const $el = (
		<div
			className="ins-sheet-overlay"
			onclick={(e) => {
				if (e.target === e.currentTarget) closeSheet();
			}}
		>
			<div className="ins-sheet">
				<div className="ins-sheet-head">
					<span className="ins-sheet-title">{options.title}</span>
					<span
						className="icon codicon-close"
						title={t("inspector close", "Fechar")}
						onclick={closeSheet}
					/>
				</div>
				{$area}
				{options.note ? (
					<div className="ins-sheet-note">{options.note}</div>
				) : null}
				<div className="ins-sheet-actions">
					{options.copyLabel ? (
						<button type="button" onclick={() => copyText($area.value)}>
							<span className="icon codicon-copy" />
							{options.copyLabel}
						</button>
					) : null}
					{options.applyLabel && options.onApply ? (
						<button
							type="button"
							className="ins-sheet-apply"
							onclick={() => options.onApply($area.value)}
						>
							<span className="icon codicon-check" />
							{options.applyLabel}
						</button>
					) : null}
				</div>
			</div>
		</div>
	);
	container.append($el);
	$sheet = $el;
}

// ------------------------------------------------------- live DOM editing

/**
 * Edits one attribute of the selected node in the live page. An empty
 * value removes the attribute.
 * @param {string} path
 * @param {string} name
 * @param {string} value
 */
async function editAttribute(path, name, value) {
	if (!activeInspectorSession()) {
		toast(t("inspector live only", "Requer página viva (sessão activa)"), 2000);
		return;
	}
	const next = await prompt(
		`${t("inspector edit attr", "Editar atributo")} — ${name}`,
		String(value ?? ""),
		"text",
	);
	if (next === null || next === undefined) return;
	try {
		await sendInspectorCommand("setAttr", { path, name, value: next });
		toast(
			next === ""
				? t("inspector attr removed", "Atributo removido")
				: t("inspector attr saved", "Atributo atualizado"),
			1800,
		);
		fetchTree(path);
		selectNode(path);
	} catch (error) {
		toast(
			`${t("inspector edit failed", "Falhou ao editar")}: ${error?.message || error}`,
			2500,
		);
	}
}

/** Removes an attribute of the selected node in the live page. */
async function removeAttribute(path, name) {
	if (!activeInspectorSession()) {
		toast(t("inspector live only", "Requer página viva (sessão activa)"), 2000);
		return;
	}
	try {
		await sendInspectorCommand("setAttr", { path, name, value: "" });
		toast(t("inspector attr removed", "Atributo removido"), 1800);
		fetchTree(path);
		selectNode(path);
	} catch (error) {
		toast(
			`${t("inspector edit failed", "Falhou ao editar")}: ${error?.message || error}`,
			2500,
		);
	}
}

/** Deletes the selected node from the live page (with confirmation). */
async function deleteNode(path) {
	if (!activeInspectorSession()) {
		toast(t("inspector live only", "Requer página viva (sessão activa)"), 2000);
		return;
	}
	const ok = await confirm(
		t("inspector confirm delete", "Apagar este elemento da página?"),
	);
	if (!ok) return;
	try {
		await sendInspectorCommand("deleteNode", { path });
		toast(t("inspector node deleted", "Elemento apagado"), 1800);
		selectedPath = null;
		renderDetails(null);
		treeCache.clear();
		fetchTree("");
	} catch (error) {
		toast(
			`${t("inspector edit failed", "Falhou ao editar")}: ${error?.message || error}`,
			2500,
		);
	}
}

/** Opens the HTML editor for the selected node (applies to the live page). */
function editNodeHtml(path, html, label) {
	if (!activeInspectorSession()) {
		toast(t("inspector live only", "Requer página viva (sessão activa)"), 2000);
		return;
	}
	openSheet({
		title: `${t("inspector edit html", "Editar HTML")} — ${label || path}`,
		text: html,
		applyLabel: t("inspector apply", "Aplicar"),
		copyLabel: t("inspector copy html", "Copiar HTML"),
		onApply: async (value) => {
			try {
				await sendInspectorCommand("setOuterHTML", { path, html: value });
				closeSheet();
				toast(t("inspector html applied", "HTML aplicado"), 1800);
				treeCache.clear();
				fetchTree("");
				selectNode(path);
			} catch (error) {
				toast(
					`${t("inspector edit failed", "Falhou ao editar")}: ${error?.message || error}`,
					3000,
				);
			}
		},
	});
}

/** @param {HTMLInputElement} $input */
async function searchDom($input) {
	const query = $input?.value?.trim();
	if (!query) return;
	// «text:» prefix forces the full-text search; otherwise a CSS
	// selector is tried first and the text search kicks in as a
	// fallback when the selector matches nothing
	const forcedText = query.toLowerCase().startsWith("text:")
		? query.slice(5).trim()
		: null;
	let matches = [];
	let total = 0;

	if (!forcedText) {
		if (fallbackPage && !activeInspectorSession()) {
			try {
				const nodes = Array.prototype.slice.call(
					fallbackPage.doc.querySelectorAll(query),
				);
				total = nodes.length;
				matches = nodes.slice(0, 100).map(fallbackDescribeForSearch);
			} catch {
				matches = [];
			}
		} else if (activeInspectorSession()) {
			try {
				const data = await sendInspectorCommand("searchDom", {
					selector: query,
				});
				matches = data?.matches || [];
				total = data?.total || matches.length;
			} catch {
				matches = [];
			}
		}
	}

	if (!matches.length) {
		// selector found nothing (invalid or empty) — search the text
		const needle = forcedText ?? query;
		if (fallbackPage && !activeInspectorSession()) {
			matches = fallbackTextSearch(needle);
		} else if (activeInspectorSession()) {
			try {
				const data = await sendInspectorCommand("searchText", {
					text: needle,
				});
				matches = data?.matches || [];
			} catch (error) {
				toast(String(error?.message || error), 2500);
				return;
			}
		}
		if (matches.length) {
			setStatus(
				`${matches.length} ${t("inspector text matches", "correspondências de texto")}`,
			);
		}
	} else {
		setStatus(
			`${matches.length} ${t("inspector matches", "correspondências")}`,
		);
	}

	if (!matches.length) {
		toast(t("inspector no matches", "Sem correspondências"), 2000);
		return;
	}
	await applySearchMatches(matches, total || matches.length);
}

/** Full-text search over the fallback DOMParser document. */
function fallbackTextSearch(needle) {
	const needleLower = String(needle || "").toLowerCase();
	const matches = [];
	if (!needleLower || !fallbackPage?.doc) return matches;
	try {
		const walker = fallbackPage.doc.createTreeWalker(
			fallbackPage.doc.body || fallbackPage.doc.documentElement,
			NodeFilter.SHOW_TEXT,
			null,
		);
		const seen = new Set();
		while (walker.nextNode() && matches.length < 100) {
			const value = walker.currentNode.nodeValue || "";
			if (!value.toLowerCase().includes(needleLower)) continue;
			const el = walker.currentNode.parentElement;
			if (!el) continue;
			const info = fallbackDescribeForSearch(el);
			if (info?.path && !seen.has(info.path)) {
				seen.add(info.path);
				matches.push(info);
			}
		}
	} catch {
		/* ignore */
	}
	return matches;
}

/**
 * Expands the tree to the first match and selects it (shared by the live
 * and fallback search paths).
 * @param {any[]} matches
 * @param {number} total
 */
async function applySearchMatches(matches, total) {
	if (!matches.length) {
		toast(t("inspector no matches", "Sem correspondências"), 2000);
		return;
	}
	expanded.clear();
	treeCache.clear();
	const first = matches[0];
	const parts = String(first.path || "")
		.split(".")
		.filter(Boolean);
	let acc = "";
	for (const part of parts) {
		acc = acc ? `${acc}.${part}` : part;
		expanded.add(acc);
	}
	renderTree();
	// lazily load each level of the chain, then select the target
	for (let i = 0; i < parts.length; i += 1) {
		const parentPath = parts.slice(0, i).join(".");
		// eslint-disable-next-line no-await-in-loop
		await fetchTree(parentPath);
	}
	selectNode(first.path);
}

/** describe() shape for a fallback search match (path computed here). */
function fallbackDescribeForSearch(node) {
	const path = fallbackPathOf(node);
	return {
		path,
		tag: node.tagName?.toLowerCase() || String(node.nodeName || "?"),
		id: node.id || "",
		classes: node.classList?.length
			? Array.prototype.join.call(node.classList, " ")
			: "",
		childCount: node.children ? node.children.length : 0,
		text: node.children?.length
			? ""
			: String(node.textContent || "")
					.trim()
					.slice(0, 120),
		attrs: fallbackAttrs(node),
	};
}

/** Index-chain path of a node inside the fallback document. */
function fallbackPathOf(node) {
	const parts = [];
	let cursor = node;
	while (cursor && cursor !== fallbackPage?.doc) {
		const parent = cursor.parentElement;
		if (!parent) return null;
		parts.unshift(
			String(Array.prototype.indexOf.call(parent.children, cursor)),
		);
		cursor = parent;
	}
	return parts.join(".");
}

function onSelected() {
	if (activeInspectorSession() && !treeCache.has("")) {
		fetchTree("");
	}
}

/**
 * Opens the inspector at `url` — used by the native preview screen's
 * "Inspect" menu and by intents (xcoder_tool extras).
 * @param {string} url
 */
export async function openInspectorWith(url) {
	openInspectorPage();
	if (!$url) return;
	$url.value = url;
	switchTab("elements");
	await go();
}
/**
 * Opens the tool as an independent full-screen page (fora da
 * sidebar e da janela flutuante) — results always visible.
 * @returns {HTMLElement} the page element
 */
export function openInspectorPage() {
	return openToolPage({
		id: "inspector-page",
		titleKey: "inspector",
		title: "Inspector",
		className: "ins-app",
		build: initApp,
	});
}
