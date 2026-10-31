import floatingWindow from "components/sidebar/floatingWindow";
import svgIcon from "utils/svgIcons";

/**@type {HTMLElement} */
let $apps;
/**@type {HTMLElement} */
let $sidebar;
/**@type {HTMLElement} */
let $container;

export default class SidebarApp {
	/**@type {HTMLSpanElement} */
	#icon;
	/**@type {string} */
	#id;
	/**@type {(el:HTMLElement)=>(void|Function)} */
	#init;
	/**@type {string} */
	#title;
	/**@type {boolean} */
	#active;
	/**@type {(el:HTMLElement)=>void} */
	#onselect;
	/**@type {Function|null} */
	#cleanup = null;
	/**@type {HTMLElement} */
	#container;
	/**@type {boolean} tabbed apps host their UI in an editor tab instead of the sidebar panel */
	#tabbed;
	/**@type {boolean} launcher apps run an action on tap without ever owning the sidebar panel */
	#launcher;
	/**@type {string|null} strings key used to retranslate the icon tooltip on language change */
	#titleKey = null;
	/**@type {string} activity-bar group: "primary" (top), "tools" (mid), "bottom" (pinned) */
	#group = "primary";
	/**@type {string} raw icon spec ("svg:<id>" or icon-font class) */
	#iconName = "";

	/**
	 * Creates a new sidebar app.
	 * @param {string} icon
	 * @param {string} id
	 * @param {string} title
	 * @param {(el:HTMLElement)=>(void|Function)} init
	 * @param {(el:HTMLElement)=>void} onselect
	 * @param {{tabbed?: boolean, launcher?: boolean, titleKey?: string}} [opts]
	 */
	constructor(icon, id, title, init, onselect, opts = {}) {
		const emptyFunc = () => {};
		this.#container = <div className="container"></div>;
		this.#titleKey = opts.titleKey || null;
		this.#icon = <Icon icon={icon} id={id} title={title} />;
		this.#id = id;
		this.#title = title;
		this.#init = init || emptyFunc;
		this.#onselect = onselect || emptyFunc;
		this.#tabbed = !!opts.tabbed;
		this.#launcher = !!opts.launcher;
		this.#iconName = icon || "";
		this.#group =
			opts.group === "bottom" || opts.group === "tools"
				? opts.group
				: "primary";
		const cleanup = this.#init(this.#container);
		if (typeof cleanup === "function") {
			this.#cleanup = cleanup;
		}
		document.addEventListener("langchange", this.#onLangChange);
	}

	#onLangChange = () => {
		if (!this.#titleKey || !this.#icon) return;
		const text = window.strings?.[this.#titleKey];
		if (!text) return;
		this.#title = text;
		this.#icon.title = text;
		const $label = this.#icon.querySelector(":scope > .app-label");
		if ($label) $label.textContent = text;
	};

	/** Window close button - deactivate the app and tell the registry. */
	#onFloatClosed() {
		this.#active = false;
		this.#icon.classList.remove("active");
		document.dispatchEvent(
			new CustomEvent("sidebar-float-closed", { detail: { id: this.#id } }),
		);
	}

	/**
	 * Installs the app in the sidebar.
	 * @param {boolean} prepend
	 * @returns {void}
	 */
	install(prepend = false) {
		const $target = SidebarApp.groupContainer(this.#group);
		if (!$target) {
			// registry not initialized yet - fall back to the flat list
			if (prepend) {
				$apps?.prepend(this.#icon);
				return;
			}
			$apps?.append(this.#icon);
			return;
		}

		if (prepend) {
			$target.prepend(this.#icon);
			return;
		}

		$target.append(this.#icon);
	}

	/**
	 * Creates (once) and returns the activity-bar group container.
	 * VS Code-style layout: primary views on top, tools behind a
	 * separator and account/settings/about pinned to the bottom
	 * (CSS margin-top:auto on .apps-group.bottom).
	 * @param {"primary"|"tools"|"bottom"} group
	 * @returns {HTMLElement|null}
	 */
	static groupContainer(group) {
		if (!$apps) return null;

		const existing = $apps.get(`:scope > .apps-group.${group}`);
		if (existing) return existing;

		// category caption (small-caps label above the group)
		const captions = {
			primary: strings["sidebar group primary"] || "Views",
			tools: strings["sidebar group tools"] || "Tools",
			bottom: strings["sidebar group bottom"] || "Account",
		};
		const $group = (
			<div className={`apps-group ${group}`} data-label={captions[group]} />
		);
		const $bottom = $apps.get(":scope > .apps-group.bottom");

		if (group === "primary") {
			const $next = $apps.get(":scope > .apps-group");
			if ($next) {
				$next.before($group);
			} else {
				$apps.append($group);
			}
		} else if (group === "tools" && $bottom) {
			$bottom.before($group);
		} else {
			$apps.append($group);
		}

		return $group;
	}

	/**
	 * Initialize the sidebar element.
	 * @param {HTMLElement} $el  sidebar element
	 * @param {HTMLElement} $el2 apps element
	 */
	static init($el, $el2) {
		$sidebar = $el;
		$apps = $el2;
	}

	/**@type {HTMLSpanElement} */
	get icon() {
		return this.#icon;
	}

	/**@type {string} */
	get id() {
		return this.#id;
	}

	/**@type {string} */
	get title() {
		return this.#title;
	}

	/**@type {string} raw icon spec used to build the icon element */
	get iconName() {
		return this.#iconName;
	}

	/**@type {string} activity bar group this icon is pinned to */
	get group() {
		return this.#group;
	}

	/**@type {boolean} */
	get active() {
		return !!this.#active;
	}

	/**@param {boolean} value */
	set active(value) {
		const nextValue = !!value;
		if (this.#active === nextValue) return;

		this.#active = nextValue;
		this.#icon.classList.toggle("active", this.#active);
		if (this.#active && !this.#tabbed) {
			if (floatingWindow.floatingEnabled()) {
				// independent window above the editor (VS Code style)
				floatingWindow.show(this.#id, this.#title, this.#container, () =>
					this.#onFloatClosed(),
				);
			} else {
				dockContainer(this.#container, $sidebar);
			}
			this.#onselect(this.#container);
		}
	}

	/**@type {HTMLElement} */
	get container() {
		return this.#container;
	}

	/**
	 * VS Code-style activity bar badge.
	 * @param {number|boolean|null} value number -> count pill ("99+" cap),
	 *   true -> dot, anything else -> removes the badge
	 * @returns {void}
	 */
	setBadge(value) {
		const icon = this.#icon;
		if (!icon) return;

		let badge = icon.querySelector(":scope > .app-badge");
		const count =
			typeof value === "number" && Number.isFinite(value)
				? Math.floor(value)
				: 0;

		if (count <= 0 && value !== true) {
			badge?.remove();
			return;
		}

		if (!badge) {
			badge = <span className="app-badge"></span>;
			icon.append(badge);
		}

		if (value === true) {
			badge.textContent = "";
			badge.classList.add("dot");
			badge.classList.remove("count");
			return;
		}

		badge.textContent = count > 99 ? "99+" : String(count);
		badge.classList.add("count");
		badge.classList.remove("dot");
	}

	/**@type {string|null} current badge text (null when there is no badge) */
	get badge() {
		return (
			this.#icon?.querySelector(":scope > .app-badge")?.textContent || null
		);
	}

	/**@type {boolean} tabbed apps open their UI in an editor tab (like the terminal) */
	get tabbed() {
		return this.#tabbed;
	}

	/**@type {boolean} launcher apps fire onselect on tap and never own the sidebar panel */
	get launcher() {
		return this.#launcher;
	}

	/**
	 * Re-triggers the onselect callback for tabbed apps (opens/focuses
	 * their editor tab) without touching the sidebar panel.
	 * @returns {void}
	 */
	pulse() {
		if (!this.#tabbed) return;
		if (!this.#active) {
			this.#active = true;
			this.#icon.classList.add("active");
		}
		this.#onselect(this.#container);
	}

	/**
	 * Fires the onselect callback for launcher apps without changing the
	 * active state or the sidebar panel (e.g. opens a full page).
	 * @returns {void}
	 */
	launch() {
		if (!this.#launcher) return;
		this.#onselect(this.#container);
	}

	/**@type {(el:HTMLElement)=>void} */
	get init() {
		return this.#init;
	}

	/**@type {(el:HTMLElement)=>void} */
	get onselect() {
		return this.#onselect;
	}

	remove() {
		document.removeEventListener("langchange", this.#onLangChange);
		this.#cleanup?.();
		this.#cleanup = null;
		if (this.#icon) {
			this.#icon.remove();
			this.#icon = null;
		}
		if (this.#container) {
			this.#container.remove();
			this.#container = null;
		}
	}
}

/**
 * Creates a icon element for a sidebar app.
 * @param {object} param0
 * @param {string} param0.icon
 * @param {string} param0.id
 * @returns {HTMLElement}
 */
function Icon({ icon, id, title }) {
	// name shown under the glyph (visible when .app-icons-container
	// has the .with-labels class - user request: nomes no sidebar)
	const $label = <small className="app-label">{title}</small>;
	// SVG icon pack (Lucide): icons registered as "svg:<name>" render as inline
	// vectors — tier 1 of the hybrid icon convention (docs/ICONS.md).
	if (icon?.startsWith("svg:")) {
		const $svg = svgIcon(icon.slice(4));
		if ($svg) {
			return (
				<span
					data-action="sidebar-app"
					data-id={id}
					title={title}
					className="icon xc-svgicon"
				>
					{$svg}
					{$label}
				</span>
			);
		}
		// pack miss — fall through to the icon font glyph below
	}
	const className = `icon ${icon}`;
	return (
		<span
			data-action="sidebar-app"
			data-id={id}
			title={title}
			className={className}
		>
			{$label}
		</span>
	);
}

/**
 * Docks a container into the sidebar (classic full-height panel)
 * when floating windows are disabled.
 * @param {HTMLElement} $container
 * @param {HTMLElement} $sidebarEl
 */
function dockContainer($container, $sidebarEl) {
	const oldContainer = getContainer($container);
	try {
		if (oldContainer && oldContainer.parentNode === $sidebarEl) {
			$sidebarEl.replaceChild($container, oldContainer);
			return;
		}
		const existingContainer = $sidebarEl.get(".container");
		if (existingContainer) {
			$sidebarEl.replaceChild($container, existingContainer);
		} else {
			$sidebarEl.appendChild($container);
		}
	} catch (error) {
		console.warn("Error switching sidebar container:", error);
		const existingContainer = $sidebarEl.get(".container");
		if (existingContainer) {
			existingContainer.remove();
		}
		$sidebarEl.appendChild($container);
	}
}

/**
 * Gets the container or sets it if it's not set.
 * @param {HTMLElement} $el
 * @returns {HTMLElement}
 */
function getContainer($el) {
	const res = $container;

	if ($el) {
		$container = $el;
	}

	return res || $sidebar.get(".container");
}
