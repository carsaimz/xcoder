import {
	getEffectiveKeyBindings,
	getRegisteredCommands,
	resetKeyBindings,
	saveKeyBindings,
} from "cm/commandRegistry";
import { normalizeKeyCombo } from "cm/keyBindingUtils";
import settingsPage from "components/settingsPage";
import toast from "components/toast";
import confirm from "dialogs/confirm";
import Url from "utils/Url";

/**
 * Keyboard shortcuts editor (VS Code «Preferences: Keyboard Shortcuts»).
 *
 * One row per registered command with its effective key; tapping a row
 * prompts for a new combination (typed: «Ctrl-Shift-P», chords like
 * «Ctrl-K Ctrl-C», or empty to unbind). Conflicts are detected by the
 * commandRegistry (priority rules apply) and reported as a toast; «reset»
 * restores the defaults. The raw bindings file stays available for
 * power users under «edit bindings file».
 */
export default function keybindingsEditor() {
	const bindingsFile = Url.join(window.DATA_STORAGE, ".key-bindings.json");

	const effective = getEffectiveKeyBindings();
	const commands = getRegisteredCommands()
		.map((command) => {
			const name = command.name;
			const keys = effective[name]?.join(" ") || "";
			const label = strings[`cmd:${name}`] || command.description || name;
			return {
				command,
				keys,
				label,
			};
		})
		.sort((left, right) => left.label.localeCompare(right.label));

	const items = [
		{
			key: "kb-reset",
			text: strings["reset key bindings"],
			info: strings["reset key bindings confirm"],
			chevron: true,
		},
		{
			key: "kb-edit-json",
			text: strings["edit key bindings json"],
			info: bindingsFile,
			chevron: true,
		},
		...commands.map(({ command, keys, label }) => ({
			key: `kb:${command.name}`,
			text: label,
			value: keys || "—",
			prompt: strings["press key combo"],
			promptType: "text",
			promptOptions: {
				required: false,
				test: (value) => {
					const normalized = normalizeKeyCombo(value);
					if (normalized === null) {
						toast(strings["invalid key combo"]);
						return false;
					}
					return true;
				},
			},
			info: command.name,
		})),
	];

	const page = settingsPage(
		strings["key bindings"],
		items,
		callback,
		undefined,
		{
			preserveOrder: true,
			pageClassName: "detail-settings-page",
			listClassName: "detail-settings-list",
			infoAsDescription: true,
			valueInTail: true,
			defaultSearchGroup: strings["key bindings"],
		},
	);

	return page;

	async function callback(key, value) {
		if (key === "kb-reset") {
			const ok = await confirm(
				strings.warning,
				strings["reset key bindings confirm"],
			);
			if (!ok) return;
			await resetKeyBindings();
			toast(strings["key bindings restored"]);
			page?.hide?.();
			keybindingsEditor();
			return;
		}

		if (key === "kb-edit-json") {
			const { default: openFile } = await import("lib/openFile");
			openFile(bindingsFile);
			return;
		}

		if (key.startsWith("kb:")) {
			const name = key.slice(3);
			const combo = String(value ?? "").trim();
			// normalizeKeyCombo already validated via promptOptions.test —
			// empty input unbinds, anything else must be a valid combo.
			const normalized = normalizeKeyCombo(combo);
			if (normalized === null) return;
			const conflicts = await saveKeyBindings({ [name]: normalized || null });
			toast(
				normalized
					? conflicts.length
						? strings["key conflict warning"]
						: strings["key binding saved"]
					: strings["key binding cleared"],
			);
			// other rows may have gained/lost their effective key
			page?.hide?.();
			keybindingsEditor();
		}
	}
}
