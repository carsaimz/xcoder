/**
 * Extracts the changelog section of one version from a CHANGELOG.md text.
 *
 * Supports both heading styles used in the XCoder changelog:
 * `## [1.8.30] - 2026-11-23` and `## v1.8.30`. The section body runs up to
 * the next heading of the same level (or the end of the file).
 * @param {string} markdown full changelog text
 * @param {string} version e.g. "1.8.30"
 * @returns {string|null} section body (heading line excluded), or null
 */
export function extractChangelogSection(markdown, version) {
	if (!markdown || !version) return null;
	const escaped = String(version).replace(/\./g, "\\.");
	const pattern = new RegExp(
		`(^|\\n)#{2,3}\\s*\\[?v?${escaped}(?=\\s|\\])\\]?[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
	);
	const match = String(markdown).match(pattern);
	const body = match?.[2]?.trim();
	return body ? body : null;
}
