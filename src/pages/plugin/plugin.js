import "./plugin.scss";
import fsOperation from "fileSystem";
import Page from "components/page";
import alert from "dialogs/alert";
import loader from "dialogs/loader";
import actionStack from "lib/actionStack";
import config from "lib/config";
import installPlugin from "lib/installPlugin";
import InstallState from "lib/installState";
import pluginRegistry from "lib/pluginRegistry";
import settings from "lib/settings";
import markdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import markdownItFootnote from "markdown-it-footnote";
import MarkdownItGitHubAlerts from "markdown-it-github-alerts";
import markdownItTaskLists from "markdown-it-task-lists";
import mimeTypes from "mime-types";
import { highlightCodeBlock, initHighlighting } from "utils/codeHighlight";
import helpers from "utils/helpers";
import Url from "utils/Url";
import { isVersionGreater } from "utils/version";
import view, { cleanups } from "./plugin.view.js";

let $lastPluginPage;

/**
 * Plugin page
 * @param {string} id
 * @param {() => void} [onInstall]
 * @param {() => void} [onUninstall]
 * @param {boolean} [installOnRender]
 */
export default async function PluginInclude(
	id,
	onInstall,
	onUninstall,
	installOnRender,
) {
	if ($lastPluginPage) {
		$lastPluginPage.hide();
	}

	const $page = Page(strings["plugin"]);
	let installed = await fsOperation(PLUGIN_DIR, id).exists();
	let plugin = {};
	let currentVersion = "";
	let purchased = false;
	let cancelled = false;
	let update = false;
	let isPaid = false;
	let price;
	let product;
	let purchaseToken;
	let $settingsIcon;
	let minVersionCode = -1;
	let isSupported = true;
	let unsupportedEditor;
	let refundHandlerSet = false;
	let purchaseHandlerSet = false;

	actionStack.push({
		id: "plugin",
		action: $page.hide,
	});

	$page.onhide = function () {
		actionStack.remove("plugin");
		loader.removeTitleLoader();
		cancelled = true;
		$lastPluginPage = null;
		cleanups.forEach((cleanup) => {
			try {
				cleanup();
			} catch {}
		});
	};

	$lastPluginPage = $page;
	app.append($page);
	helpers.showAd();

	try {
		if (installed) {
			const manifest = Url.join(PLUGIN_DIR, id, "plugin.json");
			const installedPlugin = await fsOperation(manifest)
				.readFile("json")
				.catch((err) => {
					alert(`Failed to load plugin metadata: ${manifest}`);
					console.error(err);
				});
			const { author } = installedPlugin;
			const readme = Url.join(
				PLUGIN_DIR,
				id,
				installedPlugin.readme || "readme.md",
			);
			const description = await fsOperation(readme)
				.readFile("utf8")
				.catch((err) => {
					alert(`Failed to load plugin readme: ${readme}`);
					console.error(err);
				});
			let changelogs = "";
			if (installedPlugin.changelogs) {
				const changelogPath = Url.join(
					PLUGIN_DIR,
					id,
					installedPlugin.changelogs,
				);
				const changelogExists = await fsOperation(changelogPath).exists();
				if (changelogExists) {
					changelogs = await fsOperation(changelogPath).readFile("utf8");
				}
			}

			const iconUrl = await helpers.toInternalUri(
				Url.join(PLUGIN_DIR, id, installedPlugin.icon),
			);
			const iconData = await fsOperation(iconUrl).readFile();
			const iconMimeType =
				mimeTypes.lookup(installedPlugin.icon) || "image/png";
			const icon = URL.createObjectURL(
				new Blob([iconData], { type: iconMimeType }),
			);
			plugin = {
				id,
				icon,
				name: installedPlugin.name,
				version: installedPlugin.version,
				author: author.name,
				author_github: author.github,
				source: installedPlugin.source,
				license: installedPlugin.license,
				keywords: installedPlugin.keywords,
				contributors: installedPlugin.contributors,
				repository: installedPlugin.repository,
				supported_editor: installedPlugin.supported_editor,
				description,
				changelogs,
			};

			unsupportedEditor = installedPlugin.supported_editor;
			isSupported = isPluginEditorSupported(unsupportedEditor);
			isPaid = installedPlugin.price > 0;
			$page.settitle(plugin.name);
			render();
		}

		await (async () => {
			try {
				loader.showTitleLoader();
				const remotePlugin = await pluginRegistry.get(id);

				if (cancelled || !remotePlugin) return;

				if (
					installed &&
					isVersionGreater(remotePlugin.version, plugin.version)
				) {
					currentVersion = plugin.version;
					update = true;
				}

				if (remotePlugin.min_version_code) {
					minVersionCode = remotePlugin.min_version_code;
				}

				plugin = Object.assign(
					{},
					remotePlugin,
					installed ? { installed: true } : {},
				);
				unsupportedEditor = remotePlugin.supported_editor;
				isSupported = isPluginEditorSupported(unsupportedEditor);
				isPaid = false;
				purchased = false;
				price = "";
				$page.settitle(plugin.name);
			} catch (error) {
				console.error(error);
			} finally {
				loader.removeTitleLoader();
			}
		})();

		$page.settitle(plugin.name);
		render();

		if (installOnRender && !installed) {
			const $button = $page.get('[data-type="install"], [data-type="buy"]');
			$button?.click();
		}
	} catch (err) {
		console.error(err);
		helpers.error(err);
	} finally {
		loader.removeTitleLoader();
	}

	async function install() {
		try {
			try {
				await installPlugin(plugin.source || id, plugin.name);
			} catch (error) {
				if (plugin.source && plugin.source_fallback) {
					console.warn("Primary plugin source failed, trying fallback", error);
					await installPlugin(plugin.source_fallback, plugin.name);
				} else {
					throw error;
				}
			}
			if (onInstall) onInstall(plugin);
			installed = true;
			update = false;
			render();
		} catch (err) {
			window.log("error", err);
			helpers.error(err);
		}
	}

	async function uninstall() {
		try {
			const pluginDir = Url.join(PLUGIN_DIR, plugin.id);
			const state = await InstallState.new(plugin.id);
			await fsOperation(pluginDir).delete();
			state.delete(state.storeUrl);
			xcoder.unmountPlugin(plugin.id);
			if (onUninstall) onUninstall(plugin.id);
			installed = false;
			update = false;
			render();
		} catch (err) {
			window.log("error", err);
			helpers.error(err);
		}
	}

	async function buy() {
		helpers.error(
			strings["registry unavailable"] || "Purchases are disabled in XCoder.",
		);
	}

	async function refund() {
		helpers.error(
			strings["registry unavailable"] || "Purchases are disabled in XCoder.",
		);
	}

	async function render() {
		const pluginSettings = settings.uiSettings[`plugin-${plugin.id}`];
		$page.body = view({
			...plugin,
			body: markdownIt({
				html: true,
				xhtmlOut: true,
			})
				.use(MarkdownItGitHubAlerts)
				.use(anchor, {
					slugify: (s) =>
						s
							.trim()
							.toLowerCase()
							.replace(/[^a-z0-9]+/g, "-"),
				})
				.use(markdownItTaskLists)
				.use(markdownItFootnote)
				.render(plugin.description),
			changelogs: plugin.changelogs
				? markdownIt({ html: true, xhtmlOut: true })
						.use(MarkdownItGitHubAlerts)
						.use(anchor, {
							slugify: (s) =>
								s
									.trim()
									.toLowerCase()
									.replace(/[^a-z0-9]+/g, "-"),
						})
						.use(markdownItTaskLists)
						.use(markdownItFootnote)
						.render(plugin.changelogs)
				: null,
			purchased,
			installed,
			update,
			isPaid,
			price,
			buy,
			refund,
			install,
			uninstall,
			currentVersion,
			minVersionCode,
			isSupported,
			unsupportedEditor,
			showEditorSupportWarning: !isSupported,
		});

		// Handle anchor links
		$page.body.querySelectorAll("a[href^='#']").forEach((link) => {
			const originalHref = link.getAttribute("href");
			link.setAttribute("data-href", originalHref);
			link.style.cursor = "pointer";
			// Remove default click behavior
			link.removeAttribute("href");

			// Add custom click handler
			link.addEventListener(
				"click",
				(e) => {
					e.preventDefault();
					e.stopPropagation();

					const hash = link.getAttribute("data-href") || link.textContent;
					const targetId = hash.startsWith("#") ? hash.slice(1) : hash;

					// Look for either the anchor link or a heading with matching id
					const targetElement =
						$page.body.querySelector(`[name="${targetId}"]`) ||
						$page.body.querySelector(`#${targetId}`);

					if (targetElement) {
						const headerOffset =
							document.querySelector("header")?.offsetHeight || 0;
						const elementPosition = targetElement.getBoundingClientRect().top;
						const offsetPosition = elementPosition - headerOffset;

						$page.body.scrollBy({
							top: offsetPosition,
							behavior: "smooth",
						});
					}

					return false;
				},
				{ capture: true },
			);
		});

		// Initialize theme-aware highlight styles
		initHighlighting();

		// Add copy button and syntax highlighting to code blocks
		const codeBlocks = $page.body.querySelectorAll("pre");
		codeBlocks.forEach((pre) => {
			pre.style.position = "relative";
			const copyButton = document.createElement("button");
			copyButton.className = "copy-button";
			copyButton.textContent = "Copy";

			const codeElement = pre.querySelector("code");
			if (codeElement) {
				const langMatch = codeElement.className.match(/language-(\w+)/);
				if (langMatch) {
					const lang = langMatch[1];
					const originalCode = codeElement.textContent || "";
					codeElement.classList.add("cm-highlighted");

					highlightCodeBlock(originalCode, lang).then((highlighted) => {
						if (highlighted && highlighted !== originalCode) {
							codeElement.innerHTML = highlighted;
						}
					});
				}
			}

			copyButton.addEventListener("click", async () => {
				const code = pre.querySelector("code")?.textContent || pre.textContent;
				try {
					cordova.plugins.clipboard.copy(code);
					copyButton.textContent = "Copied!";
					setTimeout(() => {
						copyButton.textContent = "Copy";
					}, 2000);
				} catch (err) {
					copyButton.textContent = "Failed to copy";
					setTimeout(() => {
						copyButton.textContent = "Copy";
					}, 2000);
				}
			});

			pre.appendChild(copyButton);
		});

		if ($settingsIcon) {
			$settingsIcon.remove();
			$settingsIcon = null;
		}

		if (pluginSettings) {
			pluginSettings.setTitle(plugin.name);
			$settingsIcon = (
				<span
					attr-action="settings"
					className="icon settings"
					onclick={() => pluginSettings.show()}
				></span>
			);
			if (!$page.header.contains($settingsIcon)) {
				$page.header.append($settingsIcon);
			}
		}
	}
}

function isValidSource(source) {
	// XCoder: sources come from the local registry or direct URLs.
	return true;
}

function isPluginEditorSupported(supportedEditor) {
	return (
		!supportedEditor ||
		["all", config.SUPPORTED_EDITOR].includes(supportedEditor)
	);
}
