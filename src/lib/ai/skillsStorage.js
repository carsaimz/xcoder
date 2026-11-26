import fsOperation from "fileSystem";
import { githubToRaw } from "lib/ai/skills";
import Url from "utils/Url";

/**
 * Imported-skill storage for the AI agent.
 *
 * Skills imported by the user (from a local file, an URL/GitHub or pasted
 * text) live in `<DATA_STORAGE>/skills/*.md` — an app-level folder that is
 * independent of the current workspace, so imported skills follow the user
 * across projects. They are exposed to the agent together with the bundled
 * skills and the workspace `.xcoder/skills` folder by `getSkillsIo()`.
 */

const SOURCE_IMPORTED = "imported";

/** Directory that holds imported skills ("" when storage is not ready). */
export function importedSkillsDir() {
	const base = String(window.DATA_STORAGE || "");
	if (!base) return "";
	return base.endsWith("/") ? `${base}skills` : `${base}/skills`;
}

function skillFileUrl(fileName) {
	return Url.join(importedSkillsDir(), fileName);
}

/**
 * fs io bindings for `listSkills()` — picks up imported skills in addition
 * to workspace skills. Returns null when DATA_STORAGE is not available yet.
 */
export function getSkillsIo() {
	const dir = importedSkillsDir();
	if (!dir) return null;
	return {
		dirs: [{ url: dir, source: SOURCE_IMPORTED }],
		listDir: (url) => fsOperation(url).lsDir(),
		readFile: (url) => fsOperation(url).readFile("utf8"),
	};
}

/**
 * Saves (or overwrites) an imported skill file.
 * @param {string} fileName file name WITH .md extension
 * @param {string} content markdown content
 * @returns {Promise<string>} url of the written file
 */
export async function saveImportedSkill(fileName, content) {
	const dir = importedSkillsDir();
	if (!dir) throw new Error("storage not ready");
	try {
		await fsOperation(window.DATA_STORAGE).createDirectory("skills");
	} catch {
		/* directory already exists */
	}

	const name = String(fileName || "").replace(/\.md$/i, "") || "skill";
	const target = skillFileUrl(`${name}.md`);
	let exists = false;
	try {
		exists = Boolean(await fsOperation(target).exists());
	} catch {
		exists = false;
	}
	if (exists) {
		await fsOperation(target).writeFile(content);
	} else {
		await fsOperation(dir).createFile(`${name}.md`, content);
	}
	return target;
}

/**
 * Deletes an imported skill file by its skill name.
 * @param {string} name slug name (without .md)
 */
export async function deleteImportedSkill(name) {
	const target = skillFileUrl(`${String(name || "").replace(/\.md$/i, "")}.md`);
	await fsOperation(target).delete();
}

export default {
	importedSkillsDir,
	getSkillsIo,
	saveImportedSkill,
	deleteImportedSkill,
	githubToRaw,
};
