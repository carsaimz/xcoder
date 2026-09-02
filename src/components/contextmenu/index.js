import "./style.scss";
import actionStack from "lib/actionStack";
import { enhanceIcons } from "utils/iconEnhancer";

/**
 * @typedef {object} ContextMenuObj
 * @extends HTMLElement
 * @property {function():void} hide hides the menu
 * @property {function():void} show shows the page
 * @property {function():void} destroy destroys the menu
 */

/**
 * @typedef {object} ContextMenuOptions
 * @property {number} left
 * @property {number} top
 * @property {number} bottom
 * @property {number} right
 * @property {string} transformOrigin
 * @property {HTMLElement} toggler
 * @property {function} onshow
 * @property {function} onhide
 * @property {Array<[string, string]>} items Array of [text, action] pairs
 * @property {(this:HTMLElement, event:MouseEvent)=>void} onclick Called when an item is clicked
 * @property {(item:string) => void} onselect Called when an item is selected
 * @property {(this:HTMLElement) => string} innerHTML Called when the menu is shown
 */

/**
 * Create a context menu
 * @param {string|ContextMenuOptions} content Context menu content or options
 * @param {ContextMenuOptions} [options] Options
 * @returns {ContextMenuObj}
 */
export default function Contextmenu(content, options) {
	if (!options && typeof content === "object") {
		options = content;
		content = null;
	} else if (!options) {
		options = {};
	}

	const $el = tag("ul", {
		className: "context-menu scroll",
		innerHTML: content || "",
		onclick(e) {
			if (options.onclick) options.onclick.call(this, e);
			if (options.onselect) {
				const $target = e.target;
				const { action } = $target.dataset;
				if (!action) return;
				hide();
				options.onselect.call(this, action);
			}
		},
		style: {
			top: options.top || "auto",
			left: options.left || "auto",
			right: options.right || "auto",
			bottom: options.bottom || "auto",
			transformOrigin: options.transformOrigin,
		},
	});
	const $mask = tag("span", {
		className: "mask",
		ontouchstart: hide,
		onmousedown: hide,
	});

	if (Array.isArray(options.items)) {
		options.items.forEach(([text, action]) => {
			$el.append(<li data-action={action}>{text}</li>);
		});
	}

	if (content) enhanceIcons($el);
	if (!options.innerHTML) addTabindex();

	function show() {
		actionStack.push({
			id: "main-menu",
			action: hide,
		});
		$el.onshow();
		$el.classList.remove("hide");

		if (options.innerHTML) {
			$el.innerHTML = options.innerHTML.call($el);
			addTabindex();
			enhanceIcons($el);
		}

		if (options.toggler) {
			const client = options.toggler.getBoundingClientRect();
			if (!options.top && !options.bottom) {
				$el.style.top = client.top + "px";
			}
			if (!options.left && !options.right) {
				$el.style.right = innerWidth - client.right + "px";
			}
		}

		app.append($el, $mask);

		// Keep the menu fully on screen. Right/left-anchored menus
		// opened by togglers near an edge (e.g. the pencil, which
		// sits left of the terminal/palette buttons) would otherwise
		// overflow that edge on narrow screens. Layout values are
		// read from offsetWidth/offsetHeight because the grow
		// animation (scale 0->1) makes getBoundingClientRect lie.
		const menuWidth = $el.offsetWidth || 0;
		const menuHeight = $el.offsetHeight || 0;
		const rightPx = Number.parseFloat($el.style.right);
		const leftPx = Number.parseFloat($el.style.left);
		const topPx = Number.parseFloat($el.style.top);
		const bottomPx = Number.parseFloat($el.style.bottom);
		if (!Number.isNaN(rightPx) && innerWidth - rightPx - menuWidth < 6) {
			$el.style.left = "6px";
			$el.style.right = "auto";
		} else if (!Number.isNaN(leftPx) && leftPx + menuWidth > innerWidth - 6) {
			$el.style.left = Math.max(6, innerWidth - menuWidth - 6) + "px";
			$el.style.right = "auto";
		}
		if (!Number.isNaN(topPx) && topPx + menuHeight > innerHeight - 6) {
			$el.style.top = Math.max(6, innerHeight - menuHeight - 6) + "px";
		} else if (
			!Number.isNaN(bottomPx) &&
			bottomPx + menuHeight > innerHeight - 6
		) {
			$el.style.bottom = "6px";
		}

		const $firstChild = $el.firstChild;
		if ($firstChild && $firstChild.focus) $firstChild.focus();
	}

	function hide() {
		actionStack.remove("main-menu");
		$el.onhide();
		$el.classList.add("hide");
		setTimeout(() => {
			$mask.remove();
			$el.remove();
		}, 100);
	}

	function toggle() {
		if ($el.parentElement) return hide();
		show();
	}

	function addTabindex() {
		/**@type {Array<HTMLLIElement>} */
		const children = [...$el.children];
		for (let $el of children) $el.tabIndex = "0";
	}

	function destroy() {
		$el.remove();
		$mask.remove();
		options.toggler?.removeEventListener("click", toggle);
	}

	if (options.toggler) {
		options.toggler.addEventListener("click", toggle);
	}

	$el.hide = hide;
	$el.show = show;
	$el.destroy = destroy;
	$el.onshow = options.onshow || (() => {});
	$el.onhide = options.onhide || (() => {});

	return $el;
}
