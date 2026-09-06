/**
 * Roadmap v1.5.x item 2 — tab history navigation.
 *
 * The back/forward history stack lives in editorManager.js (already
 * tested elsewhere); this file covers the NEW user-facing wiring:
 *  - default keyboard shortcuts Alt-Left / Alt-Right (previously `null`),
 *  - the back-fill migration that gives EXISTING installs (whose
 *    keybindings.json still stores key: null) the new defaults,
 *  - the header back/forward buttons and their disabled state.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import keyBindings from "lib/keyBindings";

const mainSource = readFileSync(join(process.cwd(), "src/main.js"), "utf8");
const registrySource = readFileSync(
        join(process.cwd(), "src/cm/commandRegistry.js"),
        "utf8",
);

describe("tab history navigation", () => {
        it("ships Alt-Left / Alt-Right defaults for history navigation", () => {
                expect(keyBindings.prevFileHistory).toMatchObject({
                        key: "Alt-Left",
                        action: "prev-file-history",
                        readOnly: true,
                });
                expect(keyBindings.nextFileHistory).toMatchObject({
                        key: "Alt-Right",
                        action: "next-file-history",
                        readOnly: true,
                });
        });

        it("does not collide with already-claimed shortcuts", () => {
                const claimed = new Map();
                for (const binding of Object.values(keyBindings)) {
                        if (!binding?.key) continue;
                        expect(
                                claimed.has(binding.key),
                                `${binding.key} is claimed twice (${claimed.get(binding.key)} and ${binding.name})`,
                        ).toBe(false);
                        claimed.set(binding.key, binding.name);
                }
        });

        it("back-fills stored null keys so existing installs get new defaults", () => {
                // loadCustomKeyBindings(): stored `key: null` + a new default
                // key in the config → the default must be adopted.
                expect(registrySource).toMatch(/stored\.key == null/);
                expect(registrySource).toMatch(/keyBindings\[key\]\?\.key != null/);
        });

        it("header exposes back/forward buttons wired to the history commands", () => {
                expect(mainSource).toMatch(/header-tab-back-btn/);
                expect(mainSource).toMatch(/header-tab-fwd-btn/);
                expect(mainSource).toMatch(/xcoder\.exec\("prev-file-history"\)/);
                expect(mainSource).toMatch(/xcoder\.exec\("next-file-history"\)/);
        });

        it("header buttons reflect the history cursor state", () => {
                expect(mainSource).toMatch(/editorManager\.editorHistoryIndex/);
                expect(mainSource).toMatch(/editorManager\.editorHistory/);
                expect(mainSource).toMatch(
                        /\$tabBackBtn\.classList\.toggle\(\s*"disabled"/,
                );
                expect(mainSource).toMatch(
                        /\$tabFwdBtn\.classList\.toggle\(\s*"disabled"/,
                );
        });

        it("button titles are translated", () => {
                expect(mainSource).toMatch(/strings\["previous tab"\]/);
                expect(mainSource).toMatch(/strings\["next tab"\]/);
        });
});
