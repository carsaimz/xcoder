const ARROW_KEY_MAP = {
	left: "ArrowLeft",
	right: "ArrowRight",
	up: "ArrowUp",
	down: "ArrowDown",
};

const SPECIAL_KEY_MAP = {
	esc: "Escape",
	escape: "Escape",
	return: "Enter",
	enter: "Enter",
	space: "Space",
	del: "Delete",
	delete: "Delete",
	backspace: "Backspace",
	tab: "Tab",
	home: "Home",
	end: "End",
	pageup: "PageUp",
	pagedown: "PageDown",
	insert: "Insert",
};

const MODIFIER_MAP = {
	mod: "Mod",
	ctrl: "Mod",
	control: "Mod",
	cmd: "Mod",
	meta: "Mod",
	shift: "Shift",
	alt: "Alt",
	option: "Alt",
};

const MODIFIER_ORDER = ["Mod", "Alt", "Shift"];

export function toCodeMirrorKey(combo) {
	if (!combo) return null;
	const strokes = String(combo)
		.trim()
		.split(/\s+/)
		.map(toCodeMirrorKeyStroke)
		.filter(Boolean);
	return strokes.length ? strokes.join(" ") : null;
}

export function canonicalizeKeyBinding(combo) {
	return toCodeMirrorKey(combo)?.toLowerCase() || null;
}

/**
 * Validates a typed key combination («Ctrl-Shift-P», «Alt-Shift-F», a
 * chord «Ctrl-K Ctrl-C», or an empty string to unbind).
 * @param {string} value raw user input
 * @returns {string|null} the canonical combo, or null when invalid
 * (empty input is valid and yields "")
 */
/** Keys accepted by the shortcuts editor (beyond single characters). */
const NAMED_KEYS = new Set([
	"Escape",
	"Enter",
	"Space",
	"Delete",
	"Backspace",
	"Tab",
	"Home",
	"End",
	"PageUp",
	"PageDown",
	"Insert",
	"ArrowLeft",
	"ArrowRight",
	"ArrowUp",
	"ArrowDown",
]);

function isKnownKey(key) {
	if (!key) return false;
	if (NAMED_KEYS.has(key)) return true;
	if (/^F([1-9]|1[0-9]|2[0-4])$/.test(key)) return true;
	// any single printable character (letters, digits, punctuation)
	return [...key].length === 1;
}

/** Final key token of one CodeMirror stroke («Mod-d» → «d», «Mod--» → «-»). */
function strokeKey(stroke) {
	if (stroke.endsWith("--")) return "-";
	const index = stroke.lastIndexOf("-");
	return index === -1 ? stroke : stroke.slice(index + 1);
}

export function normalizeKeyCombo(value) {
	const combo = String(value ?? "").trim();
	if (!combo) return "";
	const cmKey = toCodeMirrorKey(combo);
	if (!cmKey) return null;
	// The raw parser accepts any leftover token as the key («not-a-key»
	// would silently become «key») — every stroke must end in a real key.
	for (const stroke of cmKey.split(" ")) {
		if (!isKnownKey(strokeKey(stroke))) return null;
	}
	return cmKey;
}

/**
 * CodeMirror cannot use a key as both a command and a multi-stroke prefix.
 * Chords that merely share a prefix (for example Ctrl-K C and Ctrl-K U) are
 * compatible with each other.
 */
export function keyBindingsConflict(left, right) {
	const leftKey = canonicalizeKeyBinding(left);
	const rightKey = canonicalizeKeyBinding(right);
	if (!leftKey || !rightKey) return false;
	return (
		leftKey === rightKey ||
		leftKey.startsWith(`${rightKey} `) ||
		rightKey.startsWith(`${leftKey} `)
	);
}

function toCodeMirrorKeyStroke(stroke) {
	const parts = stroke.endsWith("-")
		? [...stroke.slice(0, -1).split("-").filter(Boolean), "-"]
		: stroke
				.split("-")
				.map((part) => part.trim())
				.filter(Boolean);
	const modifiers = new Set();
	let key = null;

	parts.forEach((part) => {
		const lower = part.toLowerCase();
		if (MODIFIER_MAP[lower]) {
			modifiers.add(MODIFIER_MAP[lower]);
			return;
		}

		if (ARROW_KEY_MAP[lower]) {
			key = ARROW_KEY_MAP[lower];
			return;
		}

		if (SPECIAL_KEY_MAP[lower]) {
			key = SPECIAL_KEY_MAP[lower];
			return;
		}

		if (part.length === 1 && /[a-z]/i.test(part)) {
			key = part.toLowerCase();
			return;
		}

		key = part;
	});

	if (!key) return null;
	const orderedModifiers = MODIFIER_ORDER.filter((modifier) =>
		modifiers.has(modifier),
	);
	return orderedModifiers.length ? `${orderedModifiers.join("-")}-${key}` : key;
}
