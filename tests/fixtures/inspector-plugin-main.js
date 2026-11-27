// SNAPSHOT of carsaimz/xcoder-plugins plugins/inspector/main.js @ 1.2.0 (2026-11-27).
// Refresh this file when the plugin updates — the E2E test prefers the sibling
// repo checkout when present and falls back to this fixture in CI.
(function () {
	"use strict";
	var xcoder = window.xcoder;
	if (!xcoder || typeof xcoder.setPluginInit !== "function") return;

	var PLUGIN_ID = "xcoder.inspector";
	var CSS_ID = PLUGIN_ID.replace(/\./g, "-") + "-css";
	var PAGE_ID = "plugin-inspector";

	var page = null;
	var root = null;
	var $url = null;
	var $status = null;
	var $tree = null;
	var $console = null;
	var $network = null;
	var $storage = null;
	var $storageFilter = null;
	var $netFilter = null;
	var $searchOut = null;
	var $searchIn = null;
	var $consoleIn = null;
	var activeTab = "elements";
	var busy = false;

	var treeCache = new Map(); // path -> { self, children, total }
	var consoleLog = [];
	var networkLog = [];
	var storageData = null;
	var storageFilter = "local";
	var netFilterType = "all";
	var consoleFilter = "all";
	var consoleCount = 0;
	var networkCount = 0;
	var expanded = new Set([""]);

	function t(key, fallback) {
		try {
			return (window.strings && window.strings[key]) || fallback;
		} catch (e) {
			return fallback;
		}
	}

	function normalizeAddress(value) {
		var url = String(value || "").trim();
		if (!url) return null;
		if (/^https?:\/\//i.test(url)) return url;
		if (/^localhost(:\d+)?(\/|$)/i.test(url) || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/|$)/.test(url)) {
			return "http://" + url;
		}
		return "https://" + url;
	}

	function el(tag, className, text) {
		var node = document.createElement(tag);
		if (className) node.className = className;
		if (text != null) node.textContent = text;
		return node;
	}

	function icon(name) {
		return el("span", "icon codicon-" + name);
	}

	function injectStyle() {
		if (document.getElementById(CSS_ID)) return;
		var css = [
			".xin-tool{flex:1;width:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;font-size:14px;}",
			".xin-urlbar{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--hairline,var(--border-color));}",
			".xin-urlbar input{flex:1;min-width:0;padding:10px 12px;border-radius:var(--radius-sm,8px);border:1px solid var(--hairline,var(--border-color));background:var(--surface-2,var(--primary-color));color:var(--primary-text-color);font-size:14px;outline:none;}",
			".xin-urlbar .icon{padding:8px;opacity:.8;}",
			".xin-status{padding:7px 12px;font-size:12.5px;opacity:.75;border-bottom:1px solid var(--hairline,var(--border-color));min-height:18px;}",
			".xin-tabs{display:flex;flex-wrap:wrap;gap:2px 8px;padding:8px 10px 0;row-gap:2px;}",
			".xin-tab{display:flex;align-items:center;gap:5px;padding:7px 9px;border:none;background:none;color:var(--primary-text-color);opacity:.6;font-size:12.5px;border-bottom:2px solid transparent;}",
			".xin-tab.active{opacity:1;border-bottom-color:var(--primary-color,#4f8cff);}",
			".xin-tab .xin-badge{background:var(--primary-color,#4f8cff);color:#fff;border-radius:var(--radius-full,999px);font-size:11px;padding:1px 7px;}",
			".xin-panel{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;padding:10px 12px 24px;}",
			".xin-panel.hidden{display:none;}",
			".xin-node{display:flex;align-items:center;gap:4px;padding:4px 6px;border-radius:6px;font-size:12.5px;font-family:monospace;min-height:28px;}",
			".xin-node:active{background:var(--surface-active,var(--active-color));}",
			".xin-chevron{opacity:.5;font-size:12px;flex:0 0 14px;}",
			".xin-chevron.hidden{visibility:hidden;}",
			".xin-tag{color:var(--primary-color,#4f8cff);word-break:break-all;}",
			".xin-tag-id{opacity:.75;}",
			".xin-tag-class{opacity:.6;}",
			".xin-text{opacity:.7;white-space:pre-wrap;word-break:break-word;}",
			".xin-console-line{display:flex;gap:8px;padding:5px 8px;border-bottom:1px solid var(--hairline,var(--border-color));font-family:monospace;font-size:12px;word-break:break-word;}",
		".xin-console-ts{opacity:.45;flex:0 0 auto;}",
		".xin-level-system{opacity:.55;font-style:italic;}",
			".xin-level-log{opacity:.85;}",
			".xin-level-warn{color:#e2b341;}",
			".xin-level-error{color:#f48771;}",
			".xin-level-info{color:#75beff;}",
			".xin-level-debug{opacity:.55;}",
			".xin-console-inputrow{display:flex;gap:6px;padding:8px 0 0;position:sticky;bottom:0;background:var(--secondary-color,#1e1e1e);}",
			".xin-console-inputrow input{flex:1;min-width:0;padding:9px 10px;border-radius:var(--radius-sm,8px);border:1px solid var(--hairline,var(--border-color));background:var(--surface-2,var(--primary-color));color:var(--primary-text-color);font-family:monospace;font-size:12.5px;outline:none;}",
			".xin-btn{display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:var(--radius-sm,8px);border:1px solid var(--hairline,var(--border-color));background:var(--surface-1,var(--secondary-color));color:var(--primary-text-color);font-size:12.5px;}",
			".xin-chiprow{display:flex;gap:6px;flex-wrap:wrap;padding-bottom:10px;}",
			".xin-chip{padding:4px 10px;border-radius:var(--radius-full,999px);border:1px solid var(--hairline,var(--border-color));background:none;color:var(--primary-text-color);font-size:12px;opacity:.6;}",
			".xin-chip.active{opacity:1;background:var(--surface-1,var(--secondary-color));}",
			".xin-net{display:flex;gap:8px;align-items:baseline;padding:6px 4px;border-bottom:1px solid var(--hairline,var(--border-color));font-family:monospace;font-size:12px;word-break:break-all;}",
			".xin-net-method{opacity:.6;flex:0 0 auto;}",
			".xin-net-status{flex:0 0 auto;font-weight:700;}",
			".xin-net-ok{color:#4ec994;}.xin-net-fail{color:#f48771;}",
			".xin-net-url{flex:1;}",
			".xin-net-ms{opacity:.5;flex:0 0 auto;}",
			".xin-searchrow{display:flex;gap:8px;padding:10px 12px;border-bottom:1px solid var(--hairline,var(--border-color));}",
			".xin-storage-full{font-family:monospace;font-size:11.5px;opacity:.85;word-break:break-all;padding:6px 10px;background:var(--surface-1,var(--secondary-color));border-radius:var(--radius-sm,8px);margin-top:4px;max-height:140px;overflow:auto;}",
			".xin-empty{padding:18px 12px;text-align:center;opacity:.6;font-size:13px;}",
			".xin-searchrow input{flex:1;min-width:0;padding:9px 10px;border-radius:var(--radius-sm,8px);border:1px solid var(--hairline,var(--border-color));background:var(--surface-2,var(--primary-color));color:var(--primary-text-color);font-size:13px;outline:none;}",
			".xin-empty{padding:24px 12px;opacity:.5;text-align:center;font-size:13px;}",
			".xin-inspectbox{background:var(--surface-2,var(--primary-color));border:1px solid var(--hairline,var(--border-color));border-radius:var(--radius-sm,8px);padding:10px;font-family:monospace;font-size:12px;white-space:pre-wrap;word-break:break-word;}",
		].join("\n");
		var style = document.createElement("style");
		style.id = CSS_ID;
		style.textContent = css;
		document.head.appendChild(style);
	}

	function nodeLabel(node) {
		if (!node) return "?";
		var label = node.tag || node.label || "?";
		var parts = [];
		if (node.id) parts.push("#" + node.id);
		var cls = node.classes || node.class;
		if (cls) parts.push("." + String(cls).trim().split(/\s+/).join("."));
		if (node.text && label === "#text") return '"' + String(node.text).slice(0, 60) + '"';
		return parts.length ? label + " " + parts.join("") : label;
	}

	function setStatus(text, busyNow) {
		if (!$status) return;
		$status.textContent = text;
		$status.dataset.busy = busyNow ? "1" : "";
	}

	function makeTab(name, iconName, label) {
		var tab = el("button", "xin-tab" + (name === activeTab ? " active" : ""));
		tab.type = "button";
		tab.dataset.tab = name;
		tab.appendChild(icon(iconName));
		tab.appendChild(document.createTextNode(label));
		var badge = el("span", "xin-badge hidden");
		badge.dataset.badge = name;
		tab.appendChild(badge);
		tab.addEventListener("click", function () {
			switchTab(name);
		});
		return tab;
	}

	function switchTab(tab) {
		activeTab = tab;
		if (!root) return;
		root.querySelectorAll(".xin-tab").forEach(function ($tab) {
			$tab.classList.toggle("active", $tab.dataset.tab === tab);
		});
		root.querySelectorAll(".xin-panel").forEach(function ($panel) {
			$panel.classList.toggle("hidden", $panel.dataset.panel !== tab);
		});
		// every panel re-renders on open — a panel that captured entries while
		// hidden (or whose render was pending) must never show stale content
		if (tab === "storage") {
			fetchStorage();
		} else if (tab === "elements") {
			refreshBadges();
			renderTree();
		} else if (tab === "console") {
			renderConsole();
			refreshBadges();
		} else if (tab === "network") {
			renderNetwork();
			refreshBadges();
		}
	}

	function refreshBadges() {
		if (!root) return;
		root.querySelectorAll("[data-badge]").forEach(function ($badge) {
			var name = $badge.dataset.badge;
			var count = 0;
			if (name === "console") count = consoleCount;
			else if (name === "network") count = networkCount;
			else if (name === "storage" && storageData) {
				count = Object.keys(storageData.local || {}).length +
					Object.keys(storageData.session || {}).length +
					(storageData.cookies || []).length;
			}
			$badge.textContent = count ? String(count) : "";
			$badge.classList.toggle("hidden", !count);
		});
	}

	function buildRoot() {
		root = el("div", "container xin-tool");

		var urlbar = el("div", "xin-urlbar");
		$url = el("input");
		$url.type = "url";
		$url.placeholder = "https://exemplo.com";
		$url.spellcheck = false;
		$url.setAttribute("enterkeyhint", "go");
		$url.addEventListener("keydown", function (e) {
			if (e.key === "Enter") inspect();
		});
		var go = icon("search");
		go.setAttribute("role", "button");
		go.addEventListener("click", function () {
			inspect();
		});
		var reload = icon("refresh");
		reload.setAttribute("role", "button");
		reload.addEventListener("click", function () {
			xcoder.require("webInspector").reloadInspectorSession();
		});
		urlbar.appendChild($url);
		urlbar.appendChild(reload);
		urlbar.appendChild(go);

		$status = el("div", "xin-status", t("inspector idle", "Introduza um endereço para inspecionar"));

		var tabs = el("div", "xin-tabs");
		tabs.appendChild(makeTab("elements", "code", t("inspector elements", "Elementos")));
		tabs.appendChild(makeTab("console", "debug-console", t("inspector console", "Consola")));
		tabs.appendChild(makeTab("network", "broadcast", t("inspector network", "Rede")));
		tabs.appendChild(makeTab("search", "search", t("inspector search", "Procurar")));
		tabs.appendChild(makeTab("storage", "database", t("inspector storage", "Armazenamento")));

		var elementsPanel = el("div", "xin-panel");
		elementsPanel.dataset.panel = "elements";
		$tree = el("div", "xin-tree");
		elementsPanel.appendChild($tree);

		var consolePanel = el("div", "xin-panel hidden");
		consolePanel.dataset.panel = "console";
		var consoleHead = el("div", "xin-chiprow");
		["all", "log", "info", "warn", "error"].forEach(function (level) {
			var chip = el("button", "xin-chip" + (level === "all" ? " active" : ""));
			chip.type = "button";
			chip.textContent = t("inspector console " + level, level);
			chip.dataset.level = level;
			chip.addEventListener("click", function () {
				consoleFilter = level;
				consoleHead.querySelectorAll(".xin-chip").forEach(function ($chip) {
					$chip.classList.toggle("active", $chip.dataset.level === level);
				});
				renderConsole();
			});
			consoleHead.appendChild(chip);
		});
		var clearBtn = el("button", "xin-btn");
		clearBtn.type = "button";
		clearBtn.appendChild(icon("clear-all"));
		clearBtn.appendChild(document.createTextNode(t("inspector clear console", "Limpar")));
		clearBtn.addEventListener("click", function () {
			consoleLog = [];
			consoleCount = 0;
			renderConsole();
			refreshBadges();
		});
		consoleHead.appendChild(clearBtn);
		consolePanel.appendChild(consoleHead);
		$console = el("div", "xin-console-out");
		consolePanel.appendChild($console);
		var inputRow = el("div", "xin-console-inputrow");
		$consoleIn = el("input");
		$consoleIn.placeholder = t("inspector run js", "Executar JS na página…");
		$consoleIn.addEventListener("keydown", function (e) {
			if (e.key === "Enter") runConsole();
		});
		var runBtn = el("button", "xin-btn");
		runBtn.type = "button";
		runBtn.appendChild(icon("play"));
		runBtn.addEventListener("click", runConsole);
		inputRow.appendChild($consoleIn);
		inputRow.appendChild(runBtn);
		consolePanel.appendChild(inputRow);

		var networkPanel = el("div", "xin-panel hidden");
		networkPanel.dataset.panel = "network";
		$netFilter = el("div", "xin-chiprow");
		["all", "xhr", "js", "css", "img", "font", "doc", "other"].forEach(function (type) {
			var chip = el("button", "xin-chip" + (type === "all" ? " active" : ""));
			chip.type = "button";
			chip.textContent = type;
			chip.dataset.type = type;
			chip.addEventListener("click", function () {
				netFilterType = type;
				$netFilter.querySelectorAll(".xin-chip").forEach(function ($chip) {
					$chip.classList.toggle("active", $chip.dataset.type === type);
				});
				renderNetwork();
			});
			$netFilter.appendChild(chip);
		});
		networkPanel.appendChild($netFilter);
		$network = el("div", "xin-net-out");
		networkPanel.appendChild($network);

		var searchPanel = el("div", "xin-panel hidden");
		searchPanel.dataset.panel = "search";
		var searchRow = el("div", "xin-searchrow");
		$searchIn = el("input");
		$searchIn.placeholder = t("inspector search hint", "Seletor CSS (ex.: .btn, #app, div a)");
		$searchIn.addEventListener("keydown", function (e) {
			if (e.key === "Enter") searchDom();
		});
		var findBtn = el("button", "xin-btn");
		findBtn.type = "button";
		findBtn.appendChild(icon("search"));
		findBtn.addEventListener("click", searchDom);
		searchRow.appendChild($searchIn);
		searchRow.appendChild(findBtn);
		searchPanel.appendChild(searchRow);
		$searchOut = el("div", "xin-search-out");
		searchPanel.appendChild($searchOut);

		root.appendChild(urlbar);
		root.appendChild($status);
		root.appendChild(tabs);
		root.appendChild(elementsPanel);
		root.appendChild(consolePanel);
		root.appendChild(networkPanel);
		root.appendChild(searchPanel);

		var storagePanel = el("div", "xin-panel hidden");
		storagePanel.dataset.panel = "storage";
		$storageFilter = el("div", "xin-chiprow");
		[
			["local", "localStorage"],
			["session", "sessionStorage"],
			["cookies", "Cookies"],
		].forEach(function (pair) {
			var type = pair[0];
			var chip = el("button", "xin-chip" + (type === storageFilter ? " active" : ""));
			chip.type = "button";
			chip.textContent = t("inspector storage " + type, pair[1]);
			chip.dataset.type = type;
			chip.addEventListener("click", function () {
				storageFilter = type;
				$storageFilter.querySelectorAll(".xin-chip").forEach(function ($chip) {
					$chip.classList.toggle("active", $chip.dataset.type === type);
				});
				renderStorage();
			});
			$storageFilter.appendChild(chip);
		});
		var storageRefresh = el("button", "xin-btn");
		storageRefresh.type = "button";
		storageRefresh.appendChild(icon("refresh"));
		storageRefresh.appendChild(document.createTextNode(t("inspector storage refresh", "Atualizar")));
		storageRefresh.addEventListener("click", fetchStorage);
		$storageFilter.appendChild(storageRefresh);
		storagePanel.appendChild($storageFilter);
		$storage = el("div", "xin-storage-out");
		storagePanel.appendChild($storage);
		root.appendChild(storagePanel);
	}

	// ---------------------------------------------------------------- events

	function handleEvent(event, data) {
		try {
			if (event === "pageFinished") {
				treeCache.clear();
				expanded = new Set([""]);
				storageData = null;
				// a system line keeps the Consola alive even for pages that
				// never log — the user always sees proof of capture
				consoleLog.push({
					level: "system",
					text: "▸ " + ((data && (data.title || data.url)) || ""),
					ts: Date.now(),
				});
				consoleCount++;
				if (activeTab === "console") renderConsole();
				if (activeTab === "elements") renderTree();
				if (activeTab === "storage") fetchStorage();
				refreshBadges();
				setStatus(t("inspector loaded", "Página carregada — toque para expandir"));
			} else if (event === "pageClosed") {
				treeCache.clear();
				setStatus(t("inspector closed", "Sessão fechada"));
				if (activeTab === "elements") renderTree();
			} else if (event === "inspectorMessage") {
				if (data && data.cmd === "console" && data.data) {
					consoleLog.push(data.data);
					consoleCount++;
					if (activeTab === "console") renderConsole();
					refreshBadges();
				} else if (data && data.cmd === "network" && data.data) {
					var entry = data.data;
					var webInspector = xcoder.require("webInspector");
					if (webInspector.networkType) entry.__type = webInspector.networkType(entry);
					networkLog.push(entry);
					networkCount++;
					if (activeTab === "network") renderNetwork();
					refreshBadges();
				}
			}
		} catch (e) {
			console.error(e);
		}
	}

	// -------------------------------------------------------------- elements

	function loadNode(path) {
		var webInspector = xcoder.require("webInspector");
		return webInspector.sendInspectorCommand("getTree", { path: path }).then(function (data) {
			treeCache.set(path, data);
			return data;
		});
	}

	function renderTree() {
		if (!$tree) return;
		var webInspector = xcoder.require("webInspector");
		if (!webInspector.activeInspectorSession()) {
			$tree.replaceChildren(el("div", "xin-empty", t("inspector no session", "Abra um site para inspecionar")));
			return;
		}
		if (!treeCache.has("")) {
			$tree.replaceChildren(el("div", "xin-empty", t("inspector loading", "A abrir página…")));
			loadNode("").then(renderTree).catch(function (e) {
				setStatus(String((e && e.message) || e));
				var box = el("div", "xin-empty");
				box.appendChild(el("div", "", t("inspector tree error", "Não foi possível ler a árvore da página")));
				var retry = el("button", "xin-btn");
				retry.type = "button";
				retry.appendChild(icon("refresh"));
				retry.appendChild(document.createTextNode(t("inspector tree retry", "Tentar de novo")));
				retry.addEventListener("click", function () {
					treeCache.clear();
					renderTree();
				});
				box.appendChild(retry);
				$tree.replaceChildren(box);
			});
			return;
		}
		$tree.replaceChildren();
		$tree.appendChild(buildNode("", 0));
		var data = treeCache.get("");
		(data.children || []).forEach(function (child) {
			$tree.appendChild(buildNode(child.path, 1));
		});
	}

	function buildNode(path, depth) {
		var data = treeCache.get(path);
		var self = data ? data.self : null;
		var row = el("div", "xin-node");
		row.style.paddingLeft = depth * 12 + "px";
		var chevron = el("span", "xin-chevron icon codicon-chevron-right");
		var isText = self && self.kind === "text";
		var hasChildren = !isText && data && data.total > 0;
		if (!hasChildren) chevron.classList.add("hidden");
		if (expanded.has(path)) chevron.classList.add("codicon-chevron-down");
		row.appendChild(chevron);
		var label = el("span", isText ? "xin-text" : "xin-tag", self ? nodeLabel(self) : "?");
		row.appendChild(label);
		row.addEventListener("click", function () {
			if (isText) {
				inspectNode(path);
				return;
			}
			if (expanded.has(path)) {
				expanded.delete(path);
				collapseChildren(path);
				renderTree();
			} else {
				expanded.add(path);
				if (!treeCache.has(path)) {
					loadNode(path)
						.then(function () {
							renderTree();
						})
						.catch(function (e) {
							setStatus(String((e && e.message) || e));
						});
				} else {
					renderTree();
				}
			}
		});
		row.addEventListener("contextmenu", function () {
			inspectNode(path);
		});
		return row;
	}

	function collapseChildren(path) {
		for (var key of Array.from(expanded)) {
			if (key !== path && key.indexOf(path + ".") === 0) expanded.delete(key);
		}
	}

	function inspectNode(path) {
		var webInspector = xcoder.require("webInspector");
		webInspector
			.sendInspectorCommand("inspect", { path: path })
			.then(function (data) {
				if (!data) return;
				$searchOut.replaceChildren();
				var box = el("div", "xin-inspectbox");
				var styles = data.styles || {};
				var lines = [
					nodeLabel(data.self),
					"box: " + data.box.w + "×" + data.box.h + " @ " + data.box.x + "," + data.box.y,
					"",
					"--- " + t("inspector styles", "Estilos") + " ---",
				];
				Object.keys(styles).forEach(function (prop) {
					if (styles[prop]) lines.push(prop + ": " + styles[prop]);
				});
				box.textContent = lines.join("\n");
				$searchOut.appendChild(box);
				if (data.html) {
					var htmlBox = el("div", "xin-inspectbox");
					htmlBox.style.marginTop = "10px";
					htmlBox.textContent = (data.htmlTruncated ? "… " : "") + data.html;
					$searchOut.appendChild(htmlBox);
				}
				switchTab("search");
			})
			.catch(function (e) {
				setStatus(String((e && e.message) || e));
			});
	}

	// --------------------------------------------------------------- console

	function consoleTs(entry) {
		if (!entry || !entry.ts) return "";
		var d = new Date(entry.ts);
		var pad = function (n) { return (n < 10 ? "0" : "") + n; };
		return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
	}

	function renderConsole() {
		if (!$console) return;
		var rows = consoleLog
			.filter(function (entry) {
				var level = entry.level || "log";
				return consoleFilter === "all" || level === consoleFilter ||
					(consoleFilter === "warn" && level === "system");
			})
			.map(function (entry) {
				var level = entry.level || "log";
				var row = el("div", "xin-console-line xin-level-" + level);
				var ts = el("span", "xin-console-ts", consoleTs(entry));
				row.appendChild(ts);
				row.appendChild(el("span", "xin-level-" + level, entry.text || ""));
				return row;
			});
		if (!rows.length) {
			rows = [el("div", "xin-empty", t("inspector console empty", "Sem mensagens ainda"))];
		}
		$console.replaceChildren.apply($console, rows);
		$console.scrollTop = $console.scrollHeight;
	}

	// ---------------------------------------------------------------- storage

	/** Reads localStorage + sessionStorage + cookies from the page in one
	 * evaluateInPage call (DevTools Application tab parity). Keys never
	 * leave the device — they are rendered in the plugin UI only. */
	function fetchStorage() {
		var webInspector = xcoder.require("webInspector");
		var code =
			"(function(){var out={local:{},session:{},cookies:[]};" +
			"try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);out.local[k]=String(localStorage.getItem(k));}}catch(e){}" +
			"try{for(var j=0;j<sessionStorage.length;j++){var sk=sessionStorage.key(j);out.session[sk]=String(sessionStorage.getItem(sk));}}catch(e){}" +
			"try{out.cookies=document.cookie?document.cookie.split('; ').filter(Boolean):[];}catch(e){}" +
			"return JSON.stringify(out);})()";
		webInspector
			.evaluateInPage(code)
			.then(function (result) {
				if (result && result.ok) {
					try {
						storageData = JSON.parse(result.value);
					} catch (e) {
						storageData = null;
						setStatus(t("inspector storage failed", "Não foi possível ler o armazenamento"));
					}
				} else {
					storageData = null;
				}
				renderStorage();
				refreshBadges();
			})
			.catch(function (e) {
				setStatus(String((e && e.message) || e));
			});
	}

	/** Removes one entry from localStorage/sessionStorage inside the page. */
	function removeStorageItem(kind, key) {
		var webInspector = xcoder.require("webInspector");
		var code =
			"(function(){try{" +
			(kind === "session" ? "sessionStorage" : "localStorage") +
			".removeItem(" + JSON.stringify(key) + ");return 'ok'}catch(e){return 'fail'}})()";
		webInspector
			.evaluateInPage(code)
			.then(function () {
				fetchStorage();
			})
			.catch(function (e) {
				setStatus(String((e && e.message) || e));
			});
	}

	/** Deletes one non-HttpOnly cookie by expiring it inside the page. */
	function removeCookie(name) {
		var webInspector = xcoder.require("webInspector");
		var code =
			"(function(){try{document.cookie=" + JSON.stringify(name) +
			"+'=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';return 'ok'}catch(e){return 'fail'}})()";
		webInspector
			.evaluateInPage(code)
			.then(function () {
				fetchStorage();
			})
			.catch(function (e) {
				setStatus(String((e && e.message) || e));
			});
	}

	function storageRow(kind, key, value) {
		var row = el("div", "xin-net-item");
		var head = el("div", "xin-net-head");
		var keyEl = el("span", "xin-net-method", String(key));
		keyEl.style.maxWidth = "45%";
		keyEl.style.overflow = "hidden";
		keyEl.style.textOverflow = "ellipsis";
		keyEl.style.whiteSpace = "nowrap";
		head.appendChild(keyEl);
		var val = el("span", "xin-net-url", String(value));
		val.style.flex = "1";
		val.style.overflow = "hidden";
		val.style.textOverflow = "ellipsis";
		val.style.whiteSpace = "nowrap";
		head.appendChild(val);
		var del = el("button", "xin-btn");
		del.type = "button";
		del.appendChild(icon("trash"));
		del.addEventListener("click", function () {
			if (kind === "cookies") removeCookie(key);
			else removeStorageItem(kind, key);
		});
		head.appendChild(del);
		row.appendChild(head);
		row.addEventListener("click", function (e) {
			if (e.target.closest("button")) return;
			var full = row.querySelector(".xin-storage-full");
			if (full) {
				full.remove();
				return;
			}
			var box = el("div", "xin-storage-full");
			box.textContent = String(value);
			box.addEventListener("click", function () {
				if (xcoder.clipboard) xcoder.clipboard(String(value));
			});
			row.appendChild(box);
		});
		return row;
	}

	function renderStorage() {
		if (!$storage) return;
		$storage.replaceChildren();
		if (!storageData) {
			$storage.appendChild(el("div", "xin-empty", t("inspector storage idle", "Abra uma página para ver o armazenamento")));
			return;
		}
		if (storageFilter === "cookies") {
			var cookies = storageData.cookies || [];
			if (!cookies.length) {
				$storage.appendChild(el("div", "xin-empty", t("inspector storage empty", "Vazio")));
				return;
			}
			cookies.forEach(function (cookie) {
				var eq = cookie.indexOf("=");
				var key = eq === -1 ? cookie : cookie.slice(0, eq);
				var value = eq === -1 ? "" : cookie.slice(eq + 1);
				$storage.appendChild(storageRow("cookies", key, value));
			});
			return;
		}
		var bucket = storageFilter === "session" ? storageData.session : storageData.local;
		var keys = Object.keys(bucket || {});
		if (!keys.length) {
			$storage.appendChild(el("div", "xin-empty", t("inspector storage empty", "Vazio")));
			return;
		}
		keys.sort().forEach(function (key) {
			$storage.appendChild(storageRow(storageFilter, key, bucket[key]));
		});
	}

	function runConsole() {
		var code = $consoleIn && $consoleIn.value && $consoleIn.value.trim();
		if (!code) return;
		var webInspector = xcoder.require("webInspector");
		webInspector
			.evaluateInPage(code)
			.then(function (result) {
				consoleLog.push({
					level: result && result.ok ? "log" : "error",
					text: "» " + code + "\n" + (result && result.ok ? result.value : (result && result.error) || "?"),
					ts: Date.now(),
				});
				consoleCount++;
				$consoleIn.value = "";
				renderConsole();
				refreshBadges();
			})
			.catch(function (e) {
				setStatus(String((e && e.message) || e));
			});
	}

	// --------------------------------------------------------------- network

	function renderNetwork() {
		if (!$network) return;
		var rows = networkLog
			.filter(function (entry) {
				return netFilterType === "all" || (entry.__type || "other") === netFilterType;
			})
			.map(function (entry) {
				var row = el("div", "xin-net");
				row.appendChild(el("span", "xin-net-method", String(entry.method || "GET")));
				var status = el("span", "xin-net-status " + (entry.failed ? "xin-net-fail" : "xin-net-ok"), String(entry.status || (entry.failed ? "ERR" : "…")));
				row.appendChild(status);
				row.appendChild(el("span", "xin-net-url", String(entry.url || "").slice(0, 140)));
				row.appendChild(el("span", "xin-net-ms", entry.ms != null ? entry.ms + "ms" : ""));
				row.addEventListener("click", function () {
					// DevTools «Response» parity — tap toggles the captured body
					var existing = row.querySelector(".xin-storage-full");
					if (existing) {
						existing.remove();
						return;
					}
					var box = el("div", "xin-storage-full");
					var bodyText = entry.error
						? "⚠ " + entry.error
						: entry.body || t("inspector net no body", "Sem corpo capturado (mídia/binário ou resposta vazia)");
					box.textContent = String(bodyText).slice(0, 20000);
					row.appendChild(box);
				});
				return row;
			});
		if (!rows.length) {
			rows = [el("div", "xin-empty", t("inspector network empty", "Sem pedidos ainda"))];
		}
		$network.replaceChildren.apply($network, rows);
	}

	// ---------------------------------------------------------------- search

	function searchDom() {
		var selector = $searchIn && $searchIn.value && $searchIn.value.trim();
		if (!selector) return;
		var webInspector = xcoder.require("webInspector");
		webInspector
			.sendInspectorCommand("searchDom", { selector: selector })
			.then(function (data) {
				var matches = (data && data.matches) || [];
				var out = el("div");
				out.appendChild(
					el("p", "xin-hint", (data && data.total ? data.total + " · " : "") + matches.length + (matches.length === 1 ? " match" : " matches")),
				);
				matches.forEach(function (match) {
					var row = el("div", "xin-node");
					row.appendChild(el("span", "xin-tag", nodeLabel(match)));
					row.addEventListener("click", function () {
						var webInspector2 = xcoder.require("webInspector");
						webInspector2
							.sendInspectorCommand("highlight", { path: match.path })
							.catch(function () {});
						inspectNode(match.path);
					});
					out.appendChild(row);
				});
				$searchOut.replaceChildren(out);
			})
			.catch(function (e) {
				setStatus(String((e && e.message) || e));
			});
	}

	// ------------------------------------------------------------- open/flow

	function inspect() {
		var target = normalizeAddress($url && $url.value);
		if (!target || busy) {
			if (!target) setStatus(t("inspector idle", "Introduza um endereço para inspecionar"));
			return;
		}
		var webInspector = xcoder.require("webInspector");
		busy = true;
		consoleLog = [];
		networkLog = [];
		consoleCount = 0;
		networkCount = 0;
		treeCache.clear();
		expanded = new Set([""]);
		refreshBadges();
		setStatus(t("inspector opening", "A carregar") + " " + target + " …", true);
		webInspector
			.openInspectorSession(target, { mode: "fullscreen", visible: false })
			.then(function () {
				setStatus(t("inspector waiting", "A capturar a página…"));
				if (activeTab === "console") renderConsole();
				if (activeTab === "network") renderNetwork();
			})
			.catch(function (error) {
				setStatus(t("inspector failed", "Falha ao inspecionar") + ": " + ((error && error.message) || error));
			})
			.finally(function () {
				busy = false;
			});
	}

	function openPage() {
		if (page && page.isConnected) return page;
		injectStyle();
		if (!root) buildRoot();
		var strings = window.strings || {};
		var Page = xcoder.require("page");
		var close = el("span", "icon close xin-close");
		close.setAttribute("role", "button");
		close.addEventListener("click", function () {
			if (page) page.hide();
		});
		page = Page(strings["inspector"] || "Inspector", { tail: close });
		page.append(root);
		app.append(page);
		page.onhide = function () {
			window.actionStack.remove(PAGE_ID);
			page = null;
		};
		window.actionStack.push({
			id: PAGE_ID,
			action: function () {
				if (page) page.hide();
			},
		});
		renderTree();
		renderConsole();
		renderNetwork();
		renderStorage();
		return page;
	}

	xcoder.setPluginInit(PLUGIN_ID, function () {
		var strings = window.strings || {};
		var title = strings["inspector"] || "Inspector";
var sidebarAppsApi = xcoder.require("sidebarApps");
		var webInspectorApi = xcoder.require("webInspector");
		if (!sidebarAppsApi || typeof sidebarAppsApi.add !== "function" || !webInspectorApi) {
			var toastApi = xcoder.require("toast");
			if (toastApi) toastApi("This plugin needs XCoder v1.8.43+ — update the app first", 4000);
			return;
		}
		var webInspector = xcoder.require("webInspector");

		injectStyle();
		webInspector.onInspectorEvent(handleEvent);

		xcoder.addCommand({
			name: "inspector:open",
			description: (strings["inspector cmd desc"] || "Inspect any page: elements, console and network") + " (" + title + ")",
			exec: function () {
				openPage();
				return true;
			},
		});

		sidebarAppsApi.add(
			"cod:code",
			"plugin-inspector",
			title,
			function () {},
			false,
			function () {
				openPage();
			},
			{ launcher: true },
		);

		xcoder.setPluginUnmount(PLUGIN_ID, function () {
			xcoder.removeCommand("inspector:open");
			try { sidebarAppsApi.remove("plugin-inspector"); } catch (e) {}
			var style = document.getElementById(CSS_ID);
			if (style) style.remove();
			webInspector.onInspectorEvent(function () {});
			webInspector.closeInspectorSession().catch(function () {});
			page = null;
			root = null;
			treeCache.clear();
			consoleLog = [];
			networkLog = [];
			storageData = null;
		});
	});
})();
