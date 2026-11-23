/**
 * Acode compatibility bridge ("ponte Acode").
 *
 * XCoder is a fork of Acode and keeps the entire Acode plugin runtime:
 * the same API class (setPluginInit / setPluginUnmount / require / exec /
 * installPlugin / formatters / editor themes...), editorManager,
 * actionStack, toast, strings and the module registry. Plugins built for
 * the Acode store only differ in the global they talk to — `window.acode`.
 *
 * This bridge publishes the very same API instance under both names, so
 * Acode plugins run unmodified next to XCoder plugins:
 *
 *   window.acode === window.xcoder
 *   acode.require("fsOperation") === xcoder.require("fsOperation")
 *
 * Marketplace ids are resolved by lib/pluginRegistry.js, which merges the
 * Acode store (https://acode.app/api) into the XCoder registry — so
 * `acode.installPlugin("some.acode.plugin")` resolves and installs Acode
 * plugins as well, and Acode plugin dependencies (manifest
 * `dependencies`) resolve through the same bridge.
 *
 * @param {object} [api] XCoder API singleton (defaults to window.xcoder)
 * @returns {object|null} the bridged API instance
 */
export function ensureAcodeCompat(api) {
	if (typeof window === "undefined") return null;
	const bridge = api || window.xcoder;
	if (!bridge) return null;
	if (window.acode === bridge) return bridge;
	try {
		Object.defineProperty(bridge, "isAcodeCompatBridge", {
			value: true,
			enumerable: false,
			writable: false,
			configurable: false,
		});
	} catch (error) {
		// Frozen or sealed instance — the alias itself is what matters.
	}
	window.acode = bridge;
	console.info("[XCoder] Acode compatibility bridge active (window.acode)");
	return bridge;
}
