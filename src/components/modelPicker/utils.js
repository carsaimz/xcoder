/**
 * Pure helpers of the model picker — kept import-free so unit tests can
 * exercise them without dragging the settings/providers dependency chain
 * (and its boot-time side effects) into the test environment.
 */

/**
 * Pure filter used by the picker: rows match the query (case-
 * insensitive); a group header stays visible only while at least one of
 * its rows matches. With an empty query everything is visible.
 * @param {Array<{header?: boolean, text?: string, value?: string}>} items
 * @param {string} query
 * @returns {Set<number>} indexes of visible items
 */
export function filterModelItems(items, query) {
	const q = String(query || "")
		.trim()
		.toLowerCase();
	const visible = new Set();
	if (!q) {
		items.forEach((_, index) => visible.add(index));
		return visible;
	}

	items.forEach((item, index) => {
		if (item.header) return;
		const haystack = String(item.text ?? item.value ?? "").toLowerCase();
		if (haystack.includes(q)) visible.add(index);
	});

	items.forEach((item, index) => {
		if (!item.header) return;
		for (let j = index + 1; j < items.length && !items[j].header; j++) {
			if (visible.has(j)) {
				visible.add(index);
				break;
			}
		}
	});

	return visible;
}

/**
 * Builds the provider logo element (real brand SVG when available,
 * colored letter badge or emoji glyph otherwise) — mirrors the logo
 * treatment of the chat strip.
 * @param {{glyph: string, color: string, svg?: string, isLetter?: boolean}} logo
 *        result of providerIcon() with isLetter: isLetterGlyph(glyph)
 * @returns {HTMLElement}
 */
export function providerLogoEl(logo) {
	const isLetter = logo?.isLetter === true;
	const $logo = (
		<span
			className={`mp-logo${isLetter ? " letter" : ""}`}
			title={String(logo?.glyph || "")}
		>
			{logo?.glyph || "?"}
		</span>
	);
	if (isLetter) {
		$logo.style.background = logo.color || "";
	}
	if (logo?.svg) {
		$logo.classList.add("svg");
		$logo.textContent = "";
		if (logo.svg.includes("currentColor")) {
			$logo.style.color = logo.color || "";
		}
		$logo.innerHTML = logo.svg;
	}
	return $logo;
}
