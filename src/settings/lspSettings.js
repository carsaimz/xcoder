import "./lspManager.scss";
import { quoteArg } from "cm/lsp/installRuntime";
import { checkRuntimeServerInstallation } from "cm/lsp/runtimeActions";
import serverRegistry from "cm/lsp/serverRegistry";
import Checkbox from "components/checkbox";
import Page from "components/page";
import searchBar from "components/searchbar";
import toast from "components/toast";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import actionStack from "lib/actionStack";
import appSettings from "lib/settings";
import {
	getServerOverride,
	normalizeLanguages,
	normalizeServerId,
	upsertCustomServer,
} from "./lspConfigUtils";

import lspServerDetail from "./lspServerDetail";
import {
	applyServerFilters,
	clearSizeCaches,
	collectLanguages,
	estimateDownloadSize,
	formatBytes,
	measureInstalledSize,
} from "./lspServerStats";

function parseArgsInput(value) {
	const normalized = String(value || "").trim();
	if (!normalized) return [];

	const parsed = JSON.parse(normalized);
	if (!Array.isArray(parsed)) {
		throw new Error(strings["lsp-error-args-must-be-array"]);
	}
	return parsed.map((entry) => String(entry));
}

function normalizePackages(value) {
	return String(value || "")
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function getInstallMethods() {
	return [
		{ value: "manual", text: strings["lsp-install-method-manual"] },
		{ value: "apk", text: strings["lsp-install-method-apk"] },
		{ value: "npm", text: strings["lsp-install-method-npm"] },
		{ value: "pip", text: strings["lsp-install-method-pip"] },
		{ value: "cargo", text: strings["lsp-install-method-cargo"] },
		{ value: "shell", text: strings["lsp-install-method-shell"] },
	];
}

function getTransportMethods() {
	return [
		{
			value: "stdio",
			text:
				strings["lsp-transport-method-stdio"] ||
				"STDIO (launch a binary command)",
		},
		{
			value: "websocket",
			text:
				strings["lsp-transport-method-websocket"] ||
				"WebSocket (connect to a ws/wss URL)",
		},
	];
}

function parseWebSocketUrl(value) {
	const normalized = String(value || "").trim();
	if (!normalized) {
		throw new Error(
			strings["lsp-error-websocket-url-required"] ||
				"WebSocket URL is required",
		);
	}
	if (!/^wss?:\/\//i.test(normalized)) {
		throw new Error(
			strings["lsp-error-websocket-url-invalid"] ||
				"WebSocket URL must start with ws:// or wss://",
		);
	}
	return normalized;
}

function buildDefaultCheckCommand(binaryCommand, installer) {
	const executable = String(
		installer?.binaryPath || installer?.executable || binaryCommand || "",
	).trim();
	if (!executable) return "";
	if (installer?.kind === "manual" && installer?.binaryPath) {
		return `test -x ${quoteArg(installer.binaryPath)}`;
	}
	if (executable.includes("/")) {
		return `test -x ${quoteArg(executable)}`;
	}
	return `which ${quoteArg(executable)}`;
}

async function promptInstaller(binaryCommand) {
	const method = await select(
		strings["lsp-install-method-title"],
		getInstallMethods(),
	);
	if (!method) return null;

	switch (method) {
		case "manual": {
			const binaryPath = await prompt(
				strings["lsp-binary-path-optional"],
				String(binaryCommand || "").includes("/") ? String(binaryCommand) : "",
				"text",
			);
			if (binaryPath === null) return null;
			return {
				kind: "manual",
				source: "manual",
				executable: String(binaryCommand || "").trim() || undefined,
				binaryPath: String(binaryPath || "").trim() || undefined,
			};
		}
		case "apk":
		case "npm":
		case "pip":
		case "cargo": {
			const packagesInput = await prompt(
				strings["lsp-packages-prompt"].replace(
					"{method}",
					method.toUpperCase(),
				),
				"",
				"text",
			);
			if (packagesInput === null) return null;
			const packages = normalizePackages(packagesInput);
			if (!packages.length) {
				throw new Error(strings["lsp-error-package-required"]);
			}
			return {
				kind: method,
				source: method,
				executable: String(binaryCommand || "").trim() || undefined,
				packages,
			};
		}
		case "shell": {
			const installCommand = await prompt(
				strings["lsp-install-command"],
				"",
				"textarea",
			);
			if (installCommand === null) return null;
			const updateCommand = await prompt(
				strings["lsp-update-command-optional"],
				String(installCommand || ""),
				"textarea",
			);
			if (updateCommand === null) return null;
			return {
				kind: "shell",
				source: "custom",
				executable: String(binaryCommand || "").trim() || undefined,
				command: String(installCommand || "").trim() || undefined,
				updateCommand: String(updateCommand || "").trim() || undefined,
			};
		}
		default:
			return null;
	}
}

/** Status label for a pill. @param {string|null} status */
function statusText(status) {
	const map = {
		present: strings["lsp-status-installed"] || "Instalado",
		missing: strings["lsp-status-not-installed"] || "Não instalado",
		unknown: strings["lsp-status-unknown"] || "Desconhecido",
		failed: strings["lsp-status-check-failed"] || "Falhou",
		checking: strings["lsp-checking-installation-status"] || "A verificar…",
	};
	return map[status] || map.checking;
}

/** VS Code-ish status pill class. @param {string|null} status */
function statusClass(status) {
	switch (status) {
		case "present":
			return "lsp-pill installed";
		case "missing":
			return "lsp-pill missing";
		case "failed":
			return "lsp-pill failed";
		case "unknown":
			return "lsp-pill unknown";
		default:
			return "lsp-pill checking";
	}
}

/** True when the server has any install recipe. @param {object} server */
function hasInstaller(server) {
	return Boolean(server?.launcher?.install);
}

/**
 * Language Servers manager — a VS Code-style, filterable server list.
 *
 * Toolbar: text search, filter chips (todos / instalados / não instalados),
 * language filter, sort order and a refresh action. Each row shows the
 * live install status (checked in the runtime shell), the detected version,
 * the language ids and both size numbers — estimated download size from the
 * package registries and the on-disk size after installation. Rows open the
 * existing detail page.
 * @returns {object} settings page interface (show/hide/search/restoreList/setTitle)
 */
export default function lspSettings() {
	const title =
		strings?.lsp_settings || strings["language servers"] || "Language Servers";

	const filters = {
		query: "",
		filter: /** @type {"all"|"installed"|"missing"} */ ("all"),
		language: /** @type {string|null} */ (null),
		sortBy: /** @type {"name"|"language"|"status"|"size"} */ ("name"),
	};

	/** @type {Map<string, {server: any, status: string|null, version: string|null, estimate: number|null, installedBytes: number|null, $row: HTMLElement}>} */
	const state = new Map();
	/** @type {Set<string>} */
	const checking = new Set();
	let checksToken = 0;
	let hideSearchBar = () => {};

	const $page = Page(title);
	$page.id = "settings";
	$page.classList.add("lsp-manager-page");

	/** @type {HTMLDivElement} */
	const $toolbar = (
		<div className="lsp-toolbar">
			<div className="lsp-chips">
				<button
					type="button"
					className="lsp-chip"
					data-filter="all"
					onclick={() => setFilter("all")}
				>
					{strings["lsp-filter-all"] || "Todos"}
				</button>
				<button
					type="button"
					className="lsp-chip"
					data-filter="installed"
					onclick={() => setFilter("installed")}
				>
					{strings["lsp-filter-installed"] || "Instalados"}
				</button>
				<button
					type="button"
					className="lsp-chip"
					data-filter="missing"
					onclick={() => setFilter("missing")}
				>
					{strings["lsp-filter-missing"] || "Não instalados"}
				</button>
			</div>
			<div className="lsp-toolbar-actions">
				<button
					type="button"
					className="lsp-toolbar-btn"
					data-action="language"
					onclick={pickLanguage}
				>
					<span className="icon codicon-filter" />
					<span className="lsp-toolbar-btn-label">
						{filters.language || strings["lsp-filter-language"] || "Linguagem"}
					</span>
				</button>
				<button
					type="button"
					className="lsp-toolbar-btn"
					data-action="sort"
					onclick={pickSort}
				>
					<span className="icon codicon-sort-precedence" />
					<span className="lsp-toolbar-btn-label">
						{sortLabel(filters.sortBy)}
					</span>
				</button>
			</div>
		</div>
	);

	/** @type {HTMLDivElement} */
	const $list = <div tabIndex={0} className="main list lsp-server-list" />;

	/** @type {HTMLElement} */
	const $footer = (
		<div className="lsp-footer">
			<div className="lsp-row static" data-key="allow_non_terminal_workspace">
				<div className="lsp-row-main">
					<div className="lsp-row-title">
						{strings["lsp-allow-non-terminal-workspace"]}
					</div>
					<div className="lsp-row-sub">
						{strings["settings-info-lsp-allow-non-terminal-workspace"]}
					</div>
				</div>
			</div>
			<div className="lsp-row static" data-key="add_custom_server">
				<span className="icon codicon-add lsp-row-icon" />
				<div className="lsp-row-main">
					<div className="lsp-row-title">
						{strings["lsp-add-custom-server"]}
					</div>
					<div className="lsp-row-sub">
						{strings["settings-info-lsp-add-custom-server"]}
					</div>
				</div>
				<span className="icon chevron_right lsp-row-go" />
			</div>
		</div>
	);

	const $footSwitch = Checkbox({
		text: "",
		checked: appSettings.value.lsp?.allowNonTerminalWorkspace === true,
		size: "1rem",
		isSwitch: true,
	});
	$footSwitch.classList.add("lsp-foot-switch");
	$footSwitch.addEventListener("change", onToggleWorkspace);
	$footer.get('[data-key="allow_non_terminal_workspace"]').append($footSwitch);

	const $body = (
		<div className="main lsp-manager-body">
			{$toolbar}
			{$list}
			{$footer}
		</div>
	);
	$page.body = $body;
	$page.ondisconnect = () => hideSearchBar();
	$page.onhide = () => {
		hideSearchBar();
		actionStack.remove(title);
	};

	// header actions: search, refresh, add
	const $search = (
		<span className="icon search" attr-action="search" title={strings.search} />
	);
	$search.onclick = () => {
		searchBar(
			$list,
			(hide) => {
				hideSearchBar = hide;
			},
			() => restoreList(),
			(value) => searchRows(value),
			false,
		);
	};
	const $refresh = (
		<span
			className="icon codicon-refresh"
			attr-action="refresh"
			title={strings.refresh || "Atualizar"}
		/>
	);
	$refresh.onclick = () => refreshAll();
	const $add = (
		<span
			className="icon codicon-add"
			attr-action="add-server"
			title={strings["lsp-add-custom-server"]}
		/>
	);
	$add.onclick = () => addCustomServerFlow();
	$page.header.append($search, $refresh, $add);

	return {
		show(goTo) {
			actionStack.push({
				id: title,
				action: () => $page.hide(),
			});
			app.append($page);

			if (goTo && String(goTo).startsWith("server:")) {
				const id = String(goTo).split(":")[1];
				const detailPage = lspServerDetail(id);
				detailPage?.show();
				return;
			}

			render();
			runChecks();
		},
		hide() {
			$page.hide();
		},
		search(key) {
			return searchRows(String(key || ""));
		},
		restoreList() {
			restoreList();
		},
		setTitle(nextTitle) {
			$page.settitle?.(nextTitle);
		},
	};

	// ------------------------------------------------------------------ ui

	function render() {
		state.clear();
		$list.content = [];

		const servers = serverRegistry.listServers();
		for (const server of servers) {
			const $row = (
				<div className="lsp-row" data-id={server.id} role="button">
					<span className="icon codicon-code lsp-row-icon" />
					<div className="lsp-row-main">
						<div className="lsp-row-title">
							<span className="lsp-row-label">{server.label}</span>
							<span className={statusClass(null)}>{statusText(null)}</span>
						</div>
						<div className="lsp-row-sub">{server.languages?.join(", ")}</div>
						<div className="lsp-row-size lsp-size-pending">
							{hasInstaller(server)
								? strings["lsp-size-measuring"] || "A medir…"
								: strings["lsp-size-none"] || "Sem instalação"}
						</div>
					</div>
					<span className="icon chevron_right lsp-row-go" />
				</div>
			);
			$row.onclick = () => {
				const detailPage = lspServerDetail(server.id);
				if (detailPage) detailPage.show();
			};
			state.set(server.id, {
				server,
				status: null,
				version: null,
				estimate: null,
				installedBytes: null,
				$row,
			});
			$list.append($row);
		}

		applyFilter();
	}

	function applyFilter() {
		const rows = Array.from(state.values()).map((entry) => ({
			label: entry.server.label || entry.server.id,
			languages: entry.server.languages || [],
			installed:
				entry.status === "present"
					? true
					: entry.status === "missing"
						? false
						: null,
			estimate: entry.estimate,
			installedBytes: entry.installedBytes,
		}));
		const visible = new Set(
			applyServerFilters(rows, filters).map((row) => row.label),
		);
		for (const entry of state.values()) {
			const label = entry.server.label || entry.server.id;
			entry.$row.style.display = visible.has(label) ? "" : "none";
		}
		for (const chip of $toolbar.querySelectorAll(".lsp-chip")) {
			chip.classList.toggle("active", chip.dataset.filter === filters.filter);
		}
		const $langLabel = $toolbar.get(
			'[data-action="language"] .lsp-toolbar-btn-label',
		);
		if ($langLabel) {
			$langLabel.textContent =
				filters.language || strings["lsp-filter-language"] || "Linguagem";
		}
		const $sortLabel = $toolbar.get(
			'[data-action="sort"] .lsp-toolbar-btn-label',
		);
		if ($sortLabel) $sortLabel.textContent = sortLabel(filters.sortBy);
	}

	// --------------------------------------------------------------- checks

	async function runChecks() {
		checksToken += 1;
		const token = checksToken;
		const ids = Array.from(state.keys());
		let cursor = 0;

		const worker = async () => {
			while (cursor < ids.length) {
				const id = ids[cursor++];
				await checkOne(id, token);
			}
		};
		await Promise.all(
			Array.from({ length: Math.min(4, ids.length || 1) }, () => worker()),
		);
	}

	async function checkOne(id, token) {
		const entry = state.get(id);
		if (!entry || checking.has(id)) return;
		checking.add(id);

		try {
			setRowStatus(id, "checking");
			const override = getServerOverride(id);
			const merged = {
				...entry.server,
				enabled: override.enabled ?? entry.server.enabled,
				launcher: {
					...(entry.server.launcher || {}),
					...(override.launcher || {}),
				},
			};
			const result = await checkRuntimeServerInstallation(merged).catch(() => ({
				status: "failed",
				version: null,
			}));
			if (token !== checksToken) return;
			entry.status = result?.status || "unknown";
			entry.version = result?.version || null;
			setRowStatus(id, entry.status, entry.version);

			// sizes — estimate (before) + installed (after)
			if (hasInstaller(entry.server)) {
				const [estimate, installed] = await Promise.all([
					estimateDownloadSize(entry.server).catch(() => null),
					measureInstalledSize(entry.server).catch(() => null),
				]);
				if (token !== checksToken) return;
				entry.estimate = estimate?.bytes ?? null;
				entry.installedBytes = installed ?? null;
				updateSizeLine(id);
				applyFilter();
			}
		} finally {
			checking.delete(id);
		}
	}

	/** @param {string} id @param {string|null} status @param {string|null} [version] */
	function setRowStatus(id, status, version) {
		const entry = state.get(id);
		if (!entry) return;
		const $pill = entry.$row.get(".lsp-pill");
		if ($pill) {
			$pill.className = statusClass(status);
			$pill.textContent = statusText(status);
		}
		const $sub = entry.$row.get(".lsp-row-sub");
		if ($sub) {
			const langs = entry.server.languages?.join(", ") || "";
			$sub.textContent = [langs, version].filter(Boolean).join(" • ");
		}
	}

	/** @param {string} id */
	function updateSizeLine(id) {
		const entry = state.get(id);
		if (!entry) return;
		const $size = entry.$row.get(".lsp-row-size");
		if (!$size) return;
		$size.classList.remove("lsp-size-pending");

		if (!hasInstaller(entry.server)) {
			$size.textContent = strings["lsp-size-none"] || "Sem instalação";
			return;
		}

		const parts = [];
		const est = formatBytes(entry.estimate);
		if (est) {
			parts.push(`~${est} ${strings["lsp-size-download"] || "download"}`);
		}
		const installed = formatBytes(entry.installedBytes);
		if (installed) {
			parts.push(`${installed} ${strings["lsp-size-installed"] || "no disco"}`);
		}
		$size.textContent = parts.join(" • ") || strings["lsp-size-unknown"] || "—";
	}

	async function refreshAll() {
		clearSizeCaches();
		toast(strings["lsp-refreshing"] || "A atualizar servidores…", 1500);
		render();
		await runChecks();
	}

	// -------------------------------------------------------------- toolbar

	/** @param {"all"|"installed"|"missing"} value */
	function setFilter(value) {
		filters.filter = value;
		applyFilter();
	}

	async function pickLanguage() {
		const languages = collectLanguages(
			Array.from(state.values()).map((entry) => ({
				languages: entry.server.languages || [],
			})),
		);
		const options = [
			{
				value: "",
				text: strings["lsp-filter-language-all"] || "Todas as linguagens",
			},
			...languages.map((lang) => ({ value: lang, text: lang })),
		];
		const picked = await select(
			strings["lsp-filter-language"] || "Filtrar por linguagem",
			options,
		);
		if (picked === null) return;
		filters.language = picked || null;
		applyFilter();
	}

	function sortLabel(sortBy) {
		const map = {
			name: strings["lsp-sort-name"] || "Nome",
			language: strings["lsp-sort-language"] || "Linguagem",
			status: strings["lsp-sort-status"] || "Estado",
			size: strings["lsp-sort-size"] || "Tamanho",
		};
		return map[sortBy] || map.name;
	}

	async function pickSort() {
		const options = [
			{ value: "name", text: sortLabel("name") },
			{ value: "language", text: sortLabel("language") },
			{ value: "status", text: sortLabel("status") },
			{ value: "size", text: sortLabel("size") },
		];
		const picked = await select(
			strings["lsp-sort-title"] || "Ordenar por",
			options,
		);
		if (!picked) return;
		filters.sortBy = /** @type {typeof filters.sortBy} */ (picked);
		applyFilter();
	}

	// --------------------------------------------------------------- search

	/** @param {string} value @returns {HTMLElement[]} */
	function searchRows(value) {
		const needle = value.trim().toLowerCase();
		if (!needle) {
			restoreList();
			return [];
		}
		return Array.from(state.values())
			.filter((entry) => {
				const haystack =
					`${entry.server.label} ${entry.server.languages?.join(" ")}`.toLowerCase();
				return haystack.includes(needle);
			})
			.map((entry) => entry.$row);
	}

	function restoreList() {
		for (const entry of state.values()) entry.$row.style.display = "";
		applyFilter();
	}

	// --------------------------------------------------------------- footer

	async function onToggleWorkspace(e) {
		const checked = /** @type {HTMLInputElement} */ (e.target)?.checked;
		await appSettings.update({
			lsp: {
				...(appSettings.value.lsp || {}),
				allowNonTerminalWorkspace: checked === true,
			},
		});
	}

	// ------------------------------------------------- add custom server ui

	async function addCustomServerFlow() {
		try {
			const idInput = await prompt(strings["lsp-server-id"], "", "text");
			if (idInput === null) return;

			const serverId = normalizeServerId(idInput);
			if (!serverId) {
				toast(strings["lsp-error-server-id-required"]);
				return;
			}

			const label = await prompt(strings["lsp-server-label"], serverId, "text");
			if (label === null) return;

			const languageInput = await prompt(
				strings["lsp-language-ids"],
				"",
				"text",
			);
			if (languageInput === null) return;
			const languages = normalizeLanguages(languageInput);
			if (!languages.length) {
				toast(strings["lsp-error-language-id-required"]);
				return;
			}

			const transportKind = await select(
				strings.type || "Type",
				getTransportMethods(),
			);
			if (!transportKind) return;

			let transport;
			let launcher;

			if (transportKind === "websocket") {
				const websocketUrlInput = await prompt(
					strings["lsp-websocket-url"] || "WebSocket URL",
					"ws://127.0.0.1:3000/",
					"text",
					{
						test: (value) => {
							try {
								parseWebSocketUrl(value);
								return true;
							} catch {
								return false;
							}
						},
					},
				);
				if (websocketUrlInput === null) return;

				transport = {
					kind: "websocket",
					url: parseWebSocketUrl(websocketUrlInput),
				};
			} else {
				const binaryCommand = await prompt(
					strings["lsp-binary-command"],
					"",
					"text",
				);
				if (binaryCommand === null) return;
				if (!String(binaryCommand).trim()) {
					toast(strings["lsp-error-binary-command-required"]);
					return;
				}

				const argsInput = await prompt(
					strings["lsp-binary-args"],
					"[]",
					"textarea",
					{
						test: (value) => {
							try {
								parseArgsInput(value);
								return true;
							} catch {
								return false;
							}
						},
					},
				);
				if (argsInput === null) return;

				const parsedArgs = parseArgsInput(argsInput);
				const installer = await promptInstaller(binaryCommand);
				if (installer === null) return;
				const defaultCheckCommand = buildDefaultCheckCommand(
					binaryCommand,
					installer,
				);

				const checkCommand = await prompt(
					strings["lsp-check-command-optional"],
					defaultCheckCommand,
					"text",
					{
						placeholder: defaultCheckCommand || "which my-language-server",
					},
				);
				if (checkCommand === null) return;

				transport = {
					kind: "stdio",
					command: String(binaryCommand).trim(),
					args: parsedArgs,
				};
				launcher = {
					bridge: {
						kind: "axs",
						command: String(binaryCommand).trim(),
						args: parsedArgs,
					},
					checkCommand: String(checkCommand || "").trim() || undefined,
					install: installer,
				};
			}

			await upsertCustomServer(serverId, {
				label: String(label || "").trim() || serverId,
				languages,
				transport,
				launcher,
				enabled: true,
			});

			toast(strings["lsp-custom-server-added"]);
			render();
			runChecks();
		} catch (error) {
			toast(
				error instanceof Error
					? error.message
					: strings["lsp-error-add-server-failed"],
			);
		}
	}
}
