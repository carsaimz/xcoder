import Page from "components/page";
import actionStack from "lib/actionStack";
import "./toolPage.scss";

/**
 * Tools hub — the navigation page for the independent tool pages
 * (v1.8.40 moved tools out of the sidebar into individual full-screen
 * pages; this hub is their shared entry point from the ⋮ menu and
 * its own sidebar launcher icon).
 * The internal Inspector / Site Analyzer / Scraper pages are GONE for
 * good (v1.8.48: removed again at the user's request — the marketplace
 * plugins Inspector, Site Analyzer and Scraper are their replacement
 * and update without a new app release). This hub now lists only the
 * tools that genuinely live in the app.
 */

const t = (key, fallback) => strings[key] || fallback;

/** Tool registry: icon spec, title key, description key, opener. */
const TOOLS = [
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

/** Renders the hub entries into `$list` (also used on langchange). */
function renderList($list) {
	$list.replaceChildren(
		...TOOLS.map((tool) => {
			return (
				<button
					type="button"
					className="tools-hub-item"
					onclick={() => {
						tool.open().catch((error) => console.error(error));
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
