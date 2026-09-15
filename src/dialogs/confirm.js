import Checkbox from "components/checkbox";
import DOMPurify from "dompurify";
import actionStack from "lib/actionStack";
import restoreTheme from "lib/restoreTheme";

/**
 * Confirm dialog box
 * @param {string} titleText Title text
 * @param {string} [message] Alert message
 * @param {boolean} [isHTML] Whether the message is HTML
 * @param {{checkboxText?: string, returnState?: boolean, direction?: "ltr" | "rtl", aboveOverlay?: boolean}} [options]
 * @returns {Promise<boolean | {confirmed: boolean, checked: boolean}>}
 */
function confirm(titleText, message, isHTML, options = {}) {
	return new Promise((resolve) => {
		if (!message && titleText) {
			message = titleText;
			titleText = "";
		}

		const titleSpan = tag("strong", {
			className: "title",
			textContent: titleText,
		});
		const messageSpan = tag("span", {
			className: "message scroll",
			innerHTML: isHTML ? DOMPurify.sanitize(message) : undefined,
			textContent: isHTML ? undefined : message,
		});
		const checkbox = options.checkboxText
			? Checkbox(options.checkboxText, false)
			: null;
		if (checkbox) {
			checkbox.classList.add("confirm-checkbox");
		}
		const getResponse = (confirmed) => {
			if (!options.returnState) return confirmed;
			return {
				confirmed,
				checked: Boolean(checkbox?.checked),
			};
		};
		/** set by OK/cancel so the back-dismiss path never overrides them */
		let settled = false;
		const settle = (confirmed) => {
			if (settled) return;
			settled = true;
			resolve(getResponse(confirmed));
		};
		const okBtn = tag("button", {
			textContent: strings.ok,
			onclick: function () {
				settle(true);
				hide();
			},
		});
		const cancelBtn = tag("button", {
			textContent: strings.cancel,
			onclick: function () {
				settle(false);
				hide();
			},
		});
		const confirmDiv = tag("div", {
			className: `prompt confirm${options.aboveOverlay ? " above-overlay" : ""}`,
			dir: options.direction,
			children: [
				titleSpan,
				messageSpan,
				checkbox,
				tag("div", {
					className: "button-container",
					children: [cancelBtn, okBtn],
				}),
			].filter(Boolean),
		});
		const mask = tag("span", {
			className: "mask",
		});

		actionStack.push({
			id: "confirm",
			action: hideAlert,
		});

		app.append(confirmDiv, mask);
		restoreTheme(true);

		function hideAlert() {
			// resolve as CANCELLED when the dialog leaves the screen without
			// an explicit OK/cancel (hardware back via actionStack) — the
			// awaiting code used to hang forever on back-dismiss
			settle(false);
			confirmDiv.classList.add("hide");
			restoreTheme();
			setTimeout(() => {
				app.removeChild(confirmDiv);
				app.removeChild(mask);
			}, 300);
		}

		function hide() {
			actionStack.remove("confirm");
			hideAlert();
		}
	});
}

export default confirm;
