import { EditorState } from "@codemirror/state";
import settings from "lib/settings";

/**
 * Icon-library autocompletion for the editor.
 *
 * Detects the icon-class patterns people actually type and completes them
 * from a bundled, lazy-loaded name list (src/res/iconNames.json):
 *
 *   `fas`            → `fas fa-house`, `fas fa-user`, …      (Font Awesome)
 *   `fab`            → `fab fa-github`, …
 *   `fa-`            → `fa-house`, …                          (combined free)
 *   `fas fa-`        → `fa-house`, …                          (style-aware)
 *   `bi` / `bi-`     → `bi bi-alarm`, …                       (Bootstrap)
 *   `ri-`            → `ri-home-line`, `ri-home-fill`, …      (Remix)
 *   `material-icons` + ligature → `home`, `search`, …         (Material)
 *   `material-symbols[-*]` + ligature → `home`, …
 *
 * Works anywhere the pattern matches — HTML class attributes, JSX
 * className strings, CSS and plain text — because the trigger tokens
 * (`fas`, `fa-`, `bi-`, `ri-`…) are specific enough to stay noise-free.
 */

let DATA = null;
let dataPromise = null;

function loadData() {
	if (DATA) return Promise.resolve(DATA);
	dataPromise ??= import("res/iconNames.json").then((mod) => {
		DATA = mod.default ?? mod;
		return DATA;
	});
	return dataPromise;
}

const FA_ALIAS = {
	fas: "solid",
	far: "regular",
	fab: "brands",
	fal: "solid", // light is Pro-only — fall back to the free solid list
	fad: "solid", // duotone is Pro-only
};

/** Words of the combined free list (solid first, then regular-only extras). */
let faFreeCache = null;

function faFree(data) {
	if (!faFreeCache) {
		const set = new Set(data.fa.solid);
		faFreeCache = [...data.fa.solid];
		for (const name of data.fa.regular) {
			if (!set.has(name)) {
				set.add(name);
				faFreeCache.push(name);
			}
		}
	}
	return faFreeCache;
}

function styleNames(data, style) {
	switch (style) {
		case "solid":
			return data.fa.solid;
		case "regular":
			return data.fa.regular;
		case "brands":
			return data.fa.brands;
		default:
			return faFree(data);
	}
}

function makeOption(label, detail) {
	return { label, type: "class", detail, boost: 0 };
}

/**
 * The icon completion source.
 * @param {object} context CodeMirror CompletionContext
 * @returns {Promise<object|null>} CompletionResult
 */
export async function iconCompletionSource(context) {
	if (settings.value?.iconCompletion === false) return null;

	const { state, pos } = context;
	const line = state.doc.lineAt(pos);
	const before = line.text.slice(0, pos - line.from);
	if (!before) return null;

	const data = await loadData();
	if (!data) return null;

	const token = (before.match(/[a-zA-Z0-9_-]+$/) || [""])[0];

	// ---------------------------------------------------- material ligatures
	const matMatch = before.match(
		/(material-(?:icons|symbols(?:-(?:outlined|rounded|sharp))?))\s+([a-zA-Z0-9_]*)$/i,
	);
	if (matMatch) {
		const word = matMatch[2];
		const names = /symbols/i.test(matMatch[1]) ? data.ms : data.mi;
		const from = pos - word.length;
		return {
			from,
			options: names.map((n) => makeOption(n, matMatch[1].toLowerCase())),
			validFor: /^[a-zA-Z0-9_]*$/,
		};
	}

	// ----------------------------------------------- FA: alias word (fas|fab)
	if (/^(fas|far|fab|fal|fad)$/.test(token)) {
		const style = FA_ALIAS[token];
		const names = styleNames(data, style);
		return {
			from: pos - token.length,
			options: names.map((n) =>
				makeOption(`${token} fa-${n}`, `Font Awesome ${style}`),
			),
		};
	}

	// --------------------------------- FA: long-form style word (fa-solid …)
	const longStyle = token.match(/^fa-(solid|regular|brands|sharp|duotone)$/);
	if (longStyle) {
		const names = styleNames(data, longStyle[1]);
		return {
			from: pos - token.length,
			options: names.map((n) =>
				makeOption(`${token} fa-${n}`, `Font Awesome ${longStyle[1]}`),
			),
		};
	}

	// --------------------------------------- FA: style prefix already typed
	const faAfterStyle = before.match(
		/(?:^|\s)(fa[srlbd]|fa-(?:solid|regular|brands|sharp|duotone))\s+(fa-[a-zA-Z0-9-]*)$/,
	);
	if (faAfterStyle) {
		const styleWord = faAfterStyle[1];
		const token2 = faAfterStyle[2];
		const style =
			FA_ALIAS[styleWord] || styleWord.replace(/^fa-/, "") || "solid";
		const names = styleNames(data, style);
		return {
			from: pos - token2.length,
			options: names.map((n) => makeOption(`fa-${n}`, `Font Awesome ${style}`)),
			validFor: /^fa-[a-zA-Z0-9-]*$/,
		};
	}

	// ------------------------------------------------- FA: bare fa- prefix
	if (/^fa-[a-zA-Z0-9-]*$/.test(token)) {
		return {
			from: pos - token.length,
			options: faFree(data).map((n) => makeOption(`fa-${n}`, "Font Awesome")),
			validFor: /^fa-[a-zA-Z0-9-]*$/,
		};
	}

	// ------------------------------------------------------ Bootstrap Icons
	if (token === "bi") {
		return {
			from: pos - token.length,
			options: data.bi.map((n) => makeOption(`bi bi-${n}`, "Bootstrap Icons")),
		};
	}

	const biAfterPrefix = before.match(/(?:^|\s)bi\s+(bi-[a-zA-Z0-9-]*)$/);
	if (biAfterPrefix) {
		const token2 = biAfterPrefix[1];
		return {
			from: pos - token2.length,
			options: data.bi.map((n) => makeOption(`bi-${n}`, "Bootstrap Icons")),
			validFor: /^bi-[a-zA-Z0-9-]*$/,
		};
	}

	if (/^bi-[a-zA-Z0-9-]*$/.test(token)) {
		return {
			from: pos - token.length,
			options: data.bi.map((n) => makeOption(`bi-${n}`, "Bootstrap Icons")),
			validFor: /^bi-[a-zA-Z0-9-]*$/,
		};
	}

	// ----------------------------------------------------------- Remix Icon
	if (/^ri-[a-zA-Z0-9-]*$/.test(token)) {
		const typed = token.slice(3); // after "ri-"
		const options = [];
		for (const base of data.ri) {
			if (
				!typed ||
				base.startsWith(typed) ||
				`${base}-line`.startsWith(typed)
			) {
				options.push(makeOption(`ri-${base}-line`, "Remix Icon"));
				options.push(makeOption(`ri-${base}-fill`, "Remix Icon"));
			}
			if (options.length > 6000) break;
		}
		return {
			from: pos - token.length,
			options,
			validFor: /^ri-[a-zA-Z0-9-]*$/,
		};
	}

	return null;
}

/**
 * Editor extension attaching the icon completion source to every language.
 * @returns {import("@codemirror/state").Extension}
 */
export default function iconCompletions() {
	return EditorState.languageData.of(() => [
		{ autocomplete: iconCompletionSource },
	]);
}

export { loadData as ensureIconDataLoaded };
