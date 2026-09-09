import settingsPage from "components/settingsPage";
import toast from "components/toast";
import loader from "dialogs/loader";
import select from "dialogs/select";
import settings from "lib/settings";
import helpers from "utils/helpers";
import Url from "utils/Url";

/**
 * SSH sessions (roadmap v1.6.x item 1) — one-tap SSH terminals for every
 * SFTP storage the user already added in the file browser. Credentials
 * live in native SFTP profiles (lib/sftpProfiles.js), so nothing secret
 * is stored here.
 */
export default function sshSettings() {
	const title = strings["ssh sessions"] || "Sessões SSH";

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
	 * Builds the item list.
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
			items.push({
				key: `server:${server.url}`,
				text: server.name,
				value: hostOf(server.url),
				chevron: true,
			});
		}
		return items;
	}

	/**
	 * Pretty "user@host" for a sftp storage URL.
	 * @param {string} sftpUrl
	 */
	function hostOf(sftpUrl) {
		try {
			const { hostname, username } = Url.decodeUrl(sftpUrl);
			const host = (hostname || "").replace(/^profile-/, "•");
			return username ? `${username}@${host}` : host;
		} catch {
			return "";
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
		const choice = await select(name, [
			[
				"terminal",
				strings["ssh open terminal"] || "Abrir terminal SSH",
				"svg:square-terminal",
			],
			["copy", strings["copy uri"] || "Copiar URL", "svg:copy"],
		]);
		if (!choice) return;

		if (choice === "terminal") {
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
		} else if (choice === "copy") {
			await navigator.clipboard?.writeText?.(url);
			toast(strings["git copied"] || "Copied");
		}
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
