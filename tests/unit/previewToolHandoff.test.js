// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fileSystem", () => ({ default: vi.fn() }));
vi.mock("lib/config", () => ({ default: {} }));
vi.mock("lib/openFile", () => ({ default: vi.fn(async () => {}) }));
vi.mock("utils/helpers", () => ({
        default: { error: vi.fn() },
}));

const inspector = vi.hoisted(() => ({ openInspectorWith: vi.fn(async () => {}) }));
const scraper = vi.hoisted(() => ({ openScraperWith: vi.fn(async () => {}) }));
const analyzer = vi.hoisted(() => ({ openAnalyzerWith: vi.fn(async () => {}) }));

// v1.8.40: the tools are independent pages (pages/tools) — the hand-off
// opens the page directly, no sidebar activation involved anymore
vi.mock("pages/tools/inspector", () => inspector);
vi.mock("pages/tools/scrape", () => scraper);
vi.mock("pages/tools/analyzer", () => analyzer);

const { default: HandleIntent, processPendingIntents } = await import(
        "handlers/intent"
);

describe("preview tool hand-off intents", () => {
        beforeEach(() => {
                sessionStorage.setItem("isfilesRestored", "true");
        });

        afterEach(() => {
                sessionStorage.removeItem("isfilesRestored");
                vi.clearAllMocks();
        });

        it("opens the Inspector page with the previewed URL", async () => {
                await HandleIntent({
                        action: "android.intent.action.MAIN",
                        extras: {
                                xcoder_tool: "inspector",
                                xcoder_url: "http://localhost:8345/index.html",
                        },
                });

                expect(inspector.openInspectorWith).toHaveBeenCalledWith(
                        "http://localhost:8345/index.html",
                );
                expect(scraper.openScraperWith).not.toHaveBeenCalled();
                expect(analyzer.openAnalyzerWith).not.toHaveBeenCalled();
        });

        it("opens the Scraper page in rendered mode", async () => {
                await HandleIntent({
                        action: "android.intent.action.MAIN",
                        extras: { xcoder_tool: "scrape", xcoder_url: "http://localhost:8345/" },
                });

                expect(scraper.openScraperWith).toHaveBeenCalledWith(
                        "http://localhost:8345/",
                        "rendered",
                );
        });

        it("opens the Analyzer page with the previewed URL", async () => {
                await HandleIntent({
                        action: "android.intent.action.MAIN",
                        extras: {
                                xcoder_tool: "analyzer",
                                xcoder_url: "https://exemplo.com",
                        },
                });

                expect(analyzer.openAnalyzerWith).toHaveBeenCalledWith(
                        "https://exemplo.com",
                );
        });

        it("opens the tool page without a URL when none was handed over", async () => {
                await HandleIntent({
                        action: "android.intent.action.MAIN",
                        extras: { xcoder_tool: "inspector" },
                });

                expect(inspector.openInspectorWith).not.toHaveBeenCalled();
        });

        it("queues the hand-off before files are restored, then drains it", async () => {
                sessionStorage.setItem("isfilesRestored", "false");

                await HandleIntent({
                        extras: { xcoder_tool: "scrape", xcoder_url: "https://exemplo.com" },
                });
                expect(scraper.openScraperWith).not.toHaveBeenCalled();

                sessionStorage.setItem("isfilesRestored", "true");
                await processPendingIntents();

                expect(scraper.openScraperWith).toHaveBeenCalledWith(
                        "https://exemplo.com",
                        "rendered",
                );
        });

        it("ignores intents without tool extras", async () => {
                await HandleIntent({ action: "android.intent.action.MAIN", extras: {} });

                expect(inspector.openInspectorWith).not.toHaveBeenCalled();
                expect(scraper.openScraperWith).not.toHaveBeenCalled();
                expect(analyzer.openAnalyzerWith).not.toHaveBeenCalled();
        });
});
