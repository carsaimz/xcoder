import toast from "components/toast";
import alert from "dialogs/alert";
import confirm from "dialogs/confirm";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import FileBrowser from "pages/fileBrowser";
import {
	BUILTIN_SKILLS,
	listSkills,
	parseSkillMarkdown,
	slugify,
} from "lib/ai/skills";
import {
	deleteImportedSkill,
	githubToRaw,
	saveImportedSkill,
	getSkillsIo,
} from "lib/ai/skillsStorage";
import fsOperation from "fileSystem";
import settings from "lib/settings";
import helpers from "utils/helpers";

const t = (key, fallback) => strings[key] || fallback;

/** Reads the text of a picked local file (file browser url). */
async function readLocalFile(url) {
	return fsOperation(url).readFile("utf8");
}

/** Fetches the text of a raw/converted URL (cordova http or ajax). */
async function readRemoteText(url) {
	return fsOperation(githubToRaw(url)).readFile("utf8");
}

/** Saves parsed markdown under a unique imported name; returns skill name. */
async function importSkillMarkdown(raw, fallbackName) {
	const parsed = parseSkillMarkdown(raw, fallbackName);
	if (!parsed?.body) {
		throw new Error(t("ai skill empty", "Ficheiro de skill vazio"));
	}
	await saveImportedSkill(`${parsed.name}.md`, raw);
	return parsed.name;
}

async function importFromFile() {
	const picked = await FileBrowser(
		"file",
		t("select skill file", "Selecionar ficheiro de skill"),
	);
	if (!picked?.url) return;
	const raw = await readLocalFile(picked.url);
	const base = String(picked.url).split("/").pop().replace(/\.md$/i, "");
	const name = await importSkillMarkdown(raw, slugify(base) || "skill");
	toast(`✓ ${t("ai skill imported", "Skill importada")}: ${name}`, 3000);
}

async function importFromUrl() {
	const url = await prompt(
		t("ai skill url prompt", "URL da skill (GitHub aceita)"),
		"https://",
		"url",
	);
	if (!url) return;
	const raw = await readRemoteText(url);
	const base = decodeURIComponent(String(url).split("/").pop() || "skill")
		.replace(/\.md$/i, "")
		.replace(/[?#].*$/, "");
	const name = await importSkillMarkdown(raw, slugify(base) || "skill");
	toast(`✓ ${t("ai skill imported", "Skill importada")}: ${name}`, 3000);
}

async function importFromPaste() {
	const text = await prompt(
		t("ai skill paste prompt", "Conteúdo markdown da skill"),
		"",
		"textarea",
	);
	if (!text?.trim()) return;
	const parsed = parseSkillMarkdown(text, "skill");
	const suggested = parsed?.name && parsed.name !== "skill" ? parsed.name : "";
	const name = await prompt(
		t("ai skill name prompt", "Nome da skill"),
		suggested || "nova-skill",
		"text",
	);
	if (!name?.trim()) return;
	await importSkillMarkdown(text, slugify(name) || "skill");
	toast(`✓ ${t("ai skill imported", "Skill importada")}`, 3000);
}

const IMPORTERS = {
	"@import:file": importFromFile,
	"@import:url": importFromUrl,
	"@import:paste": importFromPaste,
};

/**
 * Skills management — pick a skill to enable/disable it; imported skills
 * can also be viewed or deleted. Import actions live at the bottom of the
 * list (file, URL/GitHub, paste). Disabled skills are hidden from the
 * agent's system prompt and cannot be loaded with load_skill.
 */
export default async function aiSkillsSettings() {
	const io = getSkillsIo();
	let skills;
	try {
		skills = await listSkills(io || {});
	} catch {
		skills = BUILTIN_SKILLS.map((skill) => ({ ...skill, source: "builtin" }));
	}

	const disabled = () =>
		new Set(
			Array.isArray(settings.value.aiDisabledSkills)
				? settings.value.aiDisabledSkills.map((name) =>
						String(name).toLowerCase(),
					)
				: [],
		);

	while (true) {
		const disabledSet = disabled();
		const items = skills.map((skill) => {
			const on = !disabledSet.has(skill.name.toLowerCase());
			const sourceTag =
				skill.source === "workspace"
					? " · workspace"
					: skill.source === "imported"
						? " · importado"
						: "";
			return {
				value: skill.name,
				text: `${on ? "✓" : "✗"} ${skill.name}${sourceTag}\n${skill.description}`,
			};
		});
		items.push({
			text: t("ai skills import file", "＋ Importar do ficheiro…"),
			value: "@import:file",
			className: "group-header",
		});
		items.push({
			text: t("ai skills import url", "＋ Importar de URL / GitHub…"),
			value: "@import:url",
			className: "group-header",
		});
		items.push({
			text: t("ai skills import paste", "＋ Colar nova skill…"),
			value: "@import:paste",
			className: "group-header",
		});
		items.push({
			text:
				t("ai skills hint", "Toque numa skill para ativar/desativar") ||
				"Toque numa skill para ativar/desativar",
			className: "group-header",
		});

		const picked = await select(t("ai skills", "Skills"), items);
		if (!picked) return;

		if (String(picked).startsWith("@import:")) {
			const importer = IMPORTERS[String(picked)];
			try {
				await importer();
				skills = await listSkills(io || {});
			} catch (error) {
				if (error) {
					helpers.error(error);
				}
			}
			continue;
		}

		const name = String(picked).toLowerCase();
		const skill = skills.find((entry) => entry.name.toLowerCase() === name);

		if (skill?.source === "imported") {
			const action = await select(skill.name, [
				{
					value: "toggle",
					text: disabledSet.has(name)
						? `✓ ${t("ai skill enable", "Ativar")}`
						: `✗ ${t("ai skill disable", "Desativar")}`,
				},
				{ value: "view", text: t("ai skill view", "Ver conteúdo") },
				{ value: "delete", text: t("ai skill delete", "Excluir") },
			]);
			if (!action) continue;
			if (action === "toggle") {
				await toggleSkill(name, disabledSet);
			} else if (action === "view") {
				alert(skill.name, skill.body);
			} else if (action === "delete") {
				const sure = await confirm(
					t("ai skill delete", "Excluir"),
					t("ai skill delete confirm", "Excluir esta skill importada?"),
				);
				if (sure) {
					await deleteImportedSkill(skill.name);
					toast(t("ai skill deleted", "Skill excluída"), 2500);
				}
			}
			continue;
		}

		await toggleSkill(name, disabledSet);
	}

	async function toggleSkill(name, disabledSet) {
		if (disabledSet.has(name)) {
			disabledSet.delete(name);
		} else {
			disabledSet.add(name);
		}
		try {
			await settings.update({ aiDisabledSkills: [...disabledSet] });
			toast(
				disabledSet.has(name)
					? t("ai skill disabled", "Skill desativada")
					: t("ai skill enabled", "Skill ativada"),
				2000,
			);
		} catch (error) {
			helpers.error(error);
		}
	}
}
