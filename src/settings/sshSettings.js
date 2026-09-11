import "./sshSettings.scss";
import settingsPage from "components/settingsPage";
import toast from "components/toast";
import dialog from "dialogs/dialog";
import loader from "dialogs/loader";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import {
	clearHistory,
	forgetHost,
	getHistory,
	getHostHomeDir,
	setHostHomeDir,
	sshHostAvatar,
	sshHostLabel,
} from "lib/sshSessions";
import helpers from "utils/helpers";
import Url from "utils/Url";

/**
 * SSH sessions v2 (roadmap v1.7.x item 3) — one-tap SSH terminals for every
 * SFTP storage the user already added in the file browser, now with a stable
 * color identity per host, per-host command history and a configurable home
 * directory. Credentials live in native SFTP profiles (lib/sftpProfiles.js),
 * so nothing secret is stored here.
 */
export default function sshSettings() {
	const title = strings["ssh sessions"] || "Sessões SSH";

	cleanupOrphanHosts();

	const page = settingsPage(title, buildItems(), handleCallback, "united", {
		pageClassName: "detail-settings-page",
	});
	page.show();
	return page;

	/**
	 * Lists the SFTP storages from localStorage.storageList.
	 * @returns {Array<{name: string, url: string}>}
	 */
	function listSftpStorages() {
		const storages = helpers.parseJSON(localStorage.storageList) || [];
		if (!Array.isArray(storages)) return [];
		return storages
			.filter((storage) => /^sftp:/i.test(storage?.url || ""))
			.map((storage) => ({
				name: storage.name || storage.url,
				url: storage.url,
			}));
	}

	/**
	 * Builds the item list — each server gets a stable color derived
	 * from its name (the "favicon" idea: the same host always wears the
	 * same color across sessions).
	 * @returns {Array<object>}
	 */
	function buildItems() {
		const items = [
			{
				key: "new-sftp",
				text: strings["ssh new connection"] || "Nova conexão SFTP",
				info:
					strings["settings-info-ssh-new"] ||
					"Adicione servidores pelo navegador de arquivos (menu + → SFTP). Eles aparecem aqui para abrir o terminal com um toque.",
				chevron: true,
			},
		];

		const servers = listSftpStorages();
		if (!servers.length) {
			items.push({
				key: "empty",
				text: strings["ssh no servers"] || "Nenhum servidor salvo",
				info:
					strings["settings-info-ssh-empty"] ||
					"Adicione uma conexão SFTP primeiro — o perfil de credenciais fica protegido no perfil nativo.",
			});
			return items;
		}

		items.push({
			key: "servers-header",
			text: `${strings["ssh servers count"] || "Servidores"} (${servers.length})`,
			info: strings["settings-info-ssh-list"],
		});
		for (const server of servers) {
			const avatar = sshHostAvatar(server.name || server.url);
			const homeDir = getHostHomeDir(profileIdOf(server.url));
			const label = sshHostLabel(server.url) || legacyHostOf(server.url);
			items.push({
				key: `server:${server.url}`,
				text: server.name,
				value: homeDir ? `⌂ ${homeDir} — ${label}` : label,
				icon: "svg:server",
				iconColor: `hsl(${avatar.hue} 60% 52%)`,
				chevron: true,
			});
		}
		return items;
	}

	/**
	 * Pretty "user@host" for a sftp storage URL (legacy fallback).
	 * @param {string} sftpUrl
	 */
	function legacyHostOf(sftpUrl) {
		try {
			const { hostname, username } = Url.decodeUrl(sftpUrl);
			const host = (hostname || "").replace(/^profile-/, "•");
			return username ? `${username}@${host}` : host;
		} catch {
			return "";
		}
	}

	/**
	 * @param {string} sftpUrl
	 * @returns {string} profile id ("profile-…") or ""
	 */
	function profileIdOf(sftpUrl) {
		try {
			const { hostname } = Url.decodeUrl(sftpUrl);
			return hostname?.startsWith("profile-") ? hostname : "";
		} catch {
			return "";
		}
	}

	/**
	 * Removes history/settings of hosts that no longer exist in the
	 * storage list (the file browser deletes storages without knowing
	 * about this page's per-host data).
	 */
	function cleanupOrphanHosts() {
		const servers = listSftpStorages();
		if (!servers.length) return;
		const known = new Set(
			servers.map((server) => profileIdOf(server.url)).filter(Boolean),
		);
		try {
			const store = JSON.parse(
				localStorage.getItem("ssh_host_history") || "{}",
			);
			for (const profileId of Object.keys(store)) {
				if (!known.has(profileId)) forgetHost(profileId);
			}
		} catch {
			// ignore malformed data
		}
	}

	/**
	 * @param {string} key
	 */
	async function handleCallback(key) {
		switch (key) {
			case "new-sftp":
				await openFileBrowserSftp();
				break;

			default:
				if (key?.startsWith?.("server:")) {
					await serverActions(key.slice("server:".length));
				}
				break;
		}
	}

	/**
	 * Actions for one saved SFTP server.
	 * @param {string} url
	 */
	async function serverActions(url) {
		const server = listSftpStorages().find((item) => item.url === url);
		const name = server?.name || "SSH";
		const profileId = profileIdOf(url);
		const choice = await select(name, [
			[
				"terminal",
				strings["ssh open terminal"] || "Abrir terminal SSH",
				"svg:square-terminal",
			],
			[
				"history",
				strings["ssh command history"] || "Histórico de comandos",
				"svg:history",
			],
			["home", strings["ssh home dir"] || "Diretório inicial", "svg:house"],
			["copy", strings["copy uri"] || "Copiar URL", "svg:copy"],
		]);
		if (!choice) return;

		if (choice === "terminal") {
			await openTerminal(url, name);
		} else if (choice === "history") {
			showCommandHistory(name, profileId);
		} else if (choice === "home") {
			await editHomeDir(name, profileId);
		} else if (choice === "copy") {
			await navigator.clipboard?.writeText?.(url);
			toast(strings["git copied"] || "Copied");
		}
	}

	/**
	 * Opens a remote SSH terminal for the storage URL.
	 * @param {string} url
	 * @param {string} name
	 */
	async function openTerminal(url, name) {
		const hide = await loader.show();
		try {
			const { TerminalManager } = await import(
				/* webpackChunkName: "terminal" */ "components/terminal"
			);
			await TerminalManager.createRemoteTerminal({ url, name });
			page.hide?.();
		} catch (error) {
			toast(`ssh: ${error?.message || error}`, 4000);
		} finally {
			hide();
		}
	}

	/**
	 * Per-host command history dialog: tap a command to copy it.
	 * @param {string} name
	 * @param {string} profileId
	 */
	function showCommandHistory(name, profileId) {
		const history = getHistory(profileId);
		const tip =
			strings["ssh history tip"] ||
			"Os comandos digitados nos terminais SSH deste servidor ficam salvos apenas neste aparelho.";

		if (!history.length) {
			dialog(
				name,
				`<p class="ssh-history-tip">${
					strings["ssh history empty"] || "Nenhum comando gravado ainda."
				}</p><p class="ssh-history-tip">${tip}</p>`,
				strings.close || "Close",
			);
			return;
		}

		const rows = history
			.slice()
			.reverse()
			.map(
				(command, index) =>
					`<button type="button" class="ssh-history-row" data-index="${index}"><code>${escapeHtml(
						command,
					)}</code><span class="icon content_copy"></span></button>`,
			)
			.join("");

		const historyDialog = dialog(
			name,
			`<div class="ssh-history" style="max-height: 45vh; overflow-y: auto;">${rows}</div><p class="ssh-history-tip">${tip}</p>`,
			strings["ssh clear history"] || "Limpar histórico",
			strings.close || "Close",
		)
			.then((children) => {
				const $list = children[0].querySelector(".ssh-history");
				$list?.addEventListener("click", async (event) => {
					const $row = event.target.closest?.(".ssh-history-row");
					if (!$row) return;
					const command = history[Number($row.dataset.index)] || "";
					try {
						await navigator.clipboard?.writeText?.(command);
						toast(strings["git copied"] || "Copied", 1500);
					} catch {
						toast(command, 4000);
					}
				});
			})
			.ok(() => {
				clearHistory(profileId);
				toast(strings["ssh history cleared"] || "Histórico limpo", 2000);
				historyDialog.hide();
			})
			.cancel(() => {
				historyDialog.hide();
			});
	}

	/**
	 * Prompts for the directory the shell starts in (empty clears it —
	 * the server default applies again).
	 * @param {string} name
	 * @param {string} profileId
	 */
	async function editHomeDir(name, profileId) {
		const current = getHostHomeDir(profileId);
		const value = await prompt(
			strings["ssh home dir"] || "Diretório inicial",
			current,
			"text",
			{
				placeholder:
					strings["ssh home dir info"] ||
					"Ex.: /home/user — vazio usa o padrão do servidor.",
			},
		);
		if (value === null) return;
		setHostHomeDir(profileId, value);
		toast(
			value?.trim()
				? strings["ssh home dir saved"] || "Diretório inicial salvo"
				: strings["ssh home dir cleared"] || "Diretório inicial removido",
			2500,
		);
		// rebuild so the value badge on the server row updates
		page.hide?.();
		sshSettings();
	}

	/**
	 * Opens the file browser so the user adds a new SFTP connection
	 * (the "+" menu hosts the "SFTP" option there).
	 */
	async function openFileBrowserSftp() {
		try {
			const { default: FileBrowser } = await import("pages/fileBrowser");
			await FileBrowser("folder", strings["file browser"] || "File browser");
			// refresh the list in case a server was added
			page.hide?.();
			sshSettings();
		} catch (error) {
			toast(error?.message || "file browser failed", 3000);
		}
	}
}

/**
 * @param {string} text
 * @returns {string} HTML-safe text
 */
function escapeHtml(text) {
	return String(text)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
