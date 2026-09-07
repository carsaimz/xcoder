/**
 * Model id normalization shared by the API client and the provider
 * catalog.
 */

/**
 * Removes vendor list prefixes from model ids: Google's /models
 * endpoint reports ids as "models/gemini-2.5-flash", but chat requests
 * and the UI use the bare id. Only a LEADING prefix is stripped — ids
 * like "accounts/fireworks/models/llama4-..." are untouched.
 * @param {string} model
 * @returns {string}
 */
export function normalizeModelId(model) {
	return String(model || "")
		.trim()
		.replace(/^models\//, "");
}
