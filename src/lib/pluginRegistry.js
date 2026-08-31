import registryJson from "res/plugin-registry.json";

/**
 * XCoder local plugin registry.
 *
 * XCoder is offline-first: there is no remote marketplace server. The
 * registry below is bundled with the app (`src/res/plugin-registry.json`)
 * and lists plugins that can be installed directly from their source URL.
 *
 * Plugins can also always be installed from any direct URL (http/https)
 * or from a local `.zip` file via the "Add source" button.
 */
const plugins = Array.isArray(registryJson?.plugins)
	? registryJson.plugins.filter((plugin) => plugin && plugin.id)
	: [];

export default {
	/**
	 * @returns {Promise<Array<object>>} all registry plugins
	 */
	async list() {
		return plugins.map((plugin) => ({
			...plugin,
			price: 0,
			author_verified: Boolean(plugin.author_verified),
		}));
	},

	/**
	 * @param {string} id
	 * @returns {Promise<object|null>} registry plugin or null
	 */
	async get(id) {
		const plugin = plugins.find((item) => item.id === id);
		return plugin ? { ...plugin, price: 0 } : null;
	},

	/**
	 * @param {string} query
	 * @returns {Promise<Array<object>>} plugins matching the query
	 */
	async search(query) {
		const term = String(query || "")
			.trim()
			.toLowerCase();
		if (!term) return [];
		const all = await this.list();
		return all.filter((plugin) => {
			const haystack = [
				plugin.name,
				plugin.description,
				Array.isArray(plugin.keywords) ? plugin.keywords.join(" ") : "",
			]
				.join(" ")
				.toLowerCase();
			return haystack.includes(term);
		});
	},
};
