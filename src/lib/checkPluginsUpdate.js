/**
 * XCoder: the remote plugin registry was removed (offline-first, no server
 * dependency). Server-based plugin update checks are disabled.
 *
 * @returns {Promise<string[]>} list of plugin ids with updates (always empty)
 */
export default async function checkPluginsUpdate() {
	return [];
}
