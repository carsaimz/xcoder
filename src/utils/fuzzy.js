/**
 * Lightweight fuzzy matcher used by hint lists (command palette, find file,
 * etc.). Returns a score when `query` matches `text`, or `null` when it
 * does not.
 *
 * Matching model:
 *  - exact substring hit gives a strong score (earlier = better, shorter
 *    relative length = better);
 *  - otherwise a case-insensitive subsequence match is attempted with
 *    bonuses for contiguous runs and word-boundary starts, and a small
 *    penalty for gaps and long texts.
 *
 * @param {string} query user query (may contain any characters)
 * @param {string} text plain text to test against (no HTML)
 * @returns {{score: number} | null} null when there is no match
 */
export default function fuzzyMatch(query, text) {
	if (!query) return { score: 0 };
	if (!text) return null;

	const q = query.toLowerCase();
	const t = text.toLowerCase();

	const idx = t.indexOf(q);
	if (idx >= 0) {
		return { score: 1000 - idx * 10 - (t.length - q.length) };
	}

	let score = 0;
	let ti = 0;
	let run = 0;
	for (let qi = 0; qi < q.length; qi++) {
		const ch = q[qi];
		const found = t.indexOf(ch, ti);
		if (found === -1) return null;
		if (found === ti && qi > 0) {
			run += 1;
			score += 15 + run * 5; // contiguous run bonus
		} else {
			run = 0;
			score -= Math.min(found - ti, 10); // gap penalty (capped)
		}
		if (found === 0 || /[\s_\-.:/]/.test(t[found - 1])) {
			score += 12; // word boundary bonus
		}
		ti = found + 1;
	}

	score -= t.length * 0.1; // prefer shorter candidates
	return { score };
}
