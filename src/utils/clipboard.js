/**
 * Shared clipboard helper — three-level fallback used across the app:
 * cordova clipboard plugin → async clipboard API → textarea+execCommand.
 * @param {string} text
 * @returns {Promise<void>}
 */
export function copyText(text) {
	const value = String(text ?? "");
	if (typeof cordova !== "undefined" && cordova.plugins?.clipboard?.copy) {
		return new Promise((resolve, reject) => {
			cordova.plugins.clipboard.copy(
				value,
				() => resolve(),
				(error) => {
					navigatorClipboard(value)
						.then(resolve)
						.catch(() => reject(error));
				},
			);
		});
	}
	return navigatorClipboard(value);
}

/**
 * @param {string} value
 * @returns {Promise<void>}
 */
function navigatorClipboard(value) {
	if (navigator.clipboard?.writeText) {
		return navigator.clipboard
			.writeText(value)
			.catch(() => execCommandCopy(value));
	}
	return execCommandCopy(value);
}

/**
 * @param {string} value
 * @returns {Promise<void>}
 */
function execCommandCopy(value) {
	return new Promise((resolve, reject) => {
		try {
			const $textarea = document.createElement("textarea");
			$textarea.value = value;
			$textarea.style.position = "fixed";
			$textarea.style.opacity = "0";
			document.body.append($textarea);
			$textarea.select();
			const ok = document.execCommand("copy");
			$textarea.remove();
			if (ok) resolve();
			else reject(new Error("copy failed"));
		} catch (error) {
			reject(error);
		}
	});
}

/**
 * Reads text from the clipboard when the platform allows it.
 * @returns {Promise<string>} "" when unavailable
 */
export function pasteText() {
	if (typeof cordova !== "undefined" && cordova.plugins?.clipboard?.paste) {
		return new Promise((resolve) => {
			cordova.plugins.clipboard.paste((value) => resolve(String(value ?? "")));
		});
	}
	if (navigator.clipboard?.readText) {
		return navigator.clipboard.readText().catch(() => "");
	}
	return Promise.resolve("");
}
