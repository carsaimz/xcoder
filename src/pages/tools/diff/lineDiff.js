/**
 * Line diff (LCS) for the visual diff tool.
 *
 * Pure and dependency-free so the stats are unit-testable and cheap:
 * typical source files stay well under the quadratic LCS budget, and
 * very large documents degrade to a prefix/suffix trim before the LCS
 * runs, keeping the common case (a few edited lines) linear.
 */

/**
 * @typedef {Object} DiffRow
 * @property {"equal"|"add"|"del"} type row kind
 * @property {number} [aLine] 1-based line in the left document
 * @property {number} [bLine] 1-based line in the right document
 */

const MAX_LCS_CELLS = 4000000;

/**
 * Splits text into lines (no trailing-empty artifact for "\n" endings).
 * @param {string} text
 * @returns {string[]}
 */
export function splitLines(text) {
	if (text === "" || text == null) return [];
	return String(text).split("\n");
}

/**
 * Classic LCS table diff between two line arrays.
 * @param {string[]} a left lines
 * @param {string[]} b right lines
 * @returns {DiffRow[]}
 */
export function diffLines(a, b) {
	const rows = [];
	const n = a.length;
	const m = b.length;

	// trim the common prefix/suffix — makes edits inside big files linear
	let start = 0;
	while (start < n && start < m && a[start] === b[start]) start++;
	let endA = n;
	let endB = m;
	while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
		endA--;
		endB--;
	}

	for (let i = 0; i < start; i++) {
		rows.push({ type: "equal", aLine: i + 1, bLine: i + 1 });
	}

	const midA = a.slice(start, endA);
	const midB = b.slice(start, endB);

	if (midA.length * midB.length > MAX_LCS_CELLS) {
		// too big for a full table — emit the middle as del+add blocks
		pushBlock(rows, "del", midA, (i) => start + i + 1);
		pushBlock(rows, "add", midB, (i) => start + i + 1);
	} else {
		pushLcs(rows, midA, midB, start);
	}

	for (let i = 0; i < n - endA; i++) {
		rows.push({
			type: "equal",
			aLine: endA + i + 1,
			bLine: endB + i + 1,
		});
	}
	return rows;
}

/** @param {DiffRow[]} rows @param {"del"|"add"} type @param {string[]} lines @param {(i: number) => number} lineNo */
function pushBlock(rows, type, lines, lineNo) {
	lines.forEach((_, i) => {
		rows.push(
			type === "del" ? { type, aLine: lineNo(i) } : { type, bLine: lineNo(i) },
		);
	});
}

/** LCS-backed middle diff with line numbers mapped back to full documents. */
function pushLcs(rows, midA, midB, offset) {
	const n = midA.length;
	const m = midB.length;
	// dp[i][j] = LCS length of midA[i..] / midB[j..]
	const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			dp[i][j] =
				midA[i] === midB[j]
					? dp[i + 1][j + 1] + 1
					: Math.max(dp[i + 1][j], dp[i][j + 1]);
		}
	}

	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (midA[i] === midB[j]) {
			rows.push({
				type: "equal",
				aLine: offset + i + 1,
				bLine: offset + j + 1,
			});
			i++;
			j++;
		} else if (dp[i + 1][j] >= dp[i][j + 1]) {
			rows.push({ type: "del", aLine: offset + i + 1 });
			i++;
		} else {
			rows.push({ type: "add", bLine: offset + j + 1 });
			j++;
		}
	}
	while (i < n) {
		rows.push({ type: "del", aLine: offset + i + 1 });
		i++;
	}
	while (j < m) {
		rows.push({ type: "add", bLine: offset + j + 1 });
		j++;
	}
}

/**
 * Summary numbers for the header chips.
 * @param {string} leftText
 * @param {string} rightText
 * @returns {{added: number, removed: number, changed: number, identical: boolean}}
 */
export function diffStats(leftText, rightText) {
	const rows = diffLines(splitLines(leftText), splitLines(rightText));
	let added = 0;
	let removed = 0;
	for (const row of rows) {
		if (row.type === "add") added++;
		else if (row.type === "del") removed++;
	}
	// a del run immediately followed by an add run is one changed region
	const changed = Math.min(countRuns(rows, "del"), countRuns(rows, "add"));
	return {
		added,
		removed,
		changed,
		identical: added === 0 && removed === 0,
	};
}

/** @param {DiffRow[]} rows @param {"add"|"del"} type */
function countRuns(rows, type) {
	let runs = 0;
	let inRun = false;
	for (const row of rows) {
		if (row.type === type) {
			if (!inRun) runs++;
			inRun = true;
		} else {
			inRun = false;
		}
	}
	return runs;
}
