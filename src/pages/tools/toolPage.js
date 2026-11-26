import Page from "components/page";
import actionStack from "lib/actionStack";
import "./toolPage.scss";

/**
 * Independent tool pages — «mover as ferramentas de APP sidebar para
 * páginas independentes e individuais (fora de Apps Sidebar, janela
 * flutuante)».
 *
 * Every web tool (Inspector, Scraper, Analyzer, Libs, Learn, Website,
 * JS Console) is a FULL-SCREEN page on the page stack — the same
 * bullet-proof shell as Problems/Plugins/Settings — instead of a panel
 * living inside the sidebar rail or a floating window. The old chain
 * (sidebar rail → floating window → bootHold → SidebarApp active state)
 * was fragile: a boot restore could mark an app "active" while its
 * window never opened, so fetches ran with HTTP 200 into a container
 * that was never in the document — «só analisa e retorna 200, mas nada
 * aparece». Pages remove that entire class of failure: `app.append()`
 * is synchronous and unconditional.
 *
 * The tool's container element is CACHED per tool: closing the page
 * (back button) keeps results/state alive — reopening continues where
 * the user left off instead of a blank view.
 */

/** @type {Map<string, HTMLElement>} cached tool containers (state kept) */
const containers = new Map();
/** @type {Map<string, HTMLElement>} pages currently connected */
const activePages = new Map();

/**
 * Opens (or refocuses) a full-screen page for a tool.
 *
 * @param {object} opts
 * @param {string} opts.id stable action-stack id (e.g. "scraper-page")
 * @param {string} opts.titleKey strings key for the page title
 * @param {string} [opts.title] fallback title when the key is missing
 * @param {string} [opts.className] extra class(es) for the container
 *     (the tool's own root class, e.g. "scr-app", so its SCSS applies)
 * @param {(container: HTMLElement) => (void|Function)} opts.build builds
 *     the UI into the container; may return a destructor used ONLY when
 *     the cached container is discarded
 * @param {()=>void} [opts.onShow] runs every time the page opens
 * @param {()=>void} [opts.onHide] runs when the page closes (e.g. stop
 *     native WebView sessions) WITHOUT dropping cached state
 * @returns {HTMLElement} the page element (connected to the document)
 */
export function openToolPage({
	id,
	titleKey,
	title = "",
	className = "",
	build,
	onShow,
	onHide,
}) {
	// already open? never stack a second page for the same tool — the
	// cached container can only live in one page at a time
	const $open = activePages.get(id);
	if ($open?.isConnected) return $open;

	const $container = ensureContainer({ id, className, build });

	const $page = Page(strings[titleKey] || title || id, {
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
	$page.append($container);
	app.append($page);

	$page.onhide = () => {
		activePages.delete(id);
		actionStack.remove(id);
		try {
			onHide?.();
		} catch (error) {
			console.error(error);
		}
	};

	actionStack.push({
		id,
		action: $page.hide,
	});
	activePages.set(id, $page);

	try {
		onShow?.();
	} catch (error) {
		console.error(error);
	}

	return $page;
}

/**
 * Returns the tool's cached container, building it on first use. The
 * container keeps every module-level ref alive between opens — results
 * rendered once stay visible on the next visit.
 *
 * @param {{id: string, className: string, build: (el: HTMLElement) => (void|Function)}} opts
 * @returns {HTMLElement}
 */
function ensureContainer({ id, className, build }) {
	const existing = containers.get(id);
	if (existing) return existing;

	const $container = (
		<div className={`container tool-page ${className}`.trim()} />
	);
	const destructor = build($container);
	// the destructor (language listeners, native sessions) is intentionally
	// NOT called on page hide — the container is cached with its state.
	// Store it so a hard discard can still run it.
	$container.__destructor =
		typeof destructor === "function" ? destructor : null;
	containers.set(id, $container);
	return $container;
}

/**
 * Drops a tool's cached container (frees memory + runs its destructor).
 * Used when the editor needs to reclaim resources — reopening rebuilds.
 * @param {string} id
 */
export function discardToolPage(id) {
	const $container = containers.get(id);
	if (!$container) return;
	containers.delete(id);
	try {
		$container.__destructor?.();
	} catch (error) {
		console.error(error);
	}
	$container.remove();
}

/** Whether a tool page's cached container exists. */
export function hasToolPage(id) {
	return containers.has(id);
}
