import { linter } from "@codemirror/lint";
import type { Diagnostic } from "@codemirror/lint";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import { StateEffect, StateField } from "@codemirror/state";
import type { EditorView, ViewUpdate } from "@codemirror/view";
import { ViewPlugin } from "@codemirror/view";
import appSettings from "lib/settings";

/**
 * Syntax linter registry (roadmap v1.7.x "more plugins ported" — linter).
 *
 * Zero-dependency syntax-error checking built on the CodeMirror 6 parse
 * trees every language mode already produces (Lezer `isError` nodes), plus
 * a registration API so plugins can add richer linters — the same scoped
 * ownership model the fileIcons API uses (bindPlugin/getPluginApi with
 * per-plugin unregister on load failure or uninstall).
 *
 * Languages covered by a bundled LSP server (JS/TS, HTML, CSS, JSON,
 * Python, Lua, Tailwind) publish their own, richer diagnostics; for those
 * files the built-in Lezer checker steps aside via `skipLspCovered`
 * (editorManager flips the flag per file) so the same error is never
 * reported twice. Registered plugin linters always run.
 */

export const LINTER_DIAGNOSTICS_EVENT = "xcoder:linter-diagnostics-updated";

const MAX_SYNTAX_DIAGNOSTICS = 200;
const MAX_TOTAL_DIAGNOSTICS = 300;
const LINT_DELAY_MS = 500;

const setLinterDiagnostics = StateEffect.define<readonly Diagnostic[]>();

/**
 * Mirror of the latest computed diagnostics. @codemirror/lint keeps its
 * results private to the lint machinery, so the composed source re-publishes
 * each result into this field — the problems panel reads it with
 * `getLinterDiagnostics(state)` the same way it reads LSP diagnostics.
 */
export const linterDiagnosticsField = StateField.define<
	readonly Diagnostic[]
>({
	create: () => [],
	update(value, tr) {
		for (const effect of tr.effects) {
			if (effect.is(setLinterDiagnostics)) return effect.value;
		}
		return value;
	},
});

/**
 * Latest syntax-linter diagnostics for `state` (empty when none or when
 * the state has no mirror field, e.g. plain states in tests).
 */
export function getLinterDiagnostics(
	state: EditorState | null | undefined,
): readonly Diagnostic[] {
	if (!state || typeof state.field !== "function") return [];
	try {
		return state.field(linterDiagnosticsField, false) ?? [];
	} catch {
		return [];
	}
}

// Whether the file currently being edited is covered by an LSP server that
// publishes diagnostics. Module-level by design: the composed source must
// read it at lint time, long after editorManager configured the file.
let lspCovered = false;

export function setLspCoveredFile(active: boolean): void {
	lspCovered = Boolean(active);
}

/** @returns true when the built-in syntax checker is enabled in settings. */
function syntaxLintEnabled(): boolean {
	return appSettings?.value?.syntaxLint !== false;
}

function clampPos(pos: number, length: number): number {
	if (typeof pos !== "number" || Number.isNaN(pos)) return 0;
	return Math.max(0, Math.min(pos, Math.max(0, length)));
}

/**
 * Built-in syntax-error checker: walks the current Lezer tree and reports
 * every `isError` node. Works for any language with a CodeMirror 6 parser
 * (php, c/cpp, java, yaml, xml, …) — no external linter engines bundled.
 */
export async function syntaxErrorDiagnostics(
	view: Pick<EditorView, "state">,
	max = MAX_SYNTAX_DIAGNOSTICS,
): Promise<Diagnostic[]> {
	const state = view?.state;
	if (!state || !state.doc) return [];

	let tree = null;
	try {
		tree =
			(await ensureSyntaxTree(state, state.doc.length, 100)) ||
			syntaxTree(state);
	} catch {
		try {
			tree = syntaxTree(state);
		} catch {
			return [];
		}
	}
	if (!tree) return [];

	const doc = state.doc;
	const diagnostics: Diagnostic[] = [];
	const cursor = tree.cursor();
	let lastFrom = -1;
	let lastTo = -1;

	do {
		if (!cursor.type.isError) continue;
		const from = clampPos(cursor.from, doc.length);
		const to = clampPos(cursor.to, doc.length);
		// nested error nodes commonly repeat the same span — report once
		if (from === lastFrom && to === lastTo) continue;
		// zero-width error nodes are real too: the parser inserts them for
		// MISSING tokens (e.g. the expression in `const x = ;`)
		const snippet =
			from === to
				? ""
				: doc.sliceString(from, Math.min(to, from + 60)).trim();
		diagnostics.push({
			from,
			to,
			severity: "error",
			message: snippet ? `Unexpected ${snippet}` : "Syntax error",
			source: "xcoder-syntax",
		});
		lastFrom = from;
		lastTo = to;
	} while (cursor.next() && diagnostics.length < max);

	return diagnostics;
}

export type LinterFn = (
	view: Pick<EditorView, "state">,
) => Diagnostic[] | Promise<Diagnostic[]>;

interface LinterEntry {
	id: string;
	lint: LinterFn;
	extensions: string[] | null;
	ownerPluginId: string | null;
}

export interface RegisterLinterOptions {
	/** Unique id — re-registering an id replaces the previous linter. */
	id: string;
	/** Receive the editor view, return (a promise of) CM6 diagnostics. */
	lint: LinterFn;
	/** File extensions this linter applies to; omit/null = all files. */
	extensions?: string[] | null;
}

/**
 * Registry of syntax linters + the composed CodeMirror extension.
 *
 * The built-in Lezer checker and every registered linter are merged into
 * one `linter()` source; results are mirrored into `linterDiagnosticsField`
 * (and `LINTER_DIAGNOSTICS_EVENT` is fired) so the problems panel can list
 * them next to the LSP ones.
 */
class LinterRegistry {
	#entries = new Map<string, LinterEntry>();
	#listeners = new Set<() => void>();
	#pluginScopes = new Map<
		string,
		{ active: boolean; subscriptions: Set<() => void> }
	>();
	#scriptApis = new WeakMap<
		HTMLScriptElement,
		ReturnType<LinterRegistry["bindPlugin"]>
	>();
	#filenameProvider: (() => string | null) | null = null;

	/**
	 * Called by editorManager once so extension-gated linters can resolve
	 * against the file being edited (avoids an editorManager import cycle).
	 */
	bindFilenameProvider(provider: () => string | null): void {
		this.#filenameProvider = provider;
	}

	#currentExtension(): string | null {
		try {
			const filename = this.#filenameProvider?.() || "";
			const dot = filename.lastIndexOf(".");
			if (dot < 0) return null;
			return filename.slice(dot + 1).toLowerCase();
		} catch {
			return null;
		}
	}

	#notify(): void {
		for (const listener of [...this.#listeners]) {
			try {
				listener();
			} catch (error) {
				console.warn("[linterRegistry] onChange listener failed:", error);
			}
		}
	}

	register(entry: RegisterLinterOptions & { pluginId?: string }): {
		dispose: () => void;
	} {
		const id = String(entry?.id || "");
		if (!id) throw new Error('linter.register: "id" is required');
		if (typeof entry?.lint !== "function") {
			throw new Error(`linter.register(${id}): "lint" must be a function`);
		}
		const extensions = Array.isArray(entry?.extensions)
			? entry.extensions.map((ext) => String(ext).toLowerCase())
			: null;
		this.#entries.set(id, {
			id,
			lint: entry.lint,
			extensions,
			ownerPluginId: entry.pluginId ?? null,
		});
		this.#notify();
		return {
			dispose: () => {
				this.unregister(id);
			},
		};
	}

	unregister(id: string): boolean {
		const removed = this.#entries.delete(id);
		if (removed) this.#notify();
		return removed;
	}

	unregisterByPlugin(pluginId: string): void {
		if (!pluginId) return;
		const scope = this.#pluginScopes.get(pluginId);
		if (scope) {
			scope.active = false;
			for (const unsubscribe of scope.subscriptions) unsubscribe();
		}
		this.#pluginScopes.delete(pluginId);
		for (const [id, entry] of [...this.#entries]) {
			if (entry.ownerPluginId === pluginId) this.unregister(id);
		}
	}

	has(id: string): boolean {
		return this.#entries.has(id);
	}

	list(): string[] {
		return [...this.#entries.keys()];
	}

	onChange(listener: () => void): () => void {
		if (typeof listener !== "function") return () => {};
		this.#listeners.add(listener);
		return () => {
			this.#listeners.delete(listener);
		};
	}

	/**
	 * The single lint source: built-in Lezer checker + every registered
	 * linter, merged and capped. Mirrors the result into the state field
	 * and fires `LINTER_DIAGNOSTICS_EVENT` for live consumers.
	 */
	composedSource(
		config: { skipLspCovered?: boolean } = {},
	): (view: EditorView) => Promise<Diagnostic[]> {
		return async (view) => {
			const all: Diagnostic[] = [];
			const skipSyntax =
				Boolean(config.skipLspCovered) && lspCovered;

			if (!skipSyntax && syntaxLintEnabled()) {
				try {
					all.push(...(await syntaxErrorDiagnostics(view)));
				} catch (error) {
					console.warn("[linterRegistry] syntax check failed:", error);
				}
			}

			const ext = this.#currentExtension();
			for (const entry of this.#entries.values()) {
				if (
					entry.extensions &&
					ext !== null &&
					!entry.extensions.includes(ext) &&
					!entry.extensions.includes("*")
				) {
					continue;
				}
				try {
					const result = await entry.lint(view);
					if (Array.isArray(result)) all.push(...result);
				} catch (error) {
					console.warn(`[linterRegistry] linter ${entry.id} failed:`, error);
				}
			}

			const diagnostics = all.slice(0, MAX_TOTAL_DIAGNOSTICS);
			try {
				view.dispatch?.({ effects: setLinterDiagnostics.of(diagnostics) });
				if (typeof window !== "undefined" && window.dispatchEvent) {
					window.dispatchEvent(new CustomEvent(LINTER_DIAGNOSTICS_EVENT));
				}
			} catch {
				// fake views in tests may not dispatch
			}
			return diagnostics;
		};
	}

	/**
	 * CodeMirror extension set: the linter (squiggles + gutter) plus the
	 * diagnostics mirror field. `skipLspCovered` suppresses the built-in
	 * checker on files whose diagnostics come from an LSP server.
	 */
	uiExtension(config: { skipLspCovered?: boolean } = {}): Extension[] {
		return [
			linterDiagnosticsField,
			linter(this.composedSource(config), {
				delay: LINT_DELAY_MS,
				autoPanel: false,
			}),
			eventBridge,
		];
	}

	/** Called by the loader before executing a plugin script. */
	bindPlugin(script: HTMLScriptElement, pluginId: string) {
		const previous = this.#pluginScopes.get(pluginId);
		if (previous) throw new Error(`Plugin '${pluginId}' is already bound`);
		const scope = { active: true, subscriptions: new Set<() => void>() };
		this.#pluginScopes.set(pluginId, scope);
		const assertActive = () => {
			if (!scope.active) {
				throw new Error(`Linter API for plugin '${pluginId}' has been unloaded`);
			}
		};
		const api = Object.freeze({
			register: (entry: RegisterLinterOptions) => {
				assertActive();
				return this.register({ ...entry, pluginId });
			},
			unregister: (id: string) => {
				assertActive();
				return this.unregister(id);
			},
			onChange: (listener: () => void) => {
				assertActive();
				if (typeof listener !== "function") return () => {};
				const off = this.onChange(listener);
				const unsubscribe = () => {
					off();
					scope.subscriptions.delete(unsubscribe);
				};
				scope.subscriptions.add(unsubscribe);
				return unsubscribe;
			},
		});
		this.#scriptApis.set(script, api);
		return api;
	}

	getPluginApi(script: HTMLScriptElement | null) {
		const api = script && this.#scriptApis.get(script);
		if (!api) {
			throw new Error(
				'Require "linter" in the plugin main script to register linters',
			);
		}
		return api;
	}

	resetForTests(): void {
		for (const id of this.#pluginScopes.keys()) this.unregisterByPlugin(id);
		this.#scriptApis = new WeakMap();
		this.#entries.clear();
		this.#listeners.clear();
		this.#filenameProvider = null;
		lspCovered = false;
	}
}

// Fires LINTER_DIAGNOSTICS_EVENT whenever a mirror lands on the state.
const eventBridge = ViewPlugin.fromClass(
	class {
		update(update: ViewUpdate) {
			for (const tr of update.transactions) {
				for (const effect of tr.effects) {
					if (effect.is(setLinterDiagnostics)) {
						if (typeof window !== "undefined" && window.dispatchEvent) {
							window.dispatchEvent(new CustomEvent(LINTER_DIAGNOSTICS_EVENT));
						}
						return;
					}
				}
			}
		}
	},
);

export const linterRegistry = new LinterRegistry();
export default linterRegistry;
