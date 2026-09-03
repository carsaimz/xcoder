/**
 * SweetAlert2 dialogs, themed for XCoder.
 *
 * The library is lazy-loaded as its own webpack chunk (works offline —
 * it is bundled, not a CDN script). Used by the newer surfaces (AI chat,
 * premium/support) for modern confirmations and toasts; the classic app
 * dialogs remain available everywhere else.
 *
 * The popup follows the running theme through the app CSS variables —
 * see styles/sweetalert.scss (popup class "xcoder-swal").
 */

/** @type {Promise<any> | null} cached module promise */
let promise = null;

/**
 * @returns {Promise<any>} the SweetAlert2 default export
 */
function load() {
	if (!promise) {
		promise = import(/* webpackChunkName: "sweetalert2" */ "sweetalert2").then(
			(module) => module.default || module,
		);
	}
	return promise;
}

/**
 * Fires a themed SweetAlert2 dialog.
 * @param {object} options SweetAlert2 options
 * @returns {Promise<any>} the result object
 */
export async function swalFire(options) {
	const Swal = await load();
	return Swal.fire({
		customClass: {
			popup: "xcoder-swal",
			confirmButton: "xcoder-swal-confirm",
			cancelButton: "xcoder-swal-cancel",
			title: "xcoder-swal-title",
			htmlContainer: "xcoder-swal-html",
		},
		buttonsStyling: false,
		reverseButtons: true,
		...options,
	});
}

/**
 * Confirmation dialog (question/warning icon + confirm & cancel).
 * @param {string} title
 * @param {string} [text]
 * @param {object} [options] extra SweetAlert2 options (icon, confirmText…)
 * @returns {Promise<boolean>} true when confirmed
 */
export async function swalConfirm(title, text, options = {}) {
	const { icon, confirmButtonText, cancelButtonText, ...rest } = options;
	const result = await swalFire({
		title,
		text: text || "",
		icon: icon || "question",
		showCancelButton: true,
		confirmButtonText:
			confirmButtonText || window.strings?.["confirm"] || "Confirm",
		cancelButtonText:
			cancelButtonText || window.strings?.["cancel"] || "Cancel",
		...rest,
	});
	return Boolean(result.isConfirmed);
}

/**
 * Information dialog with a single button.
 * @param {string} title
 * @param {string} [text]
 * @param {object} [options] extra options (icon "success" | "error" | "info" | "warning")
 * @returns {Promise<void>}
 */
export async function swalInfo(title, text, options = {}) {
	const { icon, confirmButtonText, ...rest } = options;
	await swalFire({
		title,
		text: text || "",
		icon: icon || "info",
		showCancelButton: false,
		confirmButtonText: confirmButtonText || window.strings?.["ok"] || "OK",
		...rest,
	});
}

/**
 * Small themed toast (top corner, auto dismiss).
 * @param {"success" | "error" | "warning" | "info"} icon
 * @param {string} title
 * @param {number} [timer=2500]
 * @returns {Promise<void>}
 */
export async function swalToast(icon, title, timer = 2500) {
	const Swal = await load();
	Swal.fire({
		toast: true,
		position: "top",
		icon,
		title,
		showConfirmButton: false,
		timer,
		timerProgressBar: true,
		customClass: { popup: "xcoder-swal" },
	});
}

export default {
	swalFire,
	swalConfirm,
	swalInfo,
	swalToast,
};
