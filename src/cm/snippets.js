import fsOperation from "fileSystem";
import { snippetCompletion } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { matchLanguage, parseSnippetFile } from "cm/snippetParser";
import settings from "lib/settings";
import Url from "utils/Url";

/**
 * User snippets in the VS CODE FORMAT (roadmap 🧩 item 3).
 *
 * Files live in <DATA_STORAGE>/snippets/:
 *
 *   <language>.json        e.g. javascript.json — applies to that language
 *   <name>.code-snippets   global file, optional "scope": "javascript,html"
 *
 * Both use the VS Code schema — { "Name": { prefix, body, description } } —
 * with tabstops $1/$2/$0, placeholders ${1:default} and choices
 * ${1|a,b|}, all of which CodeMirror's snippet engine understands
 * natively (snippetCompletion). Files are re-read from disk at most
 * once per TTL seconds and always after Configure/Import.
 */

const SNIPPETS_DIR = () => Url.join(window.DATA_STORAGE, "snippets");

async function ensureDir() {
	try {
		if (!(await fsOperation(SNIPPETS_DIR()).exists())) {
			await fsOperation(window.DATA_STORAGE).createDirectory("snippets");
		}
	} catch {
		// storage unavailable — write attempts will surface the error
	}
}
const TTL = 10_000;

export async function snippetsFor(mode) {
	const dir = SNIPPETS_DIR();
	const entries = await fsOperation(dir)
		.lsDir()
		.catch(() => []);
	const usable = [];
	for (const entry of entries) {
		const base = Url.basename(entry.url);
		if (!/\.(json|code-snippets)$/i.test(base)) continue;
		const baseName = base.replace(/\.(json|code-snippets)$/i, "");
		const isScopedFile = /\.code-snippets$/i.test(base);
		if (!isScopedFile && !matchLanguage(mode, baseName)) continue;
		const text = await fsOperation(entry.url)
			.readFile("utf8")
			.catch(() => "");
		for (const snippet of parseSnippetFile(text, base)) {
			if (
				snippet.languages &&
				!snippet.languages.some((lang) => matchLanguage(mode, lang))
			) {
				continue;
			}
			usable.push(snippet);
		}
	}
	return usable;
}

/**
 * Cached variant used by the completion source (re-reads at most once
 * per TTL so editing snippet files is picked up quickly without I/O on
 * every keystroke).
 */
async function snippetsForCached(mode) {
	const now = Date.now();
	if (cache && now - cacheTime < TTL && cache.mode === mode) {
		return cache.snippets;
	}
	const snippets = await snippetsFor(mode);
	cache = { mode, snippets };
	cacheTime = now;
	return snippets;
}

/**
 * The editor completion source. VS Code-style matching: a snippet is
 * offered when the word before the cursor is a prefix of one of its
 * prefixes (case-insensitive).
 */
export const snippetsCompletionSource = async function (context) {
	if (settings.value.snippetCompletion === false) return null;
	const word = context.matchBefore(/[\w$-]+/);
	if (!word || word.from === word.to) return null;
	const mode = window.editorManager?.activeFile?.currentMode || "";
	if (!mode) return null;
	const snippets = await snippetsForCached(mode);
	const typed = word.text.toLowerCase();
	const options = [];
	for (const snippet of snippets) {
		for (const prefix of snippet.prefixes) {
			if (!prefix.toLowerCase().startsWith(typed)) continue;
			options.push(
				snippetCompletion(snippet.body, {
					label: prefix,
					detail: snippet.description || snippet.name,
					type: "snippet",
					boost: 90,
				}),
			);
			break;
		}
	}
	if (!options.length) return null;
	return { from: word.from, options, validFor: /^[\w$-]*$/ };
};

/**
 * Editor extension attaching the snippet completion source to every
 * language. A completion source is a plain function — it must reach
 * CodeMirror through the autocomplete language-data facet; a raw function
 * in the extension list throws «Unrecognized extension value in extension
 * set» the moment an editor opens.
 * @returns {import("@codemirror/state").Extension}
 */
export function snippetsCompletions() {
	return EditorState.languageData.of(() => [
		{ autocomplete: snippetsCompletionSource },
	]);
}

/**
 * Inserts a snippet (by its name) at the cursor of the active file.
 * @param {string} name
 */
export async function insertSnippetByName(name) {
	const editorManager = window.editorManager;
	const view = editorManager?.editor;
	const mode = editorManager?.activeFile?.currentMode || "";
	if (!view?.state) return false;
	const snippet = (await snippetsFor(mode)).find((sn) => sn.name === name);
	if (!snippet) return false;
	const prefix = snippet.prefixes[0];
	const completion = snippetCompletion(snippet.body, {
		label: prefix,
		detail: snippet.description || snippet.name,
		type: "snippet",
	});
	const head = view.state.selection.main.head;
	completion.apply(view, completion, head, head);
	return true;
}

/** Command-palette entry: pick a snippet for the current language and insert it. */
export async function openInsertSnippetPalette() {
	const { default: select } = await import("dialogs/select");
	const { default: toast } = await import("components/toast");
	const editorManager = window.editorManager;
	const mode = editorManager?.activeFile?.currentMode || "";
	if (!mode) {
		toast(strings["no file open"]);
		return;
	}
	const snippets = await snippetsFor(mode);
	if (!snippets.length) {
		toast(strings["no snippets"]);
		return;
	}
	const items = snippets.map((sn) => [
		sn.name,
		`${sn.prefixes[0]} — ${sn.description || sn.name}`,
	]);
	const name = await select(strings["insert snippet"], items);
	if (!name) return;
	const inserted = await insertSnippetByName(name);
	if (inserted) toast(strings["snippet inserted"]);
}

/**
 * Opens (creating with a starter template when missing) the snippet
 * file of the current language — the «Configure User Snippets» flow.
 */
export async function configureSnippets() {
	const { default: toast } = await import("components/toast");
	const { default: openFile } = await import("lib/openFile");
	const editorManager = window.editorManager;
	const mode = editorManager?.activeFile?.currentMode || "global";
	await ensureDir();
	const fileUrl = Url.join(SNIPPETS_DIR(), `${mode}.json`);
	const fileFs = fsOperation(fileUrl);
	if (!(await fileFs.exists().catch(() => false))) {
		await fileFs.writeFile(
			JSON.stringify(
				{
					Example: {
						prefix: "example",
						body: ["${1:code}", "$0"],
						description: "Starter snippet — edit or delete me",
					},
				},
				null,
				2,
			),
		);
		toast(strings["snippets file created"]);
	}
	invalidateCache();
	openFile(fileUrl, { mode: "single" });
}

/**
 * Imports a VS Code snippets file (.json or .code-snippets) picked via
 * the file browser into the snippets folder.
 */
export async function importSnippetsFile() {
	const { default: toast } = await import("components/toast");
	const { loadFileBrowser } = await import("lib/lazyImports");
	const FileBrowser = await loadFileBrowser();
	const picked = await FileBrowser("file", strings["import snippets"]).catch(
		() => null,
	);
	const url = typeof picked === "string" ? picked : picked?.url;
	if (!url) return;
	if (!/\.(json|code-snippets)$/i.test(Url.basename(url))) {
		toast(strings["not a snippets file"]);
		return;
	}
	const text = await fsOperation(url)
		.readFile("utf8")
		.catch(() => "");
	const parsed = parseSnippetFile(text, Url.basename(url));
	if (!parsed.length) {
		toast(strings["not a snippets file"]);
		return;
	}
	await ensureDir();
	const dest = Url.join(SNIPPETS_DIR(), Url.basename(url));
	if (
		await fsOperation(dest)
			.exists()
			.catch(() => false)
	) {
		const { default: confirm } = await import("dialogs/confirm");
		const overwrite = await confirm(
			strings.warning,
			strings["replace file warning"],
		);
		if (!overwrite) return;
	}
	await fsOperation(dest).writeFile(text);
	invalidateCache();
	toast(strings["snippets imported"]);
}
