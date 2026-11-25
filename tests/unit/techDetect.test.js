import { describe, expect, it } from "vitest";
import {
	buildAnalyzerReport,
	detectTechnologies,
	embeddingPolicy,
	TECH_CATEGORY_ORDER,
} from "../../src/lib/techDetect";

describe("techDetect", () => {
	describe("detectTechnologies", () => {
		it("detects CDN and server signatures from response headers", () => {
			const techs = detectTechnologies({
				headers: {
					Server: "cloudflare",
					"CF-Ray": "8a1",
					"X-Powered-By": "PHP/8.2.1",
				},
				html: "",
			});
			const names = techs.map((t) => t.name);
			expect(names).toContain("Cloudflare");
			expect(names).toContain("PHP");
		});

		it("detects frameworks from HTML markers with evidence", () => {
			const html = `<html><head>
				<script src="/_next/static/chunks/main.js"></script>
				<script src="https://cdn.jsdelivr.net/npm/jquery.min.js"></script>
				<link href="https://fonts.googleapis.com/css2?family=Inter">
			</head><body data-reactroot><div class="woocommerce"></div></body></html>`;
			const techs = detectTechnologies({ html, headers: {} });
			const names = techs.map((t) => t.name);
			expect(names).toContain("Next.js");
			expect(names).toContain("React");
			expect(names).toContain("jQuery");
			expect(names).toContain("jsDelivr");
			expect(names).toContain("Google Fonts");
			expect(names).toContain("WooCommerce");

			const next = techs.find((t) => t.name === "Next.js");
			expect(next.evidence.length).toBeGreaterThan(0);
			expect(next.evidence[0]).toMatch(/^html:/);
		});

		it("keeps at most 3 evidence lines per technology", () => {
			const techs = detectTechnologies({
				html: "<div>wp-content wp-includes wp-content wp-includes wp-admin wp-content</div>",
			});
			const wp = techs.find((t) => t.name === "WordPress");
			expect(wp).toBeTruthy();
			expect(wp.evidence.length).toBeLessThanOrEqual(3);
		});

		it("derives runtime languages from infra signatures", () => {
			const techs = detectTechnologies({
				html: '<input name="csrfmiddlewaretoken" value="x">',
				headers: { Server: "gunicorn/20.1" },
			});
			const names = techs.map((t) => t.name);
			expect(names).toContain("Django");
			expect(names).toContain("Python");
		});

		it("reports Ruby on Rails via authenticity_token", () => {
			const techs = detectTechnologies({
				html: '<meta name="csrf-param" content="authenticity_token">',
			});
			const names = techs.map((t) => t.name);
			expect(names).toContain("Ruby on Rails");
			expect(names).toContain("Ruby");
		});

		it("returns an empty list for a plain page", () => {
			const techs = detectTechnologies({
				html: "<html><head><title>hi</title></head><body>hello</body></html>",
				headers: { "Content-Type": "text/html" },
			});
			expect(techs).toEqual([]);
		});

		it("survives missing page data", () => {
			expect(detectTechnologies()).toEqual([]);
			expect(detectTechnologies({})).toEqual([]);
		});
	});

	describe("embeddingPolicy", () => {
		it("blocks on X-Frame-Options deny and sameorigin", () => {
			expect(embeddingPolicy({ "x-frame-options": "DENY" }).blocked).toBe(true);
			expect(
				embeddingPolicy({ "x-frame-options": "SAMEORIGIN" }).blocked,
			).toBe(true);
		});

		it("blocks on restrictive CSP frame-ancestors", () => {
			expect(
				embeddingPolicy({
					"content-security-policy": "frame-ancestors 'self'",
				}).blocked,
			).toBe(true);
			expect(
				embeddingPolicy({
					"content-security-policy": "default-src 'self'; frame-ancestors 'none'",
				}).blocked,
			).toBe(true);
		});

		it("allows wildcard frame-ancestors and missing headers", () => {
			expect(
				embeddingPolicy({
					"content-security-policy": "frame-ancestors *",
				}).blocked,
			).toBe(false);
			expect(embeddingPolicy({}).blocked).toBe(false);
		});
	});

	describe("TECH_CATEGORY_ORDER", () => {
		it("renders languages and frameworks first", () => {
			expect(TECH_CATEGORY_ORDER[0]).toBe("language");
			expect(TECH_CATEGORY_ORDER[1]).toBe("framework");
			expect(TECH_CATEGORY_ORDER[TECH_CATEGORY_ORDER.length - 1]).toBe("other");
		});
	});

	describe("buildAnalyzerReport", () => {
		it("includes url, status, technologies and evidence", () => {
			const techs = detectTechnologies({
				html: '<script src="/_next/static/app.js"></script>',
				headers: { Server: "cloudflare" },
			});
			const report = buildAnalyzerReport(
				{
					url: "https://example.com",
					status: 200,
					elapsedMs: 820,
					sizeBytes: 10240,
					headers: { server: "cloudflare" },
					techs,
					meta: { Title: "Example" },
				},
				(key) => key,
			);
			expect(report).toContain("https://example.com");
			expect(report).toContain("200");
			expect(report).toContain("Next.js");
			expect(report).toContain("Cloudflare");
			expect(report).toContain("server: cloudflare");
			expect(report).toContain("Title: Example");
		});
	});
});
