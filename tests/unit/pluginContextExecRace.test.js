// @vitest-environment happy-dom
/**
 * Acode #2851 port: `cordova.exec` is mapped asynchronously while Cordova
 * starts. pluginContext used to reject with "Cordova bridge is not
 * available" when a plugin called before the mapping — now it falls back
 * to Cordova's internal module loader (available as soon as cordova.js
 * has been evaluated).
 */
import assert from "node:assert/strict";
import { afterEach, describe, expect, test, vi } from "vitest";

afterEach(() => {
        vi.resetModules();
        vi.unstubAllGlobals();
});

describe("pluginContext cordova bridge (Acode #2851)", () => {
        test(
                "works before cordova.exec is mapped via the internal loader",
                { timeout: 20000 },
                async () => {
                        const nativeExec = vi.fn((resolve, _reject, _service, action) => {
                                if (action === "establishConnection") resolve("trusted-session");
                                else if (action === "requestToken") resolve("plugin-token");
                        });
                        const requireModule = vi.fn(() => nativeExec);
                        vi.stubGlobal("cordova", {
                                require: requireModule,
                                // exec deliberately NOT mapped yet — the race window
                        });

                        const pluginContext = await import("lib/pluginContext");

                        await expect(pluginContext.connect()).resolves.toBe(true);
                        expect(requireModule).toHaveBeenCalledWith("cordova/exec");
                },
        );

        test(
                "resolves false (never throws) when no bridge exists at all",
                { timeout: 20000 },
                async () => {
                        vi.stubGlobal("cordova", undefined);
                        const pluginContext = await import("lib/pluginContext");
                        await expect(pluginContext.connect()).resolves.toBe(false);
                },
        );
});
