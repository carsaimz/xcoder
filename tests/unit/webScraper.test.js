import { describe, expect, it } from "vitest";
import {
        assetName,
        beautifyCode,
        buildReport,
        classifyAsset,
        extractAssets,
        extractLinks,
        extractMeta,
        extractTables,
        findEndpoints,
        findSecrets,
        guessLanguage,
        looksMinified,
        maskSecret,
        resolveUrl,
        seoAudit,
        tableToCsv,
} from "../../src/lib/webScraper";

describe("webScraper", () => {
        describe("resolveUrl", () => {
                it("resolves relative URLs against the page base", () => {
                        expect(resolveUrl("/img/logo.png", "https://ex.com/a/b/")).toBe(
                                "https://ex.com/img/logo.png",
                        );
                        expect(resolveUrl("page.html", "https://ex.com/a/")).toBe(
                                "https://ex.com/a/page.html",
                        );
                });

                it("keeps absolute urls and rejects junk schemes", () => {
                        expect(resolveUrl("https://cdn.ex.org/x.js", "https://ex.com/")).toBe(
                                "https://cdn.ex.org/x.js",
                        );
                        expect(resolveUrl("data:image/png;base64,AAA", "https://ex.com/")).toBe(
                                null,
                        );
                        expect(resolveUrl("#anchor", "https://ex.com/")).toBe(null);
                        expect(resolveUrl("", "https://ex.com/")).toBe(null);
                });
        });

        describe("classifyAsset", () => {
                it("classifies by extension and tag", () => {
                        expect(classifyAsset("https://x.com/a.png")).toBe("img");
                        expect(classifyAsset("https://x.com/app.min.js")).toBe("js");
                        expect(classifyAsset("https://x.com/style.css")).toBe("css");
                        expect(classifyAsset("https://x.com/font.woff2")).toBe("font");
                        expect(classifyAsset("https://x.com/clip.mp4")).toBe("media");
                        expect(classifyAsset("https://x.com/img", "img")).toBe("img");
                        expect(classifyAsset("https://x.com/unknown.xyz")).toBe("other");
                });
        });

        describe("assetName", () => {
                it("extracts the last path segment", () => {
                        expect(assetName("https://x.com/img/logo.png")).toBe("logo.png");
                        expect(assetName("https://x.com/")).toBe("x.com");
                });
        });

        describe("extractAssets", () => {
                const html = `
                        <html>
                        <head>
                                <link rel="stylesheet" href="/css/main.css">
                                <link rel="icon" href="/favicon.ico">
                                <script src="/js/app.js" defer></script>
                                <style>body{background:url("/img/bg.png")}</style>
                        </head>
                        <body>
                                <img src="hero.jpg" srcset="hero.jpg 1x, hero@2x.jpg 2x">
                                <video src="/media/intro.mp4"></video>
                        </body>
                        </html>
                `;

                it("collects and classifies every asset", () => {
                        const result = extractAssets(html, "https://site.com/page/");
                        expect(result.all.length).toBeGreaterThanOrEqual(7);

                        const urls = result.all.map((a) => a.url);
                        expect(urls).toContain("https://site.com/css/main.css");
                        expect(urls).toContain("https://site.com/js/app.js");
                        expect(urls).toContain("https://site.com/img/bg.png");
                        expect(urls).toContain("https://site.com/page/hero.jpg");
                        expect(urls).toContain("https://site.com/page/hero@2x.jpg");
                        expect(urls).toContain("https://site.com/media/intro.mp4");
                        expect(urls).toContain("https://site.com/favicon.ico");

                        expect(result.images).toHaveLength(4);
                        expect(result.scripts).toHaveLength(1);
                        expect(result.styles).toHaveLength(1);
                        expect(result.media).toHaveLength(1);
                });

                it("dedupes repeated urls", () => {
                        const result = extractAssets(
                                '<img src="a.png"><img src="/a.png">',
                                "https://s.com/",
                        );
                        expect(result.images).toHaveLength(1);
                });

                it("ignores data urls", () => {
                        const result = extractAssets(
                                '<img src="data:image/png;base64,AAA"><script src="x.js">',
                                "https://s.com/",
                        );
                        expect(result.images).toHaveLength(0);
                        expect(result.scripts).toHaveLength(1);
                });
        });

        describe("maskSecret", () => {
                it("masks long values", () => {
                        expect(maskSecret("AKIAIOSFODNN7EXAMPLE")).toBe("AKIAIO…PLE");
                        expect(maskSecret("short")).toBe("sh…");
                });
        });

        describe("findSecrets", () => {
                it("finds AWS, Google and generic assignment secrets with line numbers", () => {
                        const code = [
                                "const config = {",
                                "  awsId: 'AKIAIOSFODNN7EXAMPLE',",
                                "  googleMaps: \"AIzaSyD-abcDEF123456ghijklmnopqrstuvwxyz01\",",
                                "  api_key = 'supersecretvalue123',",
                                "};",
                        ].join("\n");
                        const secrets = findSecrets(code);
                        const kinds = secrets.map((s) => s.kind);
                        expect(kinds).toContain("aws-key");
                        expect(kinds).toContain("google-key");
                        expect(kinds).toContain("assignment");

                        const aws = secrets.find((s) => s.kind === "aws-key");
                        expect(aws.line).toBe(2);
                        expect(aws.masked).not.toBe(aws.value);
                });

                it("detects GitHub tokens and JWTs", () => {
                        const code =
                                "token: ghp_abcdefghijklmnopqrstuvwx 12\njwt: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJVadQssw5c";
                        const secrets = findSecrets(code);
                        const kinds = secrets.map((s) => s.kind);
                        expect(kinds).toContain("github-token");
                        expect(kinds).toContain("jwt");
                });

                it("returns nothing for clean code", () => {
                        expect(findSecrets("const a = 1;\nconsole.log(a);")).toHaveLength(0);
                });
        });

        describe("findEndpoints", () => {
                it("collects api paths and absolute urls with line numbers", () => {
                        const code = [
                                "fetch('/api/v1/users')",
                                "const base = 'https://api.example.com';",
                                "post('https://api.example.com/graphql')",
                        ].join("\n");
                        const result = findEndpoints(code);
                        expect(result.apiPaths.map((p) => p.value)).toEqual(["/api/v1/users"]);
                        expect(result.urls).toHaveLength(2);
                        expect(result.urls[0].line).toBe(2);
                });
        });

        describe("extractMeta", () => {
                it("reads title, description and og tags", () => {
                        const html = `
                                <html lang="pt">
                                <head>
                                        <title>Loja Exemplo</title>
                                        <meta name="description" content="A melhor loja">
                                        <meta name="generator" content="WordPress 6.0">
                                        <meta property="og:image" content="https://x.com/cover.jpg">
                                        <link rel="canonical" href="https://x.com/loja">
                                </head>
                                <body></body>
                                </html>
                        `;
                        const meta = extractMeta(html);
                        expect(meta.title).toBe("Loja Exemplo");
                        expect(meta.description).toBe("A melhor loja");
                        expect(meta.generator).toBe("WordPress 6.0");
                        expect(meta.lang).toBe("pt");
                        expect(meta.canonical).toBe("https://x.com/loja");
                        expect(meta.openGraph).toContainEqual([
                                "og:image",
                                "https://x.com/cover.jpg",
                        ]);
                });
        });

        describe("guessLanguage", () => {
                it("guesses from url then content", () => {
                        expect(guessLanguage("https://x.com/a.css", "")).toBe("css");
                        expect(guessLanguage("https://x.com/a.json", "{}")).toBe("json");
                        expect(guessLanguage("", "<!doctype html>")).toBe("html");
                        expect(guessLanguage("", "const x = 1;")).toBe("js");
                        expect(guessLanguage("", '{"a":1}')).toBe("json");
                });
        });

        describe("beautifyCode", () => {
                it("formats minified CSS", async () => {
                        const pretty = await beautifyCode(
                                "body{margin:0;padding:0;color:#fff}",
                                "css",
                        );
                        expect(pretty).toContain("body {");
                        expect(pretty).toContain("margin: 0;");
                });

                it("formats minified JS", async () => {
                        const pretty = await beautifyCode(
                                "function a(){const x=1;return x+1}",
                                "js",
                        );
                        expect(pretty).toContain("function a() {");
                        expect(pretty.split("\n").length).toBeGreaterThan(1);
                });
        });

        describe("looksMinified", () => {
                it("flags few-very-long-line bundles as minified", () => {
                        const bundle = `${"<!doctype html><html><head></head><body>".padEnd(120, "x")}<script>${"a;".repeat(3000)}</script></body></html>`;
                        expect(looksMinified(bundle)).toBe(true);
                });

                it("flags sources with a huge single line as minified", () => {
                        const source = `line one\n${"x".repeat(6000)}\nline three`;
                        expect(looksMinified(source)).toBe(true);
                });

                it("keeps normal multi-line sources untouched", () => {
                        const html = Array.from(
                                { length: 40 },
                                (_, i) => `<p>parágrafo ${i} com conteúdo legível</p>`,
                        ).join("\n");
                        expect(looksMinified(html)).toBe(false);
                        expect(looksMinified("<p>curto</p>")).toBe(false);
                        expect(looksMinified("")).toBe(false);
                });
        });

        describe("seoAudit", () => {
                const buildGoodPage = () => `
                        <!doctype html>
                        <html lang="pt-BR">
                        <head>
                                <meta charset="utf-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1">
                                <title>Guia definitivo de SEO para iniciantes em web</title>
                                <meta name="description" content="Um guia completo com mais de cinquenta caracteres para passar na auditoria de meta description.">
                                <link rel="canonical" href="https://ex.com/guia">
                                <link rel="icon" href="/favicon.ico">
                                <meta property="og:title" content="Guia SEO">
                                <meta property="og:description" content="Guia completo">
                                <meta property="og:image" content="https://ex.com/cover.jpg">
                                <meta name="twitter:card" content="summary_large_image">
                                <script type="application/ld+json">{"@type":"Article"}</script>
                        </head>
                        <body>
                                <h1>Guia de SEO</h1>
                                <h2>Introdução</h2>
                                <p>${"conteúdo relevante ".repeat(200)}</p>
                                <img src="/a.png" alt="banner">
                        </body>
                        </html>
                `;

                it("scores a well-formed page high", () => {
                        const result = seoAudit(buildGoodPage(), "https://ex.com/guia");
                        expect(result.overall).toBeGreaterThanOrEqual(90);
                        expect(result.categories.length).toBe(5);
                        for (const category of result.categories) {
                                expect(category.score).toBeGreaterThanOrEqual(80);
                        }
                });

                it("scores a bare page low and reports the failures", () => {
                        const result = seoAudit("<html><body>oi</body></html>", "http://ex.com/");
                        expect(result.overall).toBeLessThan(50);
                        const failedTitles = result.categories.flatMap((c) =>
                                c.checks.filter((ch) => ch.status === "fail").map((ch) => ch.title),
                        );
                        expect(failedTitles).toContain("Título da página");
                        expect(failedTitles).toContain("HTTPS");
                        expect(failedTitles).toContain("Viewport móvel");
                });

                it("penalises noindex and multiple h1", () => {
                        const html = buildGoodPage().replace(
                                "<head>",
                                '<head><meta name="robots" content="noindex, nofollow">',
                        ).replace("<h1>Guia de SEO</h1>", "<h1>Um</h1><h1>Dois</h1>");
                        const result = seoAudit(html, "https://ex.com/");
                        const robots = result.categories
                                .flatMap((c) => c.checks)
                                .find((ch) => ch.title === "Meta robots");
                        const h1 = result.categories
                                .flatMap((c) => c.checks)
                                .find((ch) => ch.title === "Estrutura de títulos (h1)");
                        expect(robots.status).toBe("fail");
                        expect(h1.status).toBe("warn");
                });

                it("weights categories into the overall score", () => {
                        const result = seoAudit(buildGoodPage(), "https://ex.com/");
                        const weighted = result.categories.reduce(
                                (acc, c) => acc + c.score * c.weight,
                                0,
                        );
                        expect(result.overall).toBe(Math.round(weighted / 100));
                });
        });
        describe("extractTables", () => {
                it("extracts rows and decodes entities", () => {
                        const html = "<table><tr><th>Nome</th><th>Idade</th></tr><tr><td>Ana &amp; Jo\u00e3o</td><td>30</td></tr></table>";
                        const tables = extractTables(html);
                        expect(tables).toHaveLength(1);
                        expect(tables[0].header).toBe(true);
                        expect(tables[0].rows[0]).toEqual(["Nome", "Idade"]);
                        expect(tables[0].rows[1]).toEqual(["Ana & Jo\u00e3o", "30"]);
                });

                it("skips empty rows and respects the table cap", () => {
                        const many = Array.from({ length: 60 }, (_, i) => `<table><tr><td>t${i}</td></tr></table>`).join("");
                        expect(extractTables(many).length).toBe(40);
                        expect(extractTables("<table><tr><td></td><td></td></tr></table>")).toHaveLength(0);
                });
        });

        describe("tableToCsv", () => {
                it("quotes fields with commas, quotes and newlines", () => {
                        const csv = tableToCsv([["a", "b,c"], ['say "hi"'], ["line\nbreak"]]);
                        expect(csv).toBe('a,"b,c"\r\n"say ""hi"""\r\n"line\nbreak"');
                });
        });

        describe("extractLinks", () => {
                it("resolves hrefs, classifies and deduplicates", () => {
                        const html = '<a href="/sobre">Sobre</a><a href="https://ex.com/sobre">Sobre</a><a href="https://outro.ext/x">Ext</a><a href="#top">Topo</a>';
                        const result = extractLinks(html, "https://ex.com/");
                        expect(result.internal).toBe(1);
                        expect(result.external).toBe(1);
                        expect(result.links.map((l) => l.href)).toEqual([
                                "https://ex.com/sobre",
                                "https://outro.ext/x",
                        ]);
                        expect(result.links[0].text).toBe("Sobre");
                });
        });

        describe("buildReport", () => {
                it("builds a markdown report with url, seo and tables", () => {
                        const report = buildReport({
                                url: "https://ex.com/",
                                seo: { overall: 75, categories: [{ name: "Meta", score: 90, checks: [{ status: "pass", title: "title ok", detail: "present", tip: "" }] }] },
                                meta: { title: "Ex", openGraph: [] },
                                secrets: [{ masked: "AKIA…abcd", kind: "aws", line: 3 }],
                                endpoints: { apiPaths: [{ value: "/api/v1", line: 5 }] },
                                tables: [{ rows: [["h1", "h2"], ["a", "b"]], header: true }],
                                links: { links: [{ href: "https://ex.com/", text: "" }], internal: 1, external: 0, total: 1 },
                        });
                        expect(report).toContain("# Relat\u00f3rio de scraping");
                        expect(report).toContain("https://ex.com/");
                        expect(report).toContain("75/100");
                        expect(report).toContain("/api/v1");
                        expect(report).toContain("AKIA\u2026abcd");
                });
        });
});
