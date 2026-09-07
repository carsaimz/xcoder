/**
 * Model picker dialog for the AI chat — a rich, searchable replacement
 * for the text-only native select: real brand logos per provider,
 * free/paid badges, live search filter and footer actions (fetch live
 * model list / type an id manually).
 *
 * Follows the dialogs/select.js pattern (promise + actionStack + mask)
 * so the back button and the theme restore behave like every other
 * dialog in the app.
 */
import "./style.scss";
import actionStack from "lib/actionStack";
import { isLetterGlyph, providerIcon } from "lib/ai/providers";
import restoreTheme from "lib/restoreTheme";
import { filterModelItems, providerLogoEl } from "./utils";

/**
 * Builds the provider logo element for a provider id (resolves the
 * brand icon and hands it to the pure renderer in ./utils).
 * @param {string} providerId
 * @returns {HTMLElement}
 */
function logoFor(providerId) {
	const icon = providerIcon(providerId);
	return providerLogoEl({ ...icon, isLetter: isLetterGlyph(icon.glyph) });
}

/**
 * @typedef {object} ModelPickerItem
 * @property {boolean} [header] group header row (non-selectable)
 * @property {string} [providerId] provider whose logo is shown
 * @property {string} [text] row/header label
 * @property {string} [value] resolved when the row is picked
 * @property {"free"|"paid"} [type] renders the price badge
 * @property {boolean} [selected] checkmark + highlight
 * @property {boolean} [disabled] not pickable (e.g. API key missing)
 */

/**
 * Opens the model picker.
 * @param {object} opts
 * @param {string} [opts.title]
 * @param {string} [opts.placeholder] search input placeholder
 * @param {ModelPickerItem[]} [opts.items]
 * @param {string} [opts.freeLabel] translated "free" badge label
 * @param {string} [opts.paidLabel] translated "paid" badge label
 * @param {Array<{value: string, text: string}>} [opts.actions] footer actions
 * @returns {Promise<string|null>} picked value / action value / null
 */
function modelPicker({
	title,
	placeholder,
	items = [],
	freeLabel = "free",
	paidLabel = "paid",
	actions = [],
} = {}) {
	return new Promise((res) => {
		/** @type {{item: ModelPickerItem, $el: HTMLElement|null}[]} */
		const rows = items.map((item) => ({ item, $el: null }));

		const buildRow = (row, index) => {
			const { item } = row;
			if (item.header) {
				row.$el = (
					<li className="mp-group">
						{item.providerId ? logoFor(item.providerId) : null}
						<span className="text">{item.text}</span>
					</li>
				);
				return row.$el;
			}

			const $badge = item.type ? (
				<span className={`mp-badge ${item.type === "free" ? "free" : "paid"}`}>
					{item.type === "free" ? freeLabel : paidLabel}
				</span>
			) : null;
			const $row = (
				<li className="mp-item" tabIndex="0">
					{item.providerId ? logoFor(item.providerId) : null}
					<span className="text">
						{item.selected ? `✓ ${item.text}` : item.text}
					</span>
					{$badge}
				</li>
			);
			if (item.selected) $row.classList.add("selected");
			if (item.disabled) {
				$row.classList.add("disabled");
			} else {
				$row.onclick = () => {
					hide();
					res(item.value);
				};
			}
			row.$el = $row;
			return $row;
		};

		const $list = (
			<ul className="scroll no-text-transform mp-list">{rows.map(buildRow)}</ul>
		);
		const $mask = <span className="mask" onclick={cancel}></span>;
		const $dialog = (
			<div className="prompt select model-picker">
				<div className="mp-header">
					{title ? <strong className="title">{title}</strong> : null}
					<input
						type="text"
						className="mp-search"
						placeholder={placeholder || "Search"}
						oninput={applyFilter}
					/>
				</div>
				{$list}
				{actions.length ? (
					<div className="mp-footer">
						{actions.map((action) => (
							<button
								className="mp-action"
								onclick={() => {
									hide();
									res(action.value);
								}}
							>
								{action.text}
							</button>
						))}
					</div>
				) : null}
			</div>
		);

		function applyFilter() {
			const visible = filterModelItems(items, $search.value);
			rows.forEach((row, index) => {
				if (row.$el) row.$el.style.display = visible.has(index) ? "" : "none";
			});
		}

		function cancel() {
			hide();
		}

		function hide() {
			actionStack.remove("model-picker");
			$dialog.classList.add("hide");
			restoreTheme();
			setTimeout(() => {
				$dialog.remove();
				$mask.remove();
			}, 300);
		}

		actionStack.push({
			id: "model-picker",
			action: cancel,
		});

		app.append($dialog, $mask);

		const $search = $dialog.querySelector(".mp-search");
		const $first =
			$list.querySelector(".mp-item.selected") ||
			$list.querySelector(".mp-item");
		if ($first && $first.focus) $first.focus();
	});
}

export default modelPicker;
