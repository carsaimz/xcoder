/**
 * Fuzzy matching for Quick Open («Ir para ficheiro») — VS Code style
 * subsequence scoring with the bonuses that make the ranking feel right:
 * basename matches beat folder matches, word-boundary hits beat mid-word
 * hits, consecutive runs beat scattered glyphs. Pure functions so the
 * palette stays testable without CodeMirror.
 */

/** Bonus for a match at the very start of the candidate. */
const SCORE_START = 18;
/** Bonus per consecutive continuation of the previous matched index. */
const SCORE_CONSECUTIVE = 8;
/** Bonus when the hit lands on a word boundary (after / _ - . space). */
const SCORE_BOUNDARY = 12;
/** Bonus applied when the match is inside the basename (not the folder). */
const SCORE_BASENAME = 24;
/** Bonus for a full substring hit of the basename. */
const SCORE_BASENAME_SUBSTRING = 40;
/** Penalty per unmatched character — keeps shorter names on top. */
const SCORE_GAP = -1;
/** Minimum score for a candidate to be considered a match at all. */
const MIN_SCORE = 1;

const BOUNDARY_CHARS = new Set(["/", "\\", "_", "-", ".", " ", "@", "#"]);

/**
 * Scores a case-insensitive subsequence match of `query` inside `text`.
 * @param {string} query user query (raw case)
 * @param {string} text candidate text (name or path)
 * @param {number} [basenameOffset] index in `text` where the basename
 *   starts; matches at/after it score higher. Defaults to 0.
 * @returns {{score: number, indices: number[]} | null} null when the
 *   query is not a subsequence of the text
 */
export function fuzzyScore(query, text, basenameOffset = 0) {
	if (!query) return null;
	const hay = String(text ?? "");
	const needle = String(query).toLowerCase();
	const lower = hay.toLowerCase();
	if (!needle || !lower) return null;

	const indices = [];
	let score = 0;
	let prev = -1;
	let from = 0;

	for (const ch of needle) {
		const idx = lower.indexOf(ch, from);
		if (idx === -1) return null;

		if (prev === idx - 1) {
			score += SCORE_CONSECUTIVE;
		} else if (prev !== -1) {
			// small penalty for the characters we skipped between hits
			score += SCORE_GAP * Math.min(idx - prev - 1, 8);
		}

		if (idx === 0) {
			score += SCORE_START;
		} else if (BOUNDARY_CHARS.has(lower[idx - 1])) {
			score += SCORE_BOUNDARY;
		}

		if (idx >= basenameOffset) {
			score += SCORE_BASENAME;
			if (idx === basenameOffset) {
				score += SCORE_BOUNDARY;
			}
		}

		indices.push(idx);
		prev = idx;
		from = idx + 1;
	}

	// a contiguous hit covering the whole basename ranks above any
	// scattered match — this is how "app.js" jumps to app.js first
	if (
		basenameOffset > 0 &&
		indices.length &&
		indices[indices.length - 1] - indices[0] + 1 === indices.length &&
		indices[0] === basenameOffset
	) {
		score += SCORE_BASENAME_SUBSTRING;
	}

	// spread the leftover query length so fewer misses win ties
	score += Math.max(0, hay.length - needle.length) * SCORE_GAP * 0.25;

	return score < MIN_SCORE ? { score: MIN_SCORE, indices } : { score, indices };
}

/**
 * Builds the highlight markup for a rendered hint, wrapping matched
 * characters in a lightweight <mark>.
 * @param {string} text original text (safe, escaped by the caller)
 * @param {number[]} indices matched character positions
 * @returns {string} HTML string with <mark> spans
 */
export function highlightMatches(text, indices) {
	if (!indices?.length) return escapeHtml(text);
	const set = new Set(indices);
	let out = "";
	let inMark = false;
	for (let i = 0; i < text.length; i++) {
		const hit = set.has(i);
		if (hit && !inMark) {
			out += '<mark class="xc-fuzzy-hit">';
			inMark = true;
		} else if (!hit && inMark) {
			out += "</mark>";
			inMark = false;
		}
		out += escapeHtml(text[i]);
	}
	if (inMark) out += "</mark>";
	return out;
}

/** @param {string} text */
function escapeHtml(text) {
	return String(text)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/**
 * Sorts candidates by fuzzy relevance (best first). Items are expected to
 * carry `{ name, path, priority }`; `priority` (lower wins) breaks ties so
 * already-open files and recent files outrank cold index hits even when
 * the fuzzy score is equal.
 * @template {{name: string, path?: string, priority?: number}} T
 * @param {T[]} items
 * @param {string} query
 * @param {number} [limit] maximum number of results
 * @returns {{item: T, score: number, indices: number[]}[]}
 */
export function rankCandidates(items, query, limit = 50) {
	const trimmed = String(query || "").trim();
	const scored = [];

	for (const item of items) {
		if (!trimmed) {
			scored.push({ item, score: 0, indices: [] });
			continue;
		}
		const name = String(item.name ?? "");
		const path = String(item.path ?? "");
		// where the basename starts inside the candidate path — only a real
		// suffix of the path counts ("src/app.js".endsWith("app.js"))
		const basenameOffset =
			name && path.endsWith(name) ? path.length - name.length : path.length;
		const nameMatch = fuzzyScore(trimmed, name, 0);
		const pathMatch = fuzzyScore(trimmed, path, basenameOffset);
		if (!nameMatch && !pathMatch) continue;

		// name-only matches get a flat edge over path matches
		const best = Math.max(nameMatch?.score ?? 0, (pathMatch?.score ?? 0) * 0.9);
		let indices = nameMatch?.indices ?? [];
		if (!nameMatch && pathMatch) {
			// re-derive name-local indices so highlights stay inside the name
			const localOffset =
				path.lastIndexOf(name) > -1 ? path.lastIndexOf(name) : 0;
			const local = fuzzyScore(trimmed, path.slice(localOffset), 0);
			indices = local?.indices ?? [];
		}
		scored.push({ item, score: best, indices });
	}

	if (!trimmed) {
		return scored
			.sort((a, b) => {
				const pa = a.item.priority ?? 10;
				const pb = b.item.priority ?? 10;
				if (pa !== pb) return pa - pb;
				return String(a.item.name).localeCompare(String(b.item.name));
			})
			.slice(0, limit);
	}

	scored.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		const pa = a.item.priority ?? 10;
		const pb = b.item.priority ?? 10;
		if (pa !== pb) return pa - pb;
		return String(a.item.name).localeCompare(String(b.item.name));
	});

	return scored.slice(0, limit);
}
