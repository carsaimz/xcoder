import { describe, expect, it } from "vitest";

import {
        CARD_SHADOWS,
        base64Convert,
        boilerplateSnippet,
        cardSnippet,
        colorConvert,
        ctaSnippet,
        formatJson,
        formSnippet,
        gradientCSS,
        flexCSS,
        gridCSS,
        hashConvert,
        jwtDecode,
        loremText,
        placeholderSnippet,
        radiusCSS,
        regexTest,
        sectionSnippet,
        urlConvert,
        shadowCSS,
        slugText,
        tableSnippet,
        timestampConvert,
        uuidIds,
        wrapHtmlSnippet,
        isHtmlFile,
        easingCSS,
        convertUnits,
        caseConvert,
        entitiesConvert,
        csvConvert,
        toastSnippet,
        modalSnippet,
        tabsSnippet,
} from "../../src/lib/webdevTools";

describe("webdevTools generators", () => {
        describe("shadowCSS", () => {
                it("builds a box-shadow rule with all offsets", () => {
                        const css = shadowCSS({
                                x: 0,
                                y: 8,
                                blur: 24,
                                spread: -4,
                                color: "rgba(0, 0, 0, 0.45)",
                                inset: false,
                        });
                        expect(css).toContain("box-shadow: 0px 8px 24px -4px rgba(0, 0, 0, 0.45);");
                        expect(css).not.toContain("inset");
                });

                it("appends inset when requested", () => {
                        const css = shadowCSS({
                                x: 2,
                                y: 2,
                                blur: 4,
                                spread: 0,
                                color: "#000",
                                inset: true,
                        });
                        expect(css).toMatch(/box-shadow: 2px 2px 4px 0px #000 inset;/);
                });

                it("clamps extreme values", () => {
                        const css = shadowCSS({
                                x: 5000,
                                y: -5000,
                                blur: 9000,
                                spread: 9000,
                                color: "#000",
                                inset: false,
                        });
                        expect(css).toContain("box-shadow: 100px -100px 200px 100px");
                });
        });

        describe("gradientCSS", () => {
                it("builds a linear-gradient with angle and stops", () => {
                        const css = gradientCSS({
                                type: "linear",
                                angle: 135,
                                stops: [
                                        { color: "#7c3aed", at: 0 },
                                        { color: "#22d3ee", at: 100 },
                                ],
                        });
                        expect(css).toContain(
                                "linear-gradient(135deg, #7c3aed 0%, #22d3ee 100%)",
                        );
                });

                it("builds radial gradients without an angle", () => {
                        const css = gradientCSS({
                                type: "radial",
                                angle: 45,
                                stops: [
                                        { color: "#fff", at: 0 },
                                        { color: "#000", at: 100 },
                                ],
                        });
                        expect(css).toContain("radial-gradient(circle, #fff 0%, #000 100%)");
                });

                it("builds conic gradients from the angle", () => {
                        const css = gradientCSS({
                                type: "conic",
                                angle: 90,
                                stops: [
                                        { color: "#f00", at: 0 },
                                        { color: "#00f", at: 100 },
                                ],
                        });
                        expect(css).toContain("conic-gradient(from 90deg, #f00 0%, #00f 100%)");
                });

                it("sorts stops by position", () => {
                        const css = gradientCSS({
                                type: "linear",
                                angle: 0,
                                stops: [
                                        { color: "#b", at: 80 },
                                        { color: "#a", at: 20 },
                                ],
                        });
                        expect(css).toContain("#a 20%, #b 80%");
                });
        });

        describe("cardSnippet", () => {
                it("emits CSS + HTML for the card", () => {
                        const { html, css } = cardSnippet({
                                background: "#ffffff",
                                color: "#1f1f1f",
                                radius: 16,
                                padding: 24,
                                borderWidth: 0,
                                borderColor: "#e0e0e0",
                                shadow: "medium",
                                title: "Hello",
                                subtitle: "World",
                        });
                        expect(css).toContain("border-radius: 16px;");
                        expect(css).toContain("box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);");
                        expect(css).not.toContain("border: 0px");
                        expect(html).toContain("<h2>Hello</h2>");
                        expect(html).toContain("<p>World</p>");
                });

                it("includes the border only when wider than 0", () => {
                        const { css } = cardSnippet({
                                background: "#fff",
                                color: "#000",
                                radius: 0,
                                padding: 0,
                                borderWidth: 2,
                                borderColor: "#ff0000",
                                shadow: "none",
                                title: "t",
                                subtitle: "s",
                        });
                        expect(css).toContain("border: 2px solid #ff0000;");
                        expect(css).toContain("box-shadow: none;");
                });

                it("escapes HTML in titles", () => {
                        const { html } = cardSnippet({
                                background: "#fff",
                                color: "#000",
                                radius: 0,
                                padding: 0,
                                borderWidth: 0,
                                borderColor: "#000",
                                shadow: "none",
                                title: "<script>x</script>",
                                subtitle: "a&b",
                        });
                        expect(html).not.toContain("<script>");
                        expect(html).toContain("&lt;script&gt;");
                        expect(html).toContain("a&amp;b");
                });

                it("falls back to the medium shadow for unknown presets", () => {
                        const { css } = cardSnippet({
                                background: "#fff",
                                color: "#000",
                                radius: 4,
                                padding: 4,
                                borderWidth: 0,
                                borderColor: "#000",
                                shadow: "spooky",
                                title: "t",
                                subtitle: "s",
                        });
                        expect(css).toContain(CARD_SHADOWS.medium);
                });
        });

        describe("placeholderSnippet", () => {
                it("builds an SVG data URI with the size label", () => {
                        const { svg, dataUri, imgTag } = placeholderSnippet({
                                width: 640,
                                height: 360,
                                background: "#e2e8f0",
                                color: "#64748b",
                                text: "",
                        });
                        expect(svg).toContain('width="640"');
                        expect(svg).toContain('height="360"');
                        expect(svg).toContain("640 × 360");
                        expect(dataUri).toMatch(/^data:image\/svg\+xml,/);
                        expect(imgTag).toContain(`src="${dataUri}"`);
                        expect(imgTag).toContain('width="640"');
                });

                it("uses the custom label when provided", () => {
                        const { svg } = placeholderSnippet({
                                width: 100,
                                height: 100,
                                background: "#fff",
                                color: "#000",
                                text: "Hero image",
                        });
                        expect(svg).toContain("Hero image");
                });

                it("escapes markup injected through the label", () => {
                        const { svg, dataUri } = placeholderSnippet({
                                width: 100,
                                height: 100,
                                background: "#fff",
                                color: "#000",
                                text: '"><script>',
                        });
                        expect(svg).not.toContain('"><script>');
                        expect(decodeURIComponent(dataUri.replace("data:image/svg+xml,", ""))).not.toContain("<script>");
                });
        });
});

describe("ctaSnippet", () => {
        it("builds an anchor with escaped text and url", () => {
                const { html, css } = ctaSnippet({
                        text: "Começar <agora>",
                        url: "https://x.pt/?a=1&b=2",
                        background: "#7c3aed",
                        color: "#ffffff",
                        radius: 12,
                        paddingX: 32,
                        paddingY: 14,
                        fontSize: 17,
                        block: false,
                });
                expect(html).toContain('class="cta"');
                expect(html).toContain("Começar &lt;agora&gt;");
                expect(html).toContain('href="https://x.pt/?a=1&amp;b=2"');
                expect(css).toContain("display: inline-block;");
                expect(css).toContain("border-radius: 12px;");
                expect(css).toContain("padding: 14px 32px;");
        });

        it("block mode centers the label", () => {
                const { css } = ctaSnippet({ block: true });
                expect(css).toContain("display: block;");
                expect(css).toContain("text-align: center;");
        });
});

describe("sectionSnippet", () => {
        it("builds hero html with title, subtitle and button", () => {
                const { html, css } = sectionSnippet({
                        title: "Olá",
                        subtitle: "Bem-vindo ao site",
                        buttonText: "Saber mais",
                        buttonUrl: "#saber",
                        background: "#111111",
                        background2: "#333333",
                        gradient: true,
                        color: "#ffffff",
                        align: "center",
                        padding: 64,
                });
                expect(html).toContain('<section class="hero">');
                expect(html).toContain("<h1>Olá</h1>");
                expect(html).toContain('class="hero-btn" href="#saber"');
                expect(css).toContain(
                        "background: linear-gradient(135deg, #111111, #333333);",
                );
                expect(css).toContain("text-align: center;");
                expect(css).toContain(".hero-btn {");
        });

        it("solid background and no button when omitted", () => {
                const { html, css } = sectionSnippet({ gradient: false, buttonText: "" });
                expect(html).not.toContain("hero-btn");
                expect(css).toMatch(/background: #1e293b;/);
        });
});

describe("formSnippet", () => {
        it("always includes name+email and toggles optional fields", () => {
                const on = formSnippet({
                        title: "Fale connosco",
                        buttonText: "Enviar",
                        includePhone: true,
                        includeSubject: false,
                        includeMessage: true,
                });
                expect(on.html).toContain('id="name"');
                expect(on.html).toContain('type="text"');
                expect(on.html).toContain('type="email"');
                expect(on.html).toContain('type="tel"');
                expect(on.html).not.toContain('id="subject"');
                expect(on.html).toContain("<textarea");

                const off = formSnippet({ includeMessage: false, includePhone: false });
                expect(off.html).not.toContain("<textarea");
                expect(off.html).not.toContain('type="tel"');
        });
});

describe("tableSnippet", () => {
        it("generates the requested grid", () => {
                const { html } = tableSnippet({ columns: 2, rows: 3 });
                expect((html.match(/<th>/g) || []).length).toBe(2);
                expect((html.match(/<tr>/g) || []).length).toBe(4); // head + 3 rows
                expect(html).toContain("Item 3.2");
        });

        it("striped and bordered variants change the css", () => {
                const plain = tableSnippet({ columns: 2, rows: 2, striped: false, bordered: false });
                expect(plain.css).not.toContain("nth-child");
                expect(plain.css).not.toContain("border: 1px solid");
                const fancy = tableSnippet({ columns: 2, rows: 2, striped: true, bordered: true });
                expect(fancy.css).toContain("nth-child");
                expect(fancy.css).toContain("border: 1px solid");
        });
});

describe("boilerplateSnippet", () => {
        it("produces a complete html5 document", () => {
                const { html } = boilerplateSnippet({ title: "Minha página", lang: "pt" });
                expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
                expect(html).toContain('<html lang="pt">');
                expect(html).toContain("<title>Minha página</title>");
                expect(html).toContain('charset="UTF-8"');
                expect(html).toContain("viewport");
                expect(html).toContain("box-sizing: border-box;");
        });

        it("can omit the reset style", () => {
                const { html } = boilerplateSnippet({ reset: false });
                expect(html).not.toContain("<style>");
        });
});

describe("formatJson", () => {
        it("formats and minifies valid json", () => {
                const pretty = formatJson('{"a":1,"b":[2,3]}', "format", 2);
                expect(pretty.ok).toBe(true);
                expect(pretty.output).toBe('{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}');
                const mini = formatJson('{"a": 1}', "minify");
                expect(mini.output).toBe('{"a":1}');
        });

        it("reports parse errors without throwing", () => {
                const bad = formatJson("{a:1}", "format");
                expect(bad.ok).toBe(false);
                expect(bad.error).toContain("JSON");
        });
});

describe("base64Convert", () => {
        it("round-trips ascii and utf-8 text", () => {
                const encoded = base64Convert("XCoder", "encode");
                expect(encoded.ok).toBe(true);
                expect(encoded.output).toBe("WENvZGVy");
                const unicode = base64Convert("áéÍ çã", "encode");
                const decoded = base64Convert(unicode.output, "decode");
                expect(decoded.ok).toBe(true);
                expect(decoded.output).toBe("áéÍ çã");
        });

        it("rejects invalid base64 on decode", () => {
                const bad = base64Convert("!!!not-base64!!!", "decode");
                expect(bad.ok).toBe(false);
        });
});

describe("uuidIds", () => {
        it("generates unique rfc4122 v4 uuids", () => {
                const { uuids } = uuidIds(20);
                expect(uuids).toHaveLength(20);
                expect(new Set(uuids).size).toBe(20);
                for (const uuid of uuids) {
                        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
                }
        });

        it("clamps count and generates short ids in the alphabet", () => {
                const { shortIds } = uuidIds(999, 12);
                expect(shortIds).toHaveLength(50);
                for (const id of shortIds) {
                        expect(id).toHaveLength(12);
                        expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
                }
        });
});

describe("timestampConvert", () => {
        it("auto-detects unix seconds and milliseconds", () => {
                const seconds = timestampConvert("1700000000");
                expect(seconds.ok).toBe(true);
                expect(seconds.unixMs).toBe(1700000000000);
                const millis = timestampConvert("1700000000000");
                expect(millis.unixMs).toBe(1700000000000);
        });

        it("parses iso input and reports all notations", () => {
                const result = timestampConvert("2024-01-15T12:30:00.000Z", "iso");
                expect(result.ok).toBe(true);
                expect(result.iso).toBe("2024-01-15T12:30:00.000Z");
                expect(result.output).toContain("Unix (s):");
                expect(result.output).toContain("Local:");
        });

        it("rejects garbage input", () => {
                expect(timestampConvert("não é data").ok).toBe(false);
                expect(timestampConvert("").ok).toBe(false);
        });
});

describe("colorConvert", () => {
        it("converts hex to rgb and hsl", () => {
                const result = colorConvert("#7c3aed");
                expect(result.ok).toBe(true);
                expect(result.hex).toBe("#7c3aed");
                expect(result.rgb).toBe("rgb(124, 58, 237)");
                expect(result.output).toContain("HSL:");
        });

        it("accepts rgb() and hsl() inputs", () => {
                expect(colorConvert("rgb(124, 58, 237)").hex).toBe("#7c3aed");
                // integer-rounded hsl can drift by one step per channel on the
                // round trip — assert closeness, not exact equality
                const fromHsl = colorConvert("hsl(262, 83%, 58%)").hex;
                expect(Math.abs(Number.parseInt(fromHsl.slice(1, 3), 16) - 124)).toBeLessThanOrEqual(2);
                expect(Math.abs(Number.parseInt(fromHsl.slice(3, 5), 16) - 58)).toBeLessThanOrEqual(2);
                expect(Math.abs(Number.parseInt(fromHsl.slice(5, 7), 16) - 237)).toBeLessThanOrEqual(2);
        });

        it("reports invalid colors", () => {
                expect(colorConvert("não-é-cor").ok).toBe(false);
        });
});

describe("loremText", () => {
        it("is deterministic for a seed", () => {
                const a = loremText(2, 3, 7);
                const b = loremText(2, 3, 7);
                expect(a).toBe(b);
                expect(a.split("\n\n")).toHaveLength(2);
        });

        it("clamps paragraph and sentence counts", () => {
                const text = loremText(50, 99);
                expect(text.split("\n\n")).toHaveLength(10);
        });
});

describe("slugText", () => {
        it("strips accents and url-hostile characters", () => {
                expect(slugText("XCoder — editor de código!")).toBe("xcoder-editor-de-codigo");
                expect(slugText("  Olá, Mundo!  ")).toBe("ola-mundo");
        });

        it("returns an empty slug for empty input", () => {
                expect(slugText("")).toBe("");
        });

    describe("gridCSS", () => {
        it("builds an explicit grid template", () => {
            const css = gridCSS({
                columns: 3,
                rows: 2,
                columnGap: 16,
                rowGap: 16,
                minmax: false,
            });
            expect(css).toContain("display: grid;");
            expect(css).toContain("grid-template-columns: repeat(3, 1fr);");
            expect(css).toContain("grid-template-rows: repeat(2, auto);");
            expect(css).toContain("gap: 16px;");
        });

        it("omits rows when zero and splits unequal gaps", () => {
            const css = gridCSS({
                columns: 4,
                rows: 0,
                columnGap: 8,
                rowGap: 20,
                minmax: false,
            });
            expect(css).not.toContain("grid-template-rows");
            expect(css).toContain("column-gap: 8px;");
            expect(css).toContain("row-gap: 20px;");
        });

        it("uses auto-fill minmax when requested and clamps bounds", () => {
            const css = gridCSS({
                columns: 99,
                rows: -5,
                columnGap: 500,
                rowGap: 20,
                minmax: true,
            });
            expect(css).toContain("repeat(auto-fill, minmax(140px, 1fr))");
            expect(css).toContain("gap: 96px;");
        });
    });

    describe("regexTest", () => {
        it("lists matches with index and groups", () => {
            const result = regexTest(
                "\\w+@(\\w+)\\.(\\w+)",
                "g",
                "a@b.co and x@y.org",
            );
            expect(result.ok).toBe(true);
            expect(result.output).toContain("#1 @0:");
            expect(result.output).toContain("#2 @11:");
            expect(result.output).toContain("[1] b");
        });

        it("reports named groups and zero matches", () => {
            const named = regexTest("(?<year>\\d{4})", "g", "in 2026!");
            expect(named.ok).toBe(true);
            expect(named.output).toContain('"year":"2026"');

            const none = regexTest("z", "g", "abc");
            expect(none.ok).toBe(true);
            expect(none.output).toBe("(0 matches)");
        });

        it("surfaces invalid patterns as errors", () => {
            const result = regexTest("([", "g", "abc");
            expect(result.ok).toBe(false);
            expect(result.error).toBeTruthy();
        });
    });

    describe("urlConvert", () => {
        it("encodes and decodes UTF-8 components", () => {
            expect(urlConvert("a b&c=d", "encode").output).toBe(
                "a%20b%26c%3Dd",
            );
            expect(urlConvert("a%20b", "decode").output).toBe("a b");
        });

        it("dissects query params and hash", () => {
            const result = urlConvert(
                "https://xcoder.app/docs?q=editor&lang=pt#top",
                "params",
            );
            expect(result.ok).toBe(true);
            expect(result.output).toContain("q = editor");
            expect(result.output).toContain("lang = pt");
            expect(result.output).toContain("#hash = top");
        });

        it("tolerates bare query strings", () => {
            const result = urlConvert("a=1&b=2", "params");
            expect(result.ok).toBe(true);
            expect(result.output).toContain("a = 1");
        });
    });

    describe("hashConvert", () => {
        it("produces the SHA-256 hex digest", async () => {
            const digest = await hashConvert("XCoder", "SHA-256");
            expect(digest).toMatch(/^[0-9a-f]{64}$/);
        });

        it("rejects when Web Crypto is unavailable", async () => {
            const original = globalThis.crypto;
            Object.defineProperty(globalThis, "crypto", {
                value: {},
                configurable: true,
            });
            try {
                await expect(hashConvert("x")).rejects.toThrow(/Web Crypto/);
            } finally {
                Object.defineProperty(globalThis, "crypto", {
                    value: original,
                    configurable: true,
                });
            }
        });
    });

    describe("jwtDecode", () => {
        const b64url = (obj) =>
            Buffer.from(JSON.stringify(obj)).toString("base64url");

        it("decodes header and payload with expiry state", () => {
            const token = [
                b64url({ alg: "HS256", typ: "JWT" }),
                b64url({ sub: "1", exp: Math.floor(Date.now() / 1000) + 3600 }),
                "sig",
            ].join(".");
            const result = jwtDecode(token);
            expect(result.ok).toBe(true);
            expect(result.output).toContain('"alg": "HS256"');
            expect(result.output).toContain('"sub": "1"');
            expect(result.output).toContain("✓ valid");
        });

        it("flags expired tokens and rejects garbage", () => {
            const expired = [
                b64url({ alg: "none" }),
                b64url({ exp: 1000 }),
            ].join(".");
            expect(jwtDecode(expired).output).toContain("⚠ EXPIRED");
            expect(jwtDecode("not-a-jwt").ok).toBe(false);
        });
    });

    describe("flexCSS", () => {
        it("builds the container rule from state", () => {
            const css = flexCSS({
                direction: "column",
                justify: "space-between",
                align: "center",
                wrap: "wrap",
                gap: 16,
            });
            expect(css).toContain("display: flex;");
            expect(css).toContain("flex-direction: column;");
            expect(css).toContain("justify-content: space-between;");
            expect(css).toContain("align-items: center;");
            expect(css).toContain("flex-wrap: wrap;");
            expect(css).toContain("gap: 16px;");
        });
    });

    describe("radiusCSS", () => {
        it("emits four corner values when they differ", () => {
            const css = radiusCSS({ tl: 24, tr: 8, br: 24, bl: 8 });
            expect(css).toContain("border-radius: 24px 8px 24px 8px;");
        });

        it("collapses to one value when all corners match", () => {
            const css = radiusCSS({ tl: 16, tr: 16, br: 16, bl: 16 });
            expect(css).toContain("border-radius: 16px;");
        });

        it("clamps out-of-range corners", () => {
            const css = radiusCSS({ tl: -10, tr: 500, br: 0, bl: 0 });
            expect(css).toContain("border-radius: 0px 100px 0px 0px;");
        });
    });
});

describe("wrapHtmlSnippet", () => {
    it("wraps the css part in <style> and keeps html bare", () => {
        const out = wrapHtmlSnippet({
            css: ".a { color: red; }",
            html: "<p>hi</p>",
        });
        expect(out).toContain("<style>\n.a { color: red; }\n</style>");
        expect(out).toContain("<p>hi</p>");
        expect(out).not.toContain("<script");
    });

    it("wraps the js part in <script>", () => {
        const out = wrapHtmlSnippet({
            html: "<div></div>",
            js: "console.log(1);",
        });
        expect(out).toContain("<script>\nconsole.log(1);\n</script>");
        expect(out).not.toContain("<style");
    });

    it("orders style → html → script", () => {
        const out = wrapHtmlSnippet({
            js: "x();",
            css: ".b {}",
            html: "<i>k</i>",
        });
        const styleAt = out.indexOf("<style>");
        const htmlAt = out.indexOf("<i>k</i>");
        const scriptAt = out.indexOf("<script>");
        expect(styleAt).toBeGreaterThanOrEqual(0);
        expect(styleAt).toBeLessThan(htmlAt);
        expect(htmlAt).toBeLessThan(scriptAt);
    });

    it("skips empty parts and trims leftovers", () => {
        expect(wrapHtmlSnippet({ css: "", html: "  <br>  " })).toBe("<br>");
        expect(wrapHtmlSnippet()).toBe("");
        expect(wrapHtmlSnippet(null)).toBe("");
    });
});

describe("isHtmlFile", () => {
    it("detects html targets for insert wrapping", () => {
        expect(isHtmlFile("index.html")).toBe(true);
        expect(isHtmlFile("PAGE.HTM")).toBe(true);
        expect(isHtmlFile("App.vue")).toBe(true);
        expect(isHtmlFile("Comp.svelte")).toBe(true);
        expect(isHtmlFile("styles.css")).toBe(false);
        expect(isHtmlFile("app.js")).toBe(false);
        expect(isHtmlFile("")).toBe(false);
        expect(isHtmlFile(null)).toBe(false);
    });
});

describe("easingCSS", () => {
    it("clamps x into 0..1 and keeps y overshoot", () => {
        const css = easingCSS({ x1: 0.68, y1: -0.55, x2: 0.265, y2: 1.55 });
        expect(css).toContain(
            "cubic-bezier(0.68, -0.55, 0.27, 1.55)",
        );
    });

    it("defaults to the ease-in-out curve", () => {
        expect(easingCSS({})).toContain("cubic-bezier(0.42, 0.00, 1.00, 1.00)");
    });
});

describe("convertUnits", () => {
    it("converts px to rem/em against the root size", () => {
        expect(convertUnits({ value: "24", from: "px", root: 16 }).output).toBe(
            "24px\n1.5rem\n1.5em",
        );
    });

    it("converts rem to px", () => {
        expect(convertUnits({ value: "1.5", from: "rem", root: 16 }).output).toBe(
            "24px\n1.5rem\n1.5em",
        );
    });

    it("rejects bad numbers", () => {
        expect(convertUnits({ value: "abc", from: "px" }).ok).toBe(false);
        expect(convertUnits({ value: 10, from: "px", root: 0 }).ok).toBe(false);
    });
});

describe("caseConvert", () => {
    it("splits camel/kebab/snake input into words", () => {
        expect(caseConvert("meu novo ProjetoDAO", "camel").output).toBe(
            "meuNovoProjetoDao",
        );
        expect(caseConvert("meu-novo-projeto", "constant").output).toBe(
            "MEU_NOVO_PROJETO",
        );
        expect(caseConvert("AppUser name", "snake").output).toBe("app_user_name");
    });

    it("errors on empty text", () => {
        expect(caseConvert("", "camel").ok).toBe(false);
    });
});

describe("entitiesConvert", () => {
    it("escapes the dangerous five", () => {
        expect(entitiesConvert('a & b <c> "d" \'e\'', "escape").output).toBe(
            "a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39;",
        );
    });

    it("round-trips named and numeric entities", () => {
        const escaped = entitiesConvert("© … — A", "escape").output;
        expect(entitiesConvert(escaped, "unescape").output).toBe("© … — A");
        expect(entitiesConvert("&#169; &#x2026;", "unescape").output).toBe("© …");
    });
});

describe("csvConvert", () => {
    it("parses CSV into an array of objects", () => {
        const result = csvConvert("nome,idade\nAna,30\nBruno,25", "csv2json");
        expect(result.ok).toBe(true);
        expect(JSON.parse(result.output)).toEqual([
            { nome: "Ana", idade: "30" },
            { nome: "Bruno", idade: "25" },
        ]);
    });

    it("honors quoted fields with embedded delimiters", () => {
        const result = csvConvert('a,b\n"x,y",2', "csv2json");
        expect(JSON.parse(result.output)[0].a).toBe("x,y");
    });

    it("converts JSON rows back to CSV and quotes when needed", () => {
        const result = csvConvert(
            JSON.stringify([{ a: "x,y", b: 2 }]),
            "json2csv",
        );
        expect(result.output).toBe('a,b\n"x,y",2');
    });

    it("rejects non-array JSON and short CSV", () => {
        expect(csvConvert("just,header", "csv2json").ok).toBe(false);
        expect(csvConvert('{"a":1}', "json2csv").ok).toBe(false);
        expect(csvConvert("", "csv2json").ok).toBe(false);
    });
});

describe("component snippets", () => {
    it("toastSnippet builds html/css/js that wrap into one snippet", () => {
        const parts = toastSnippet({ position: "top-center" });
        expect(parts.html).toContain('class="xc-toast"');
        expect(parts.css).toContain("top: 16px;");
        expect(parts.css).toContain("left: 50%;");
        expect(parts.js).toContain("showToast");
        const wrapped = wrapHtmlSnippet(parts);
        expect(wrapped.indexOf("<style>")).toBeLessThan(
            wrapped.indexOf("<script>"),
        );
    });

    it("modalSnippet toggles overlay-close behavior", () => {
        const withOverlay = modalSnippet({ overlayClose: true });
        const without = modalSnippet({ overlayClose: false });
        expect(withOverlay.js).toContain("event.target === overlay");
        expect(without.js).not.toContain("event.target === overlay");
        expect(withOverlay.html).toContain("data-overlay-close");
    });

    it("tabsSnippet renders one button and panel per label", () => {
        const parts = tabsSnippet({ labels: "Um, Dois, Três", style: "pills" });
        expect(parts.html.match(/class="xc-tab( |")/g)).toHaveLength(3);
        expect(parts.html.match(/xc-tab-panel\b/g)).toHaveLength(3);
        expect(parts.css).toContain("border-radius: 999px;");
        expect(parts.js).toContain("classList.toggle('active'");
    });
});
