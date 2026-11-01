// @vitest-environment happy-dom
/**
 * Library catalog integrity — the CDN catalog (catalogLibs.js) plus the
 * 14 bundled entries must give the libs sidebar a 60+ catalog where every
 * entry is structurally complete (tags buildable, sizes declared,
 * licenses present) and the offline/CDN split is consistent.
 */
import { describe, expect, test } from "vitest";

import CATALOG_LIBS from "lib/catalogLibs";
import { ALL_LIBS, LOCAL_LIBS, cdnTags, localTags } from "lib/localLibs";

describe("library catalog", () => {
	test("catalog offers 55+ entries on top of the bundled 14", () => {
		expect(CATALOG_LIBS.length).toBeGreaterThanOrEqual(55);
		expect(LOCAL_LIBS.length).toBe(14);
		expect(ALL_LIBS.length).toBeGreaterThanOrEqual(69);
	});

	test("every catalog entry is structurally complete", () => {
		for (const lib of CATALOG_LIBS) {
			expect(lib.id, lib.id).toMatch(/^[a-z0-9-]+$/);
			expect(lib.name.length, lib.id).toBeGreaterThan(0);
			expect(lib.version.length, lib.id).toBeGreaterThan(0);
			expect(lib.license.length, lib.id).toBeGreaterThan(0);
			expect(lib.cdnBase, lib.id).toMatch(/^https:\/\/cdn\.jsdelivr\.net\//);
			expect(lib.files.length, lib.id).toBeGreaterThan(0);
			expect(lib.descPt.length, lib.id).toBeGreaterThan(10);
			expect(lib.descEn.length, lib.id).toBeGreaterThan(10);
		}
	});

	test("ids are unique across the merged catalog", () => {
		const ids = ALL_LIBS.map((lib) => lib.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	test("bundled flag drives which tags each entry can build", () => {
		for (const lib of ALL_LIBS) {
			expect(typeof lib.bundled, lib.id).toBe("boolean");
			if (lib.bundled) {
				expect(localTags(lib), lib.id).toContain("libs/");
			}
			const tags = cdnTags(lib);
			expect(tags, lib.id).toContain("https://");
		}
	});

	test("css files become <link>, js files become <script>", () => {
		const leaflet = CATALOG_LIBS.find((lib) => lib.id === "leaflet");
		expect(leaflet).toBeTruthy();
		const tags = cdnTags(leaflet);
		expect(tags).toContain("<link");
		expect(tags).toContain("<script");
	});
});
