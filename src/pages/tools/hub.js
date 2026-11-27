import { executeCommand, getRegisteredCommands } from "cm/commandRegistry";
import Page from "components/page";
import actionStack from "lib/actionStack";
import "./toolPage.scss";

/**
 * Tools hub — the navigation page for the independent tool pages
 * (v1.8.40 moved tools out of the sidebar into individual full-screen
 * pages; this hub is their shared entry point from the ⋮ menu and,
 * since v1.8.45, from its own sidebar launcher icon).
 * The Scraper, Inspector and Site Analyzer are BACK as internal tools
 * (v1.8.45: restored from v1.8.41 at the user's request — plugins stay
 * in the marketplace as an optional alternative, not a replacement).
 * Since v1.8.47 the hub tiles PREFER the marketplace plugin when it is
 * installed and enabled: plugins update through the marketplace without
 * a new app release, so their implementation is always the most recent.
 */

const t = (key, fallback) => strings[key] || fallback;

/** Marketplace plugin command per tool — set when the plugin UI wins. */
const PLUGIN_COMMANDS = {
	analyzer: "site-analyzer:open",
	inspector: "inspector:open",
	scraper: "scraper:open",
};

/** Tool registry: icon spec, title key, description key, opener. */
const TOOLS = [
	{
		icon: "cod:telescope",
		nameKey: "analyzer",
		descKey: "tools hub analyzer desc",
		pluginCommand: PLUGIN_COMMANDS.analyzer,
		open: () => import("./analyzer").then((m) => m.openAnalyzerPage()),
	},
	{
		icon: "cod:inspect",
		nameKey: "inspector",
		descKey: "tools hub inspector desc",
		pluginCommand: PLUGIN_COMMANDS.inspector,
		open: () => import("./inspector").then((m) => m.openInspectorPage()),
	},
	{
		icon: "cod:cloud-download",
		nameKey: "scraper",
		descKey: "tools hub scraper desc",
		pluginCommand: PLUGIN_COMMANDS.scraper,
		open: () => import("./scrape").then((m) => m.openScraperPage()),
	},
	{
		icon: "cod:mortar-board",
		nameKey: "learn",
		descKey: "tools hub learn desc",
		open: () => import("./learn").then((m) => m.openLearnPage()),
	},
	{
		icon: "cod:library",
		nameKey: "local libs",
		descKey: "tools hub libs desc",
		open: () => import("./libs").then((m) => m.openLibsPage()),
	},
	{
		icon: "cod:terminal",
		nameKey: "js console",
		descKey: "tools hub repl desc",
		open: () => import("./repl").then((m) => m.openReplPage()),
	},
	{
		icon: "cod:globe",
		nameKey: "website",
		descKey: "tools hub website desc",
		open: () => import("./website").then((m) => m.openWebsitePage()),
	},
	{
		icon: "cod:tools",
		nameKey: "dev tools",
		descKey: "tools hub devtools desc",
		open: () => import("./webdev").then((m) => m.openWebdevPage()),
	},
	{
		icon: "cod:diff",
		nameKey: "diff",
		descKey: "tools hub diff desc",
		open: () => import("./diff").then((m) => m.openDiffPage()),
	},
];

/**
 * Opens the hub programmatically — used by the «Ferramentas» sidebar
 * launcher and the command palette.
 * @returns {Promise<HTMLElement>} the hub page element
 */
export async function openToolsHub() {
	const mod = await import(/* webpackChunkName: "toolsHub" */ "./hub");
	return mod.default();
}

const PAGE_ID = "tools-hub";

/**
 * The marketplace plugin overrides the internal page only when its
 * command is actually registered (installed AND enabled at boot).
 * @param {object} tool entry from TOOLS
 * @returns {boolean}
 */
function pluginActive(tool) {
	if (!tool.pluginCommand) return false;
	return getRegisteredCommands().some(
		(command) => command.name === tool.pluginCommand,
	);
}

/** Renders the hub entries into `$list` (also used on langchange). */
function renderList($list) {
	$list.replaceChildren(
		...TOOLS.map((tool) => {
			const usePlugin = pluginActive(tool);
			return (
				<button
					type="button"
					className="tools-hub-item"
					onclick={() => {
						if (usePlugin) {
							executeCommand(tool.pluginCommand);
						} else {
							tool.open().catch((error) => console.error(error));
						}
					}}
				>
					{String(tool.icon).startsWith("cod:") ? (
						<span className={`icon ${tool.icon.replace("cod:", "codicon-")}`} />
					) : null}
					<span className="tools-hub-text">
						<span className="tools-hub-name">
							{t(tool.nameKey, tool.nameKey)}
						</span>
						<span className="tools-hub-desc">{t(tool.descKey, "")}</span>
					</span>
					{usePlugin ? (
						<span
							className="tools-hub-badge"
							title={t(
								"tools hub via plugin",
								"via plugin — sempre atualizado",
							)}
						>
							plugin
						</span>
					) : null}
					<span className="icon codicon-chevron-right chevron" />
				</button>
			);
		}),
	);
}

export default function ToolsHub() {
	const $list = <div className="tools-hub-list" />;

	const $page = Page(t("tools", "Ferramentas"), {
		tail: (
			<span
				className="icon close tool-page-close"
				title={strings.close || "Close"}
				role="button"
				onclick={() => $page.hide()}
			/>
		),
	});
	$page.classList.add("tool-page-shell");
	$page.append(
		<div className="tools-hub">
			<p className="tools-hub-intro">
				{t(
					"tools hub intro",
					"Ferramentas web independentes — cada uma abre na sua própria página.",
				)}
			</p>
			{$list}
		</div>,
	);

	renderList($list);
	const onLangChange = () => renderList($list);
	document.addEventListener("langchange", onLangChange);

	app.append($page);

	$page.onhide = () => {
		actionStack.remove(PAGE_ID);
		document.removeEventListener("langchange", onLangChange);
	};
	actionStack.push({
		id: PAGE_ID,
		action: $page.hide,
	});

	return $page;
}
