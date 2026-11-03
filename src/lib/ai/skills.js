/**
 * AI skills — small markdown playbooks the agent can load on demand.
 *
 * A skill is a markdown file with an optional frontmatter header:
 *
 *   ---
 *   name: android-build
 *   description: Debug Gradle/Android build failures step by step
 *   ---
 *   (instructions for the model…)
 *
 * Bundled skills ship with the app (BUILTIN_SKILLS). Users can drop their
 * own into `<workspace>/.xcoder/skills/*.md` — they are picked up by the
 * agent at run time. Disabled skills live in settings (`aiDisabledSkills`).
 */

/** Frontmatter pattern: ---\nkey: value\n--- */
const FRONTMATTER_RE = /^\uFEFF?---\s*\n([\s\S]*?)\n---\s*\n?/;

/**
 * Parses a skill markdown document into { name, description, body }.
 * Pure so it can be unit-tested.
 * @param {string} text raw markdown (with optional frontmatter)
 * @param {string} [fallbackName] name used when frontmatter has none
 * @returns {{name: string, description: string, body: string} | null}
 */
export function parseSkillMarkdown(text, fallbackName = "skill") {
	const value = String(text || "");
	if (!value.trim()) return null;
	const match = FRONTMATTER_RE.exec(value);
	let name = fallbackName;
	let description = "";
	let body = value;

	if (match) {
		body = value.slice(match[0].length);
		for (const line of match[1].split("\n")) {
			const idx = line.indexOf(":");
			if (idx < 1) continue;
			const key = line.slice(0, idx).trim().toLowerCase();
			const val = line.slice(idx + 1).trim();
			if (key === "name" && val) name = val;
			if ((key === "description" || key === "desc") && val) description = val;
		}
	}

	return {
		name: slugify(name) || fallbackName,
		description: description || body.slice(0, 120).replace(/\s+/g, " ").trim(),
		body: body.trim(),
	};
}

/** Lowercase, hyphenated identifier for a skill name. */
export function slugify(value) {
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * The bundled skills, available offline. Content is terse and actionable —
 * the agent reads it like a checklist.
 * @type {Array<{name: string, description: string, body: string}>}
 */
export const BUILTIN_SKILLS = [
	{
		name: "debug-build",
		description: "Systematic debugging of compile/build failures",
		body: `# Debug a build failure
1. Reproduce: run the exact failing command via run_command and capture the FIRST error (not the last).
2. Read the file/line the first error points at (read_file) before changing anything.
3. Classify: missing dependency → install it (pip/npm/gradle) and retry; syntax/type → fix in place with edit_file; config → check manifests/tsconfig/build files.
4. Change ONE thing at a time, then re-run the build to confirm.
5. Finish with a one-paragraph summary: cause, fix, verification.`,
	},
	{
		name: "code-review",
		description: "Review changed files like a senior engineer",
		body: `# Review the current changes
1. Get the change surface: list_dir + read the files the user touched (or the open file).
2. Check, in order: correctness (logic/edge cases), security (input validation, secrets), resources (leaks, N+1), readability.
3. For every finding: file, line, severity (blocker/major/minor), and a concrete suggested diff.
4. End with a verdict: ready / needs changes, plus the top 3 priorities.`,
	},
	{
		name: "write-tests",
		description: "Plan and write focused unit tests",
		body: `# Write unit tests
1. Identify the unit's inputs/outputs and failure modes before writing tests.
2. Prefer the project's existing test framework (look for vitest/jest configs).
3. Cover: happy path, boundaries, error handling — one assert concept per test.
4. Name tests as "should <behavior> when <condition>".
5. Run the suite with run_command and report results honestly (do not mark skipped as passing).`,
	},
	{
		name: "git-hygiene",
		description: "Clean commits and useful messages",
		body: `# Git hygiene
1. vcs status → group related changes; leave unrelated edits uncommitted (say so).
2. Message: <type>(<scope>): <imperative summary> — feat/fix/refactor/docs/chore/test.
3. Body (when useful): what changed and WHY, not how.
4. Never commit secrets, build outputs or node_modules; suggest .gitignore additions instead.`,
	},
	{
		name: "refactor-safe",
		description: "Behavior-preserving refactoring workflow",
		body: `# Refactor without breaking behavior
1. Pin the current behavior: tests first (write-tests skill) or manual run_command checks.
2. Small steps: rename → extract → restructure. Re-run checks after each step.
3. Prefer pure functions and clear data flow; avoid clever one-liners.
4. Stop and summarize when the code reads well — do not gold-plate.`,
	},
];

/**
 * Lists every available skill (bundled + workspace `.xcoder/skills`).
 * Workspace reads are best-effort and never throw.
 * @param {{workspaceUrl?: string, readFile?: (url: string)=>Promise<string>, listDir?: (url: string)=>Promise<string[]>}} [io]
 *        injectable fs bindings (unit tests); defaults to real fs
 * @returns {Promise<Array<{name: string, description: string, body: string, source: "builtin"|"workspace"}>>}
 */
export async function listSkills(io = {}) {
	const results = BUILTIN_SKILLS.map((skill) => ({
		...skill,
		source: "builtin",
	}));

	const listDir = io.listDir;
	const readFile = io.readFile;
	if (!listDir || !readFile || !io.workspaceUrl) return results;

	try {
		const dir = io.workspaceUrl.endsWith("/")
			? `${io.workspaceUrl}.xcoder/skills`
			: `${io.workspaceUrl}/.xcoder/skills`;
		const entries = (await listDir(dir)) || [];
		for (const entry of entries) {
			if (!String(entry).toLowerCase().endsWith(".md")) continue;
			try {
				const raw = await readFile(
					dir.endsWith("/") ? `${dir}${entry}` : `${dir}/${entry}`,
				);
				const parsed = parseSkillMarkdown(
					raw,
					String(entry).replace(/\.md$/i, ""),
				);
				if (parsed?.body) {
					results.push({ ...parsed, source: "workspace" });
				}
			} catch {
				/* unreadable file — skip */
			}
		}
	} catch {
		/* no workspace skills — fine */
	}
	return results;
}

/**
 * Skills the agent may use, given the disabled-name list (pure — callers
 * read settings so this module stays unit-testable without app deps).
 * @param {Array<{name: string, source: string}>} skills
 * @param {string[]} [disabledNames]
 * @returns {Array<{name: string, description: string, body: string, source: string}>}
 */
export function enabledSkills(skills, disabledNames = []) {
	const disabled = (disabledNames || []).map((name) =>
		String(name).toLowerCase(),
	);
	return skills.filter((skill) => !disabled.includes(skill.name.toLowerCase()));
}

/**
 * The system-prompt section describing available skills (name + purpose).
 * @param {Array<{name: string, description: string}>} skills
 * @param {string[]} [disabledNames]
 * @returns {string} "" when no skills are enabled
 */
export function buildSkillsSection(skills, disabledNames) {
	const usable = enabledSkills(skills, disabledNames);
	if (!usable.length) return "";
	const lines = usable
		.map((skill) => `- ${skill.name}: ${skill.description}`)
		.join("\n");
	return [
		"- SKILLS: reusable playbooks are available via load_skill. Load one when its description matches the task; follow it, then return to the task.",
		lines,
	].join("\n");
}

/**
 * Finds a skill by name (case-insensitive).
 * @param {Array<{name: string}>} skills
 * @param {string} name
 */
export function findSkill(skills, name) {
	const wanted = slugify(name);
	return skills.find((skill) => skill.name === wanted) || null;
}

export default {
	BUILTIN_SKILLS,
	parseSkillMarkdown,
	listSkills,
	enabledSkills,
	buildSkillsSection,
	findSkill,
	slugify,
};
