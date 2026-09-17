// @vitest-environment happy-dom
import { javascript } from "@codemirror/lang-javascript";
import { EditorState } from "@codemirror/state";
import { beforeEach, describe, expect, it, vi } from "vitest";
import linterRegistry, {
		getLinterDiagnostics,
		setLspCoveredFile,
		syntaxErrorDiagnostics,
} from "lib/linterRegistry";

const state = vi.hoisted(() => ({
		settingsValue: {} as Record<string, unknown>,
}));

vi.mock("lib/settings", () => ({
		default: {
				get value() {
						return state.settingsValue;
				},
				set value(v) {
						state.settingsValue = v;
				},
				on() {},
				off() {},
		},
}));

function makeState(doc, extensions = []) {
		return EditorState.create({ doc, extensions });
}

function fakeScript() {
		return document.createElement("script");
}

describe("syntax error diagnostics (Lezer error nodes)", () => {
		it("reports error nodes in broken JS and nothing in valid JS", async () => {
				const broken = syntaxErrorDiagnostics({
						state: makeState("const x = ;\nconst y = 2;", [javascript()]),
				});
				const valid = syntaxErrorDiagnostics({
						state: makeState("const x = 1;\nconst y = 2;", [javascript()]),
				});
				const diags = await broken;
				expect(diags.length).toBeGreaterThan(0);
				for (const d of diags) {
					expect(d.severity).toBe("error");
					expect(d.source).toBe("xcoder-syntax");
					expect(d.message).toMatch(/^(Unexpected|Syntax error)/);
				}
				expect(await valid).toEqual([]);
		});

		it("returns empty for states without a doc", async () => {
				expect(await syntaxErrorDiagnostics({ state: null })).toEqual([]);
		});
});

describe("linter registry", () => {
		beforeEach(() => {
				linterRegistry.resetForTests();
				state.settingsValue = {};
				setLspCoveredFile(false);
		});

		it("respects the syntaxLint setting", async () => {
				state.settingsValue.syntaxLint = false;
				const source = linterRegistry.composedSource();
				const diags = await source({
						state: makeState("const x = ;", [javascript()]),
				});
				expect(diags.filter((d) => d.source === "xcoder-syntax")).toEqual([]);
				state.settingsValue.syntaxLint = true;
				const on = await source({
						state: makeState("const x = ;", [javascript()]),
				});
				expect(on.length).toBeGreaterThan(0);
		});

		it("registers, lists and unregisters linters", () => {
				const handle = linterRegistry.register({
						id: "test",
						lint: () => [],
				});
				expect(linterRegistry.has("test")).toBe(true);
				expect(linterRegistry.list()).toEqual(["test"]);
				handle.dispose();
				expect(linterRegistry.has("test")).toBe(false);
		});

		it("re-registering an id replaces the previous linter", () => {
				linterRegistry.register({ id: "a", lint: () => [] });
				linterRegistry.register({ id: "a", lint: () => [] });
				expect(linterRegistry.list()).toEqual(["a"]);
		});

		it("notifies onChange listeners", () => {
				let calls = 0;
				const off = linterRegistry.onChange(() => {
						calls += 1;
				});
				const handle = linterRegistry.register({ id: "x", lint: () => [] });
				handle.dispose();
				off();
				linterRegistry.register({ id: "x", lint: () => [] });
				expect(calls).toBe(2);
		});

		it("gates registered linters by file extension", async () => {
				linterRegistry.bindFilenameProvider(() => "main.js");
				linterRegistry.register({
						id: "py-only",
						extensions: ["py"],
						lint: () => [
								{ from: 0, to: 1, severity: "warning", message: "nope" },
						],
				});
				linterRegistry.register({
						id: "any",
						lint: () => [
								{ from: 0, to: 1, severity: "warning", message: "yes" },
						],
				});
				const state = makeState("const x = 1;", [javascript()]);
				const source = linterRegistry.composedSource();
				const diags = await source({ state });
				expect(diags.some((d) => d.message === "nope")).toBe(false);
				expect(diags.some((d) => d.message === "yes")).toBe(true);

				linterRegistry.bindFilenameProvider(() => "main.py");
				const pyDiags = await source({ state });
				expect(pyDiags.some((d) => d.message === "nope")).toBe(true);
		});

		it("skips the built-in syntax checker on LSP-covered files", async () => {
				const state = makeState("const x = ;", [javascript()]);
				const source = linterRegistry.composedSource({ skipLspCovered: true });

				const uncovered = await source({ state });
				expect(uncovered.some((d) => d.source === "xcoder-syntax")).toBe(true);

				setLspCoveredFile(true);
				const covered = await source({ state });
				expect(covered.filter((d) => d.source === "xcoder-syntax")).toEqual([]);

				setLspCoveredFile(false);
		});

		it("keeps plugin-registered linters on LSP-covered files", async () => {
				setLspCoveredFile(true);
				linterRegistry.register({
						id: "always",
						lint: () => [
								{ from: 0, to: 1, severity: "info", message: "runs anyway" },
						],
				});
				const source = linterRegistry.composedSource({ skipLspCovered: true });
				const state = makeState("const x = ;", [javascript()]);
				const diags = await source({ state });
				expect(diags.map((d) => d.message)).toEqual(["runs anyway"]);
		});

		it("binds plugin scopes with ownership and unload", () => {
				const script = fakeScript();
				const api = linterRegistry.bindPlugin(script, "my-plugin");
				api.register({ id: "p1", lint: () => [] });
				expect(linterRegistry.has("p1")).toBe(true);

				// plugin API is reachable through the script
				expect(linterRegistry.getPluginApi(script)).toBe(api);
				expect(() => linterRegistry.getPluginApi(fakeScript())).toThrow();

				// uninstall: entries owned by the plugin go away and the API deactivates
				linterRegistry.unregisterByPlugin("my-plugin");
				expect(linterRegistry.has("p1")).toBe(false);
				expect(() => api.register({ id: "p2", lint: () => [] })).toThrow();
		});

		it("rejects binding the same plugin twice", () => {
				linterRegistry.bindPlugin(fakeScript(), "dup");
				expect(() => linterRegistry.bindPlugin(fakeScript(), "dup")).toThrow();
		});

		it("validates register inputs", () => {
				expect(() => linterRegistry.register({ id: "", lint: () => [] })).toThrow();
				expect(() =>
						linterRegistry.register({ id: "nolf", lint: "nope" }),
				).toThrow();
		});

		it("uiExtension provides field + linter + event bridge", () => {
				const ext = linterRegistry.uiExtension({ skipLspCovered: true });
				expect(ext).toHaveLength(3);
		});

		it("getLinterDiagnostics tolerates plain states", () => {
				expect(getLinterDiagnostics(makeState("x"))).toEqual([]);
				expect(getLinterDiagnostics(null)).toEqual([]);
		});
});
