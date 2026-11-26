import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * v1.8.41/42 — chat consent widgets + URL cards + learn visited memory:
 *  - agent: consent handler hook, «permitir sempre» set, dialog fallback
 *  - chat: in-chat consent card replaces the blocking confirm
 *  - chat: URL cards with «Abrir» / «Abrir no Scraper»
 *  - learn: visited badges, «Recentes» row and the scraper hand-off
 */
const repoRoot = path.resolve(__dirname, "../..");
const read = (p) => readFileSync(path.join(repoRoot, p), "utf-8");

describe("agent consent flow", () => {
	const agent = read("src/lib/ai/agent.js");

	it("accepts a consentHandler option in the constructor", () => {
		expect(agent).toContain("this.consentHandler = opts.consentHandler");
		expect(agent).toContain("this.allowedAlways = new Set()");
	});

	it("prefers the in-chat card over the blocking confirm dialog", () => {
		expect(agent).toContain('typeof this.consentHandler === "function"');
		expect(agent).toContain("if (this.allowedAlways.has(name)) return true;");
		expect(agent).toContain("return Boolean(choice?.approved);");
		// dialog fallback still exists for call sites without the chat UI
		expect(agent).toContain("return confirm(");
	});

	it("stores «permitir sempre» approvals for the conversation", () => {
		expect(agent).toContain("this.allowedAlways.add(name)");
	});
});

describe("chat consent widget", () => {
	const chat = read("src/sidebarApps/ai/index.js");

	it("renders the consent card inside the conversation", () => {
		expect(chat).toContain("function requestConsent(request)");
		expect(chat).toContain("function buildConsentCard(");
		expect(chat).toContain('className="ai-consent-card"');
		expect(chat).toContain("ai-consent-danger danger-${danger}");
	});

	it("offers Negar / Permitir / Permitir sempre", () => {
		expect(chat).toContain('strings["consent deny"] || "Negar"');
		expect(chat).toContain('strings["consent allow"] || "Permitir"');
		expect(chat).toContain('strings["consent always"] || "Permitir sempre"');
	});

	it("every agent instance goes through createAgent (consent wired)", () => {
		expect(chat).toContain("function createAgent(opts = {})");
		expect(chat).toContain(
			"consentHandler: opts.consentHandler || requestConsent",
		);
		const direct = chat.match(/(?<!function\s)new Agent\(/g) || [];
		// only the factory may call new Agent
		expect(direct.length).toBe(1);
	});

	it("i18n keys exist in en-us and pt-br", () => {
		const en = JSON.parse(read("src/lang/en-us.json"));
		const pt = JSON.parse(read("src/lang/pt-br.json"));
		for (const key of [
			"consent allow",
			"consent always",
			"consent deny",
			"consent allowed",
			"consent denied",
			"consent danger read",
			"consent danger exec",
			"consent danger write",
			"consent danger destructive",
		]) {
			expect(en[key]).toBeTruthy();
			expect(pt[key]).toBeTruthy();
		}
	});
});

describe("chat URL cards", () => {
	const chat = read("src/sidebarApps/ai/index.js");

	it("scans assistant bubbles for links and renders cards", () => {
		expect(chat).toContain("function appendUrlCards($body, $bubble)");
		expect(chat).toContain('querySelectorAll("a.ai-md-link")');
		expect(chat).toContain('className="ai-url-card"');
	});

	it("is hooked into appendEvent and finalizeLiveStream", () => {
		expect(chat).toMatch(/appendUrlCards\(\$body, \$bubble\);/);
		expect(chat).toContain("appendUrlCards(live.body, $bubble);");
	});

	it("URL cards only open in the browser (Scraper removed in v1.8.42)", () => {
		expect(chat).not.toContain("openChatUrlInScraper");
		expect(chat).not.toContain("pages/tools/scrape");
		expect(chat).toContain("openChatUrlExternal");
	});
});

describe("learn page: visited memory + scraper button", () => {
	const page = read("src/pages/tools/learn/index.js");
	const history = read("src/lib/learnHistory.js");

	it("records visits and reads the persistent store", () => {
		expect(page).toContain('from "lib/learnHistory"');
		expect(page).toContain("recordVisit(site.url);");
		expect(history).toContain('const HISTORY_KEY = "learnVisited"');
	});

	it("shows «Recentes» and a clear action", () => {
		expect(page).toContain("function buildRecents()");
		expect(page).toContain("function clearHistory()");
		expect(page).toContain('t("learn recent", "Recentes")');
		expect(page).toContain('className="lrn-recent-chip"');
	});

	it("marks visited sites with a badge", () => {
		expect(page).toContain("lrn-visited");
		expect(page).toContain('t("learn visited", "Visitado")');
	});

	it("has no Scraper hand-off (tools removed in v1.8.42)", () => {
		expect(page).not.toContain("openInScraper");
		expect(page).not.toContain("openScraperWith");
		expect(page).not.toContain("lrn-site-scraper");
	});

	it("i18n keys exist in en-us and pt-br", () => {
		const en = JSON.parse(read("src/lang/en-us.json"));
		const pt = JSON.parse(read("src/lang/pt-br.json"));
		for (const key of [
			"learn recent",
			"learn clear history",
			"learn history cleared",
			"learn visited",
			"open in scraper",
			"chat open site",
		]) {
			expect(en[key]).toBeTruthy();
			expect(pt[key]).toBeTruthy();
		}
	});
});
