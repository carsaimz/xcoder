// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

vi.mock("lib/settings", () => ({
        default: {
                value: {},
                on: () => {},
                get: () => ({}),
        },
}));
vi.mock("lib/logger", () => ({
        default: { log: () => {}, info: () => {}, warn: () => {}, error: () => {} },
}));

import THEMES from "../../src/theme/preInstalled.js";

describe("default Xcoder theme (VS Code Dark Modern)", () => {
        const theme = THEMES.find(({ name }) => name === "Xcoder");

        it("keeps the VS Code Dark Modern chrome palette", () => {
                expect(theme.primaryColor).toBe("rgb(24, 24, 24)");
                expect(theme.secondaryColor).toBe("rgb(31, 31, 31)");
                expect(theme.primaryTextColor).toBe("rgb(204, 204, 204)");
                expect(theme.secondaryTextColor).toBe("rgb(157, 157, 157)");
                expect(theme.borderColor).toBe("rgb(43, 43, 43)");
        });

        it("uses the VS Code blue accent for actions and links", () => {
                expect(theme.activeColor).toBe("rgb(0, 120, 212)");
                expect(theme.popupActiveColor).toBe("rgb(0, 120, 212)");
                expect(theme.buttonBackgroundColor).toBe("rgb(0, 120, 212)");
                expect(theme.buttonActiveColor).toBe("rgb(0, 95, 173)");
                expect(theme.linkTextColor).toBe("rgb(77, 170, 252)");
        });

        it("pairs the app theme with the built-in vscodeDark editor theme", () => {
                expect(theme.preferredEditorTheme).toBe("vscodeDark");
                expect(theme.preferredTerminalTheme).toBe("dark");
        });
});
