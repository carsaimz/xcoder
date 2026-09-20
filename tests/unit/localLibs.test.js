import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
        LOCAL_LIBS,
        assetsLibsRoot,
        cdnTags,
        copyPlan,
        fileUrl,
        formatBytes,
        libSize,
        localTags,
        tagFor,
} from "../../src/lib/localLibs";

const getLib = (id) => LOCAL_LIBS.find((lib) => lib.id === id);

describe("localLibs registry", () => {
        it("ships the expected catalog", () => {
                expect(LOCAL_LIBS.map((lib) => lib.id)).toEqual([
                        "htmx",
                        "alpinejs",
                        "jquery",
                        "bootstrap",
                        "bootstrap-icons",
                        "boxicons",
                        "fontawesome",
                        "chartjs",
                ]);
        });

        it("every registered file exists on disk with the exact byte size", () => {
                // guards against broken bundles after version bumps
                const base = path.resolve(__dirname, "../../src/res/libs");
                for (const lib of LOCAL_LIBS) {
                        for (const file of lib.files) {
                                const full = path.join(base, lib.id, file.path);
                                const size = statSync(full).size;
                                expect(size, `${lib.id}/${file.path}`).toBe(file.size);
                        }
                }
        });

        it("descriptions exist in both languages", () => {
                for (const lib of LOCAL_LIBS) {
                        expect(lib.descPt.length).toBeGreaterThan(20);
                        expect(lib.descEn.length).toBeGreaterThan(20);
                }
        });
});

describe("tag building", () => {
        beforeEach(() => {
                delete globalThis.ASSETS_DIRECTORY;
        });

        it("css files get a <link>, js files a <script>", () => {
                expect(tagFor({ path: "a.min.css", size: 1 }, "/x/a.min.css")).toBe(
                        '<link rel="stylesheet" href="/x/a.min.css" />',
                );
                expect(tagFor({ path: "a.min.js", size: 1 }, "/x/a.min.js")).toBe(
                        '<script src="/x/a.min.js"></script>',
                );
                expect(tagFor({ path: "a.min.js", size: 1, defer: true }, "/u")).toBe(
                        '<script src="/u" defer></script>',
                );
        });

        it("local tags point at the project copy", () => {
                expect(localTags(getLib("htmx"))).toBe(
                    '<script src="libs/htmx/htmx.min.js" defer></script>',
                );
        });

        it("font-only assets never render a tag of their own", () => {
                const tags = localTags(getLib("bootstrap-icons"));
                expect(tags).toContain("bootstrap-icons.min.css");
                expect(tags).not.toContain(".woff2");
        });

        it("cdn tags mirror the jsDelivr sources", () => {
                const tags = cdnTags(getLib("bootstrap"));
                expect(tags).toContain(
                        'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
                );
                expect(tags).toContain("js/bootstrap.bundle.min.js");
        });

        it("assetsLibsRoot() honours ASSETS_DIRECTORY", () => {
                // empty assets root (browser dev) resolves from the server root,
                // which is www/ — where utils/config.js copies the libraries
                expect(assetsLibsRoot()).toBe("/res/libs");
                globalThis.ASSETS_DIRECTORY = "file:///android_asset/www";
                const htmx = getLib("htmx");
                expect(fileUrl(htmx, htmx.files[0], "local")).toBe(
                        "file:///android_asset/www/res/libs/htmx/htmx.min.js",
                );
        });
});

describe("sizes and copy plans", () => {
        it("libSize sums all bundled files", () => {
                const bootstrap = getLib("bootstrap");
                expect(libSize(bootstrap)).toBe(
                        232803 + 80721,
                );
        });

        it("formatBytes stays human", () => {
                expect(formatBytes(500)).toBe("500 B");
                expect(formatBytes(50917)).toBe("49.7 KB");
                expect(formatBytes(205615)).toBe("200.8 KB");
                expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
        });

        it("copyPlan preserves the folder layout", () => {
                const fontawesome = getLib("fontawesome");
                // the UI passes <project>/libs as destRoot
                const plan = copyPlan(fontawesome, "/project/www/libs");
                expect(plan).toHaveLength(fontawesome.files.length);
                const css = plan[0];
                expect(css.to).toBe("/project/www/libs/fontawesome/css/all.min.css");
                expect(css.dirParts).toEqual(["css"]);
                expect(css.name).toBe("all.min.css");
                const font = plan[1];
                expect(font.to).toBe(
                        "/project/www/libs/fontawesome/webfonts/fa-solid-900.woff2",
                );
        });
});

describe("bundled libs are wired into the app", () => {
        it("the sidebar app registers the libs loader", () => {
                const source = readFileSync(
                        path.resolve(__dirname, "../../src/sidebarApps/index.js"),
                        "utf-8",
                );
                expect(source).toContain('["libs", () => import("./libs")]');
        });

        it("the build copies src/res/libs into www/res/libs", () => {
                const source = readFileSync(
                        path.resolve(__dirname, "../../utils/config.js"),
                        "utf-8",
                );
                expect(source).toContain('"src", "res", "libs"');
                expect(source).toContain('"www", "res", "libs"');
        });
});
