import toast from "components/toast";
import select from "dialogs/select";
import { BUILTIN_SKILLS, listSkills } from "lib/ai/skills";
import settings from "lib/settings";
import helpers from "utils/helpers";

/**
 * Skills management — pick a skill to enable/disable it. Disabled skills
 * are hidden from the agent's system prompt and cannot be loaded with
 * load_skill. Workspace skills (.xcoder/skills/*.md) appear here too.
 */
export default async function aiSkillsSettings() {
	let skills;
	try {
		skills = await listSkills();
	} catch {
		skills = BUILTIN_SKILLS.map((skill) => ({ ...skill, source: "builtin" }));
	}

	const disabled = new Set(
		Array.isArray(settings.value.aiDisabledSkills)
			? settings.value.aiDisabledSkills.map((name) =>
					String(name).toLowerCase(),
				)
			: [],
	);

	const items = skills.map((skill) => {
		const on = !disabled.has(skill.name.toLowerCase());
		const sourceTag = skill.source === "workspace" ? " · workspace" : "";
		return {
			value: skill.name,
			text: `${on ? "✓" : "✗"} ${skill.name}${sourceTag}\n${skill.description}`,
		};
	});
	items.push({
		text: strings["ai skills hint"] || "Toque numa skill para ativar/desativar",
		className: "group-header",
	});

	const picked = await select(strings["ai skills"] || "Skills", items);
	if (!picked) return;

	const name = String(picked).toLowerCase();
	if (disabled.has(name)) {
		disabled.delete(name);
	} else {
		disabled.add(name);
	}
	try {
		await settings.update({ aiDisabledSkills: [...disabled] });
		toast(
			disabled.has(name)
				? strings["ai skill disabled"] || "Skill desativada"
				: strings["ai skill enabled"] || "Skill ativada",
			2000,
		);
	} catch (error) {
		helpers.error(error);
	}
}
