import { describe, expect, it } from "vitest";

import {
        CARD_SHADOWS,
        cardSnippet,
        gradientCSS,
        placeholderSnippet,
        shadowCSS,
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
