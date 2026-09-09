import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createReplRuntime } from "lib/replWorker";

/**
 * v1.6.0 roadmap features:
 *  1. SSH sessions settings page
 *  2. sandboxed JS console REPL (Web Worker)
 *  3. font manager settings page
 *  4. terminal onboarding (first run)
 */

const read = (p) => readFileSync(join(process.cwd(), p), "utf8");

describe("replWorker: sandboxed evaluation", () => {
        const collect = () => {
                const messages = [];
                const evaluate = createReplRuntime((message) => messages.push(message));
                return { messages, evaluate };
        };

        it("captures console output", async () => {
                const { messages, evaluate } = collect();
                await evaluate(1, "console.log('olá', 42)");
                const kinds = messages.map((m) => m.kind);
                expect(kinds).toEqual(["log", "done"]);
                expect(messages[0].text).toBe("olá 42");
        });

        it("returns the last expression's value (REPL-style)", async () => {
                const { messages, evaluate } = collect();
                await evaluate(1, "6 * 7");
                expect(messages.map((m) => m.kind)).toEqual(["result"]);
                expect(messages[0].text).toBe("42");
        });

        it("supports await inside an explicit async expression", async () => {
                const { messages, evaluate } = collect();
                await evaluate(
                        2,
                        "(async () => { const x = await Promise.resolve('pronto'); return x; })()",
                );
                expect(messages.map((m) => m.kind)).toEqual(["result"]);
                expect(messages[0].text).toBe("pronto");
        });

        it("reports thrown errors without killing the worker", async () => {
                const { messages, evaluate } = collect();
                await evaluate(3, "throw new Error('boom')");
                expect(messages).toHaveLength(1);
                expect(messages[0].kind).toBe("error");
                expect(messages[0].text).toContain("boom");
                // the runtime still works afterwards
                await evaluate(4, "'depois'");
                expect(messages[1].text).toBe("depois");
        });

        it("serializes objects, arrays and functions", async () => {
                const { messages, evaluate } = collect();
                await evaluate(5, "({a: 1, b: 'x', c: [1, 2]})");
                expect(messages[0].text).toBe('{a: 1, b: "x", c: [1, 2]}');
                await evaluate(6, "(() => 1)");
                expect(messages[1].text).toBe("[Function: anonymous]");
        });

        it("warn/error kinds are preserved", async () => {
                const { messages, evaluate } = collect();
                await evaluate(7, "console.warn('cuidado'); console.error('erro')");
                expect(messages.map((m) => m.kind)).toEqual(["warn", "error", "done"]);
        });
});

describe("v1.6.0 wiring guards", () => {
        it("settings defaults include terminalOnboardingDone (update() drops unknown keys)", () => {
                const src = read("src/lib/settings.js");
                expect(src).toMatch(/terminalOnboardingDone: false/);
        });

        it("the repl worker is a bundler entry (rspack + webpack)", () => {
                expect(read("rspack.config.js")).toMatch(
                        /replWorker: '\.\/src\/lib\/replWorker\.js'/,
                );
                expect(read("webpack.config.js")).toMatch(
                        /replWorker: '\.\/src\/lib\/replWorker\.js'/,
                );
        });

        it("the repl sidebar app is registered in the loaders", () => {
                expect(read("src/sidebarApps/index.js")).toMatch(
                        /\["repl", \(\) => import\("\.\/repl"\)\]/,
                );
        });

        it("new-terminal runs the onboarding before creating the terminal", () => {
                const src = read("src/lib/commands.js");
                const start = src.indexOf('async "new-terminal"()');
                const end = src.indexOf('async "running-processes"()');
                const fn = src.slice(start, end);
                expect(fn).toMatch(/maybeTerminalOnboarding/);
                expect(fn.indexOf("maybeTerminalOnboarding")).toBeLessThan(
                        fn.indexOf("createServerTerminal"),
                );
        });

        it("main settings register the SSH and font pages", () => {
                const src = read("src/settings/mainSettings.js");
                expect(src).toMatch(/import sshSettings from "\.\/sshSettings";/);
                expect(src).toMatch(/import fontSettings from "\.\/fontSettings";/);
                expect(src).toMatch(/case "ssh-settings":/);
                expect(src).toMatch(/case "font-settings":/);
        });

        it("terminal onboarding marks the flag before showing the dialog", () => {
                const src = read("src/lib/terminalOnboarding.js");
                const flagPos = src.indexOf("terminalOnboardingDone = true");
                const selectPos = src.indexOf("select(");
                expect(flagPos).toBeGreaterThan(-1);
                expect(selectPos).toBeGreaterThan(flagPos);
        });

        it("the ssh page lists sftp storages from localStorage", () => {
                const src = read("src/settings/sshSettings.js");
                expect(src).toMatch(/localStorage\.storageList/);
                expect(src).toMatch(/createRemoteTerminal/);
        });

        it("the font page drives lib/fonts.js (no duplicate download logic)", () => {
                const src = read("src/settings/fontSettings.js");
                expect(src).toMatch(/fonts\.addCustom/);
                expect(src).toMatch(/fonts\.loadFont/);
                expect(src).toMatch(/fonts\.setEditorFont/);
                expect(src).toMatch(/fonts\.remove/);
        });
});
