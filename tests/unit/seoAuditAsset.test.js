import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The SEO audit overlay runs INSIDE the previewed page (injected by the
 * native preview screen). It ships as a plugin asset, so there is no DOM
 * here — this suite guards syntax and the injection contract instead.
 */
const assetPath = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../src/plugins/browser/res/android/seo-audit.js",
);

describe("seo-audit.js asset", () => {
        const source = readFileSync(assetPath, "utf8");

        it("compiles as a standalone script", () => {
                expect(() => new Function(source)).not.toThrow();
        });

        it("keeps the injection contract (idempotent overlay + report copy)", () => {
                expect(source).toContain("__xcoderSeoAudit");
                expect(source).toContain("xc-seo-root");
                expect(source).toContain('data-act="copy"');
                expect(source).toContain('data-act="refresh"');
                expect(source).toContain('data-act="close"');
        });

        it("scores every category with pass/warn/fail checks", () => {
                expect(source).toContain("weight: 25");
                expect(source).toContain("weight: 15");
                expect(source).toContain('"pass"');
                expect(source).toContain('"warn"');
                expect(source).toContain('"fail"');
        });
});
