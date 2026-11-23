import { describe, expect, it } from "vitest";
import pkg from "../../package.json";
import oss from "res/oss-libraries.json";

describe("oss-libraries.json — About «todas as bibliotecas»", () => {
	it("lists every production dependency", () => {
		const listed = new Set(oss.libraries.map((lib) => lib.name));
		for (const dep of Object.keys(pkg.dependencies)) {
			expect(listed.has(dep), `${dep} missing from the About list`).toBe(true);
		}
		expect(oss.libraries.length).toBe(Object.keys(pkg.dependencies).length);
	});

	it("every entry has name, version, license and homepage", () => {
		for (const lib of oss.libraries) {
			expect(lib.name, "name").toBeTruthy();
			expect(lib.version, `version of ${lib.name}`).toBeTruthy();
			expect(lib.license, `license of ${lib.name}`).toBeTruthy();
			expect(lib.license, `license of ${lib.name}`).not.toBe("Unknown");
			expect(lib.homepage, `homepage of ${lib.name}`).toMatch(/^https?:\/\//);
		}
	});

	it("is sorted alphabetically", () => {
		const names = oss.libraries.map((lib) => lib.name.toLowerCase());
		const sorted = [...names].sort();
		expect(names).toEqual(sorted);
	});
});
