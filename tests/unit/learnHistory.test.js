// @vitest-environment happy-dom
/**
 * Learn catalog + visited-site memory (v1.8.41):
 *  - catalog integrity (unique urls, valid categories, https, PT sites)
 *  - persistence of visited sites (count, last, recents, clear)
 */
import assert from "node:assert/strict";
import { beforeEach, describe, test } from "vitest";

import {
	clearVisited,
	getRecent,
	getVisited,
	isVisited,
	recordVisit,
	visitCount,
} from "../../src/lib/learnHistory";
import LEARN_SITES from "../../src/res/learn-sites.json";

const VALID_CATS = new Set([
	"general",
	"htmlcss",
	"js",
	"python",
	"jvm",
	"clang",
	"git",
	"backend",
	"practice",
	"data",
	"devops",
]);

describe("learn catalog", () => {
	test("every site has name, url, valid cat and desc", () => {
		for (const site of LEARN_SITES) {
			assert.ok(site.name?.trim(), `name missing on ${site.url}`);
			assert.ok(site.desc?.trim(), `desc missing on ${site.url}`);
			assert.match(site.url, /^https:\/\//, `url not https: ${site.url}`);
			assert.ok(
				VALID_CATS.has(site.cat),
				`unknown cat "${site.cat}" on ${site.url}`,
			);
		}
	});

	test("urls are unique", () => {
		const urls = new Set(LEARN_SITES.map((site) => site.url));
		assert.equal(urls.size, LEARN_SITES.length, "duplicate site url");
	});

	test("catalog grew with Portuguese sites", () => {
		assert.ok(LEARN_SITES.length >= 55, `only ${LEARN_SITES.length} sites`);
		const ptUrls = [
			"https://cursoemvideo.com/",
			"https://www.freecodecamp.org/portuguese/",
			"https://developer.mozilla.org/pt-BR/",
			"https://www.w3schools.pt/",
			"https://pt.javascript.info/",
			"https://git-scm.com/book/pt-br",
			"https://pt.stackoverflow.com/",
		];
		const all = new Set(LEARN_SITES.map((site) => site.url));
		for (const url of ptUrls) {
			assert.ok(all.has(url), `missing PT site: ${url}`);
		}
	});
});

describe("learn visited memory", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	test("starts empty", () => {
		assert.equal(Object.keys(getVisited()).length, 0);
		assert.equal(isVisited("https://example.com"), false);
		assert.equal(visitCount("https://example.com"), 0);
	});

	test("recordVisit increments count and stamps last", () => {
		recordVisit(LEARN_SITES[0].url);
		recordVisit(LEARN_SITES[0].url);
		const store = getVisited();
		assert.equal(store[LEARN_SITES[0].url].count, 2);
		assert.ok(store[LEARN_SITES[0].url].last > 0);
		assert.equal(isVisited(LEARN_SITES[0].url), true);
		assert.equal(visitCount(LEARN_SITES[0].url), 2);
	});

	test("getRecent returns newest first, limited, catalog-only", async () => {
		const [a, b, c] = LEARN_SITES.slice(0, 3);
		recordVisit(a.url);
		await new Promise((resolve) => setTimeout(resolve, 5));
		recordVisit(b.url);
		await new Promise((resolve) => setTimeout(resolve, 5));
		recordVisit(c.url);
		await new Promise((resolve) => setTimeout(resolve, 5));
		// a non-catalog url must never show up
		localStorage.setItem(
			"learnVisited",
			JSON.stringify({
				...JSON.parse(localStorage.getItem("learnVisited")),
				"https://not-in-catalog.example.com": { count: 9, last: Date.now() },
			}),
		);
		const urls = LEARN_SITES.map((site) => site.url);
		const recent = getRecent(urls, 2);
		assert.equal(recent.length, 2);
		assert.equal(recent[0].url, c.url);
		assert.equal(recent[1].url, b.url);
	});

	test("clearVisited forgets everything", () => {
		recordVisit(LEARN_SITES[0].url);
		clearVisited();
		assert.equal(Object.keys(getVisited()).length, 0);
	});

	test("recordVisit tolerates falsy url", () => {
		recordVisit("");
		recordVisit(undefined);
		assert.equal(Object.keys(getVisited()).length, 0);
	});
});
