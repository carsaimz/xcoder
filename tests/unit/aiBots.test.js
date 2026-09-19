import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lib/settings", () => ({
        default: {
                value: settingsState,
                update: vi.fn(async (patch) => {
                        Object.assign(settingsState, patch);
                }),
        },
}));

/** Mutable backing object the stub exposes as settings.value. */
const settingsState = {
        aiActiveBot: "",
        aiUserBots: [],
};

const bots = await import("lib/ai/bots");

beforeEach(() => {
        settingsState.aiActiveBot = "";
        settingsState.aiUserBots = [];
});

describe("ai bots", () => {
        it("ships builtin personas with prompts", () => {
                expect(bots.BUILTIN_BOTS.length).toBeGreaterThanOrEqual(6);
                for (const bot of bots.BUILTIN_BOTS) {
                        expect(bot.id).toBeTruthy();
                        expect(bot.name).toBeTruthy();
                        expect(bot.icon).toBeTruthy();
                        expect(bot.prompt.length).toBeGreaterThan(30);
                }
        });

        it("ids are unique and slug-like", () => {
                const ids = bots.BUILTIN_BOTS.map((bot) => bot.id);
                expect(new Set(ids).size).toBe(ids.length);
                for (const id of ids) {
                        expect(id).toMatch(/^[a-z0-9-]+$/);
                }
        });

        it("no bot active by default", () => {
                expect(bots.activeBot()).toBeNull();
                expect(bots.applyBotToPrompt("BASE", bots.activeBot())).toBe("BASE");
        });

        it("validates and prefixes user bots", () => {
                const bot = bots.validateUserBot({
                        name: "Meu Bot",
                        icon: "🚀",
                        description: "teste",
                        prompt: "Responda sempre em rima.",
                });
                expect(bot.id).toBe("user-meu-bot");
                expect(bot.icon).toBe("🚀");
                expect(() =>
                        bots.validateUserBot({ name: "", prompt: "x" }),
                ).toThrow(/name/i);
                expect(() => bots.validateUserBot({ name: "a", prompt: "  " })).toThrow(
                        /persona/i,
                );
        });

        it("never collides with builtin ids", () => {
                const bot = bots.validateUserBot({
                        name: "reviewer",
                        prompt: "clonando o id builtin",
                });
                expect(bot.id.startsWith("user-")).toBe(true);
                expect(
                        bots.BUILTIN_BOTS.some((entry) => entry.id === bot.id),
                ).toBe(false);
        });

        it("saves, activates and deletes a user bot", async () => {
                const bot = await bots.saveUserBot({
                        name: "Poeta",
                        prompt: "Responda em verso.",
                });
                expect(settingsState.aiUserBots).toHaveLength(1);

                const activated = await bots.setActiveBot(bot.id);
                expect(activated?.name).toBe("Poeta");
                expect(bots.activeBot()?.id).toBe(bot.id);

                await bots.deleteUserBot(bot.id);
                expect(settingsState.aiUserBots).toHaveLength(0);
                expect(settingsState.aiActiveBot).toBe("");
        });

        it("merges the persona right after the identity line", () => {
                const base = [
                        "You are the XCoder coding agent.",
                        "Current workspace root: /tmp.",
                        "Capabilities: ...",
                ].join("\n");
                const merged = bots.applyBotToPrompt(base, {
                        name: "Revisor",
                        prompt: "Severidade primeiro.",
                });
                const lines = merged.split("\n");
                expect(lines[0]).toBe("You are the XCoder coding agent.");
                expect(merged).toContain("ACTIVE PERSONA — Revisor");
                expect(merged).toContain("Severidade primeiro.");
                expect(merged.indexOf("ACTIVE PERSONA")).toBeLessThan(
                        merged.indexOf("Capabilities"),
                );
        });

        it("lists builtins first and dedupes ids", () => {
                settingsState.aiUserBots = [
                        { id: "reviewer", name: "falso", prompt: "x" },
                        { id: "user-x", name: "X", prompt: "y" },
                ];
                const listed = bots.listBots();
                const ids = listed.map((bot) => bot.id);
                expect(ids[0]).toBe(bots.BUILTIN_BOTS[0].id);
                expect(ids.filter((id) => id === "reviewer")).toHaveLength(1);
                expect(ids).toContain("user-x");
        });
});
