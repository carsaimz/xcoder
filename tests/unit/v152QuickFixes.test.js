import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * v1.5.2 quick fixes regression:
 *  - "Pensar"/"Buscar" pills persist (settings defaults exist → update() no longer drops them)
 *  - chat strip shows the MODEL first, then the provider logo, and scrolls sideways
 *  - real brand SVG logos are attached via providerIcon()
 *  - message copy falls back to the cordova clipboard plugin + execCommand
 *  - tab-history buttons stay tappable when dead ("dull", not "disabled") and give toast feedback
 *  - AI/provider errors are localized through window.strings with {placeholder} interpolation
 *  - terminal: AXS mode marker + auto-restart on mode mismatch + verified rootfs extraction
 */

const read = (p) => readFileSync(resolve(__dirname, "../../", p), "utf8");

describe("thinking / web-search quick toggles", () => {
        it("settings defaults include aiShowThinking and aiWebTools (update() drops unknown keys)", () => {
                const src = read("src/lib/settings.js");
                expect(src).toMatch(/aiShowThinking: true/);
                expect(src).toMatch(/aiWebTools: true/);
        });

        it("composer flips persist through settings.update", () => {
                const src = read("src/sidebarApps/ai/index.js");
                expect(src).toMatch(/settings\.update\(\{ aiShowThinking: next \}\)/);
                expect(src).toMatch(/settings\.update\(\{ aiWebTools: next \}\)/);
        });

        it("AI settings page wires the aiWebTools checkbox", () => {
                const src = read("src/settings/aiSettings.js");
                expect(src).toMatch(/key === "aiWebTools"/);
        });
});

describe("chat provider strip", () => {
        it("model name comes before the provider logo", () => {
                const src = read("src/sidebarApps/ai/index.js");
                const modelPos = src.indexOf('<span className="ai-strip-model">{model}</span>,');
                const logoPos = src.indexOf('className={`ai-strip-logo${isLetter ? " letter" : ""}`}');
                expect(modelPos).toBeGreaterThan(-1);
                expect(logoPos).toBeGreaterThan(-1);
                expect(modelPos).toBeLessThan(logoPos);
        });

        it("strip injects the real brand SVG when available", () => {
                const src = read("src/sidebarApps/ai/index.js");
                expect(src).toMatch(/\.ai-strip-logo"\)\s*;\s*\n?\s*if \(\$logoEl && logo\.svg\)/);
                expect(src).toMatch(/logo\.svg\.includes\("currentColor"\)/);
        });

        it("strip scrolls horizontally instead of clipping", () => {
                const css = read("src/sidebarApps/ai/style.scss");
                expect(css).toMatch(/\.ai-provider-strip\s*\{[^}]*overflow-x:\s*auto/s);
                expect(css).toMatch(/\.ai-strip-model\s*\{[^}]*flex-shrink:\s*0/s);
        });
});

describe("provider brand logos", () => {
        it("logo module ships 16 real SVGs", async () => {
                const { PROVIDER_LOGO_SVGS } = await import("lib/ai/providerLogos");
                const ids = Object.keys(PROVIDER_LOGO_SVGS);
                expect(ids.length).toBe(16);
                for (const id of ids) {
                        const entry = PROVIDER_LOGO_SVGS[id];
                        expect(entry.svg.startsWith("<svg"), `${id} starts with <svg>`).toBe(true);
                        expect(entry.svg.endsWith("</svg>"), `${id} ends with </svg>`).toBe(true);
                        expect(entry.svg, `${id} has a viewBox`).toMatch(/viewBox="/);
                }
        });

        it("providerIcon() attaches the svg for known providers (source contract)", () => {
                const src = read("src/lib/ai/providers.js");
                expect(src).toMatch(/PROVIDER_LOGO_SVGS\[providerId\]/);
                expect(src).toMatch(/svg: logo\.svg/);
                expect(src).toMatch(/color: logo\.color \|\| known\.color/);
        });

        it("provider cards render the real logo", () => {
                const src = read("src/settings/aiProviders.js");
                expect(src).toMatch(/providerIcon/);
                expect(src).toMatch(/\.ai-picon/);
        });
});

describe("message copy reliability", () => {
        it("copy path prefers the native cordova plugin, then Clipboard API, then execCommand", () => {
                const src = read("src/sidebarApps/ai/index.js");
                const helper = src.slice(
                        src.indexOf("async function writeClipboard"),
                        src.indexOf("async function writeClipboard") + 1400,
                );
                expect(helper).toMatch(/cordova\?\.plugins\?\.clipboard/);
                expect(helper.indexOf("cordova?.plugins?.clipboard")).toBeGreaterThan(-1);
                expect(helper.indexOf("navigator.clipboard.writeText")).toBeGreaterThan(
                        helper.indexOf("cordova?.plugins?.clipboard"),
                );
                expect(helper).toMatch(/document\.execCommand\("copy"\)/);
                expect(src).toMatch(/copyMessageText[\s\S]{0,200}await writeClipboard\(text\)/);
        });
});

describe("tab history header buttons", () => {
        it("dead-end buttons stay tappable (dull) and toast instead of pointer-events:none", () => {
                const main = read("src/main.js");
                expect(main).toMatch(/\$tabBackBtn\.classList\.toggle\("dull"/);
                expect(main).toMatch(/\$tabFwdBtn\.classList\.toggle\("dull"/);
                const commands = read("src/lib/commands.js");
                expect(commands).toMatch(
                        /"no tab history prev"\] \|\| "Sem mais abas atrás no histórico"/,
                );
                expect(commands).toMatch(
                        /"no tab history next"\] \|\| "Sem mais abas adiante no histórico"/,
                );
        });

        it("feedback strings exist in both languages", async () => {
                const pt = JSON.parse(read("src/lang/pt-br.json"));
                const en = JSON.parse(read("src/lang/en-us.json"));
                expect(pt["no tab history prev"]).toBeTruthy();
                expect(pt["no tab history next"]).toBeTruthy();
                expect(en["no tab history prev"]).toBeTruthy();
                expect(en["no tab history next"]).toBeTruthy();
        });
});

describe("AI/provider error localization", () => {
        it("explainError uses localized templates with placeholders", () => {
                const src = read("src/lib/ai/client.js");
                expect(src).toMatch(/"ai err 401 pollinations"/);
                expect(src).toMatch(/\{provider\}Chave de API inválida/);
                expect(src).toMatch(/"ai err network fetch"/);
        });

        it("friendlyError interpolates {name}/{model} into localized strings", () => {
                const src = read("src/lib/ai/agent.js");
                expect(src).toMatch(/fillTemplate/);
                expect(src).toMatch(/\{ name \},/);
                expect(src).toMatch(/\{ name, model: config\.model \}/);
                expect(src).toMatch(/\{raw\}/);
        });

        it("PROVIDER_NAMES covers every branded provider", () => {
                const src = read("src/lib/ai/client.js");
                for (const id of [
                        "google",
                        "openai",
                        "anthropic",
                        "deepseek",
                        "xai",
                        "perplexity",
                        "azure-openai",
                        "nvidia",
                        "github-models",
                        "zai",
                ]) {
                        expect(src, `PROVIDER_NAMES[${id}]`).toMatch(
                                new RegExp(`"?${id}"?: "`),
                        );
                }
        });

        it("localized error keys ship in both languages", async () => {
                const pt = JSON.parse(read("src/lang/pt-br.json"));
                const en = JSON.parse(read("src/lang/en-us.json"));
                for (const key of [
                        "ai err auth",
                        "ai err key invalid",
                        "ai err model missing",
                        "ai err rate",
                        "ai err network",
                        "ai err no key",
                        "ai request failed",
                        "ai max steps",
                        "ai err 401",
                        "ai err 429",
                ]) {
                        expect(pt[key], `pt-br ${key}`).toBeTruthy();
                        expect(en[key], `en-us ${key}`).toBeTruthy();
                }
                // placeholders survive translation
                expect(pt["ai err key invalid"]).toContain("{name}");
                expect(pt["ai err model missing"]).toContain("{model}");
        });
});

describe("terminal Alpine/FailSafe healing", () => {
        it("AXS start writes a mode marker", () => {
                const src = read("src/plugins/terminal/www/Terminal.js");
                expect(src).toMatch(/axs-mode/);
                expect(src).toMatch(/failsafe \? "failsafe" : "alpine"/);
        });

        it("getAxsMode() reads the marker", () => {
                const src = read("src/plugins/terminal/www/Terminal.js");
                expect(src).toMatch(/async getAxsMode\(\)/);
                expect(src).toMatch(/cat \$\{filesDir\}\/axs-mode/);
        });

        it("session start restarts a stale AXS in the wrong mode", () => {
                const src = read("src/components/terminal/terminal.js");
                expect(src).toMatch(/const wantedMode = terminalValues\.failsafeMode \? "failsafe" : "alpine"/);
                expect(src).toMatch(/runningMode !== wantedMode/);
                expect(src).toMatch(/await Terminal\.stopAxs\(\)/);
        });

        it("failsafe sessions show an explanatory banner", () => {
                const src = read("src/components/terminal/terminal.js");
                expect(src).toMatch(/strings\["terminal failsafe notice"\]/);
        });

        it("rootfs extraction is verified before the installed marker", () => {
                const src = read("src/plugins/terminal/www/Terminal.js");
                expect(src).toMatch(/Alpine rootfs extraction failed/);
                expect(src).toMatch(/bin\/busybox/);
        });
});
