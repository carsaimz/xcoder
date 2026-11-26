/**
 * Zen mode — VS Code "Zen Mode" port (app chrome out of the way, editor
 * only). Hides the header, sidebar, file tabs, breadcrumbs, quick tools
 * and status bar while a small floating chip stays on screen so the mode
 * can be left with one tap (mobile-friendly, no keyboard needed).
 */

let active = false;
let $chip = null;

const t = (key, fallback) =>
	(typeof strings === "object" && strings[key]) || fallback;

/** @returns {boolean} whether zen mode is currently active */
export function isZenMode() {
	return active;
}

/** Enters zen mode (no-op when already active). */
export function enterZenMode() {
	if (active) return;
	active = true;
	document.documentElement.classList.add("zen-mode");
	app.append(makeChip());
	toast(t("zen mode on", "Modo zen ativado — toque no ✕ para voltar"), 2500);
}

/** Leaves zen mode (no-op when inactive). */
export function exitZenMode() {
	if (!active) return;
	active = false;
	document.documentElement.classList.remove("zen-mode");
	$chip?.remove();
	$chip = null;
}

/** Toggles zen mode — the action behind the «toggle-zen-mode» command. */
export function toggleZenMode() {
	if (active) exitZenMode();
	else enterZenMode();
}

function makeChip() {
	if ($chip) return $chip;
	$chip = document.createElement("button");
	$chip.type = "button";
	$chip.className = "zen-exit-chip";
	$chip.setAttribute("title", t("exit zen mode", "Sair do modo zen"));

	const $icon = document.createElement("span");
	$icon.className = "icon codicon-chrome-close";

	const $label = document.createElement("span");
	$label.className = "zen-exit-chip-text";
	$label.textContent = t("exit zen mode", "Sair do modo zen");

	$chip.append($icon, $label);
	$chip.addEventListener("click", exitZenMode);
	return $chip;
}
