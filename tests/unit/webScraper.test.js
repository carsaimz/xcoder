import { describe, expect, it } from "vitest";
import {
        assetName,
        beautifyCode,
        classifyAsset,
        extractAssets,
        extractMeta,
        findEndpoints,
        findSecrets,
        guessLanguage,
        maskSecret,
        resolveUrl,
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
});
