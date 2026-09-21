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
        loremText,
        placeholderSnippet,
        sectionSnippet,
        shadowCSS,
        slugText,
        tableSnippet,
        timestampConvert,
        uuidIds,
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
});
