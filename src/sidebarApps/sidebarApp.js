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
	};

	/**
	 * Installs the app in the sidebar.
	 * @param {boolean} prepend
	 * @returns {void}
	 */
	install(prepend = false) {
		if (prepend) {
			$apps.prepend(this.#icon);
			return;
		}

		$apps.append(this.#icon);
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
			const oldContainer = getContainer(this.#container);
			// Try to replace the old container, or append if it's not in the DOM
			try {
				if (oldContainer && oldContainer.parentNode === $sidebar) {
					$sidebar.replaceChild($container, oldContainer);
				} else {
					// Old container not in sidebar, just append the new one
					const existingContainer = $sidebar.get(".container");
					if (existingContainer) {
						$sidebar.replaceChild($container, existingContainer);
					} else {
						$sidebar.appendChild($container);
					}
				}
			} catch (error) {
				// Fallback: append the new container
				console.warn("Error switching sidebar container:", error);
				const existingContainer = $sidebar.get(".container");
				if (existingContainer) {
					existingContainer.remove();
				}
				$sidebar.appendChild($container);
			}
			this.#onselect(this.#container);
		}
	}

	/**@type {HTMLElement} */
	get container() {
		return this.#container;
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
		></span>
	);
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
