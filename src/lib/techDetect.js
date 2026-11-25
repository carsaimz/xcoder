/**
 * Tech stack detection engine — the Site Analyzer's brain (Wappalyzer-like
 * fingerprinting, but local and offline): signature table + header/html
 * matching + language inference + plain-text report builder.
 *
 * Every signature is factual: a match ALWAYS lists the exact evidence that
 * triggered it (header line or HTML snippet), so users learn WHERE the
 * detection came from instead of trusting a magic black box.
 */

/**
 * Signature types:
 *  - h: tested against each response header as "name: value" (name lower)
 *  - x: tested against the full HTML source (case-insensitive regex)
 * Categories are i18n keys rendered by the analyzer UI.
 * @typedef {{n: string, c: string, h?: RegExp[], x?: RegExp[], site?: string}} Signature
 */

/** @type {Signature[]} */
const DB = [
	// ---- CDN / infrastructure ------------------------------------------------
	{
		n: "Cloudflare",
		c: "cdn",
		h: [/^server:\s*cloudflare/i, /^cf-ray:/i, /^cf-cache-status:/i],
		site: "https://www.cloudflare.com",
	},
	{
		n: "Fastly",
		c: "cdn",
		h: [/^server:\s*fastly/i, /^via:\s*.*fastly/i],
		site: "https://www.fastly.com",
	},
	{
		n: "Akamai",
		c: "cdn",
		h: [/^server:\s*akamai/i, /^x-akamai/i],
		site: "https://www.akamai.com",
	},
	{
		n: "Vercel",
		c: "cdn",
		h: [/^server:\s*vercel/i, /^x-vercel-id:/i, /^x-vercel-cache:/i],
		site: "https://vercel.com",
	},
	{
		n: "Netlify",
		c: "cdn",
		h: [/^server:\s*netlify/i, /^x-nf-request-id:/i],
		site: "https://www.netlify.com",
	},
	{
		n: "GitHub Pages",
		c: "cdn",
		h: [/^server:\s*github/i, /^x-github-request-id:/i],
		site: "https://pages.github.com",
	},
	{
		n: "Amazon CloudFront",
		c: "cdn",
		h: [/^x-amz-cf-id:/i, /^via:\s*.*cloudfront/i],
		site: "https://aws.amazon.com/cloudfront",
	},
	{
		n: "Amazon S3",
		c: "cdn",
		h: [/^server:\s*amazons3/i, /^x-amz-request-id:/i],
		site: "https://aws.amazon.com/s3",
	},
	{
		n: "Google Cloud",
		c: "cdn",
		h: [/^server:\s*.*google frontend/i, /^x-guploader-uploadid:/i],
		site: "https://cloud.google.com",
	},
	{
		n: "Heroku",
		c: "cdn",
		h: [/^via:\s*.*heroku/i],
		site: "https://www.heroku.com",
	},
	{ n: "Fly.io", c: "cdn", h: [/^fly-request-id:/i], site: "https://fly.io" },
	{
		n: "Microsoft Azure",
		c: "cdn",
		h: [/^x-azure-ref:/i],
		site: "https://azure.microsoft.com",
	},
	{
		n: "DigitalOcean",
		c: "cdn",
		h: [/^server:\s*digitalocean/i, /^x-do-app-origin:/i],
		site: "https://www.digitalocean.com",
	},
	{
		n: "jsDelivr",
		c: "cdn",
		x: [/cdn\.jsdelivr\.net/],
		site: "https://www.jsdelivr.com",
	},
	{
		n: "cdnjs",
		c: "cdn",
		x: [/cdnjs\.cloudflare\.com/],
		site: "https://cdnjs.com",
	},
	{ n: "unpkg", c: "cdn", x: [/unpkg\.com/], site: "https://unpkg.com" },
	{
		n: "Google Hosted Libraries",
		c: "cdn",
		x: [/ajax\.googleapis\.com/],
		site: "https://developers.google.com/speed/libraries",
	},

	// ---- web servers ----------------------------------------------------------
	{ n: "nginx", c: "server", h: [/^server:\s*.*nginx/i] },
	{ n: "Apache", c: "server", h: [/^server:\s*.*apache/i] },
	{ n: "LiteSpeed", c: "server", h: [/^server:\s*litespeed/i] },
	{ n: "OpenResty", c: "server", h: [/^server:\s*openresty/i] },
	{ n: "Caddy", c: "server", h: [/^server:\s*caddy/i] },
	{ n: "Envoy", c: "server", h: [/^server:\s*envoy/i] },
	{ n: "lighttpd", c: "server", h: [/^server:\s*lighttpd/i] },
	{ n: "Microsoft IIS", c: "server", h: [/^server:\s*microsoft-iis/i] },
	{
		n: "Apache Tomcat",
		c: "server",
		h: [/^server:\s*tomcat/i, /^server:\s*apache-coyote/i],
	},
	{ n: "Jetty", c: "server", h: [/^server:\s*jetty/i] },
	{ n: "GlassFish", c: "server", h: [/^server:\s*glassfish/i] },
	{
		n: "WildFly / JBoss",
		c: "server",
		h: [/^server:\s*wildfly/i, /^server:\s*jboss/i],
	},
	{ n: "Gunicorn", c: "server", h: [/^server:\s*gunicorn/i] },
	{ n: "Werkzeug (Flask dev)", c: "server", h: [/^server:\s*werkzeug/i] },
	{ n: "Cowboy (Elixir)", c: "server", h: [/^server:\s*cowboy/i] },

	// ---- languages ------------------------------------------------------------
	{
		n: "PHP",
		c: "language",
		h: [/^x-powered-by:\s*php/i],
		x: [/PHPSESSID/, /\.php["'?]/],
	},
	{
		n: "ASP.NET",
		c: "language",
		h: [/^x-powered-by:\s*asp\.net/i, /^x-aspnet-version:/i],
		x: [/__VIEWSTATE/],
	},
	{ n: "ASP.NET MVC", c: "language", h: [/^x-aspnetmvc-version:/i] },
	{ n: "Ruby on Rails", c: "language", x: [/authenticity_token/] },
	{
		n: "Django",
		c: "language",
		x: [/csrfmiddlewaretoken/],
		site: "https://www.djangoproject.com",
	},
	{ n: "Express (Node.js)", c: "language", h: [/^x-powered-by:\s*express/i] },

	// ---- frameworks / meta-frameworks ----------------------------------------
	{
		n: "Next.js",
		c: "framework",
		h: [/^x-nextjs-/i],
		x: [/\/_next\/static/, /__NEXT_DATA__/],
		site: "https://nextjs.org",
	},
	{
		n: "Nuxt",
		c: "framework",
		x: [/__NUXT__/, /\/_nuxt\//],
		site: "https://nuxt.com",
	},
	{
		n: "React",
		c: "framework",
		x: [/data-reactroot/, /react(-dom)?[-.][\w.-]*\.js/, /\breact\//],
		site: "https://react.dev",
	},
	{
		n: "Vue.js",
		c: "framework",
		x: [/data-v-app/, /vue(\.runtime)?(\.global)?(\.prod)?(\.min)?\.js/],
		site: "https://vuejs.org",
	},
	{
		n: "Angular",
		c: "framework",
		x: [/ng-version=/, /zone(\.min)?\.js/, /@angular\//],
		site: "https://angular.dev",
	},
	{
		n: "SvelteKit",
		c: "framework",
		x: [/__sveltekit/, /\/_app\/immutable\//],
		site: "https://svelte.dev/docs/kit",
	},
	{
		n: "Astro",
		c: "framework",
		x: [/astro-island/, /data-astro-cid/, /\/astro\//],
		site: "https://astro.build",
	},
	{
		n: "Remix",
		c: "framework",
		x: [/__remixContext/],
		site: "https://remix.run",
	},
	{
		n: "Gatsby",
		c: "framework",
		x: [/___gatsby/, /gatsby-/],
		site: "https://www.gatsbyjs.com",
	},
	{ n: "Preact", c: "framework", x: [/preact/], site: "https://preactjs.com" },
	{
		n: "Alpine.js",
		c: "framework",
		x: [/<[^>]+\sx-data=/i, /alpinejs?(\.min)?\.js/],
		site: "https://alpinejs.dev",
	},
	{
		n: "htmx",
		c: "framework",
		x: [/htmx(\.min)?\.js/, /hx-(get|post)=/],
		site: "https://htmx.org",
	},
	{
		n: "Laravel Livewire",
		c: "framework",
		x: [/wire:id=/, /livewire(\.min)?\.js/],
		site: "https://livewire.laravel.com",
	},

	// ---- front-end libraries --------------------------------------------------
	{
		n: "jQuery",
		c: "js",
		x: [/jquery[-.][\w.-]*(\.min)?\.js/, /\/jquery\//],
		site: "https://jquery.com",
	},
	{
		n: "Bootstrap",
		c: "js",
		x: [/bootstrap(\.bundle)?(\.min)?\.(js|css)/],
		site: "https://getbootstrap.com",
	},
	{
		n: "Tailwind CSS",
		c: "js",
		x: [/cdn\.tailwindcss\.com/, /tailwind(\.min)?\.css/],
		site: "https://tailwindcss.com",
	},
	{
		n: "Swiper",
		c: "js",
		x: [/swiper(-bundle)?(\.min)?\.(js|css)/],
		site: "https://swiperjs.com",
	},
	{
		n: "GSAP",
		c: "js",
		x: [/gsap(\.min)?\.js/, /TweenMax/],
		site: "https://gsap.com",
	},
	{
		n: "Three.js",
		c: "js",
		x: [/three(\.min)?\.js/, /THREE\./],
		site: "https://threejs.org",
	},
	{
		n: "Chart.js",
		c: "js",
		x: [/chart(\.min)?\.js/, /chartjs/],
		site: "https://www.chartjs.org",
	},
	{
		n: "Lodash",
		c: "js",
		x: [/lodash(\.min)?\.js/],
		site: "https://lodash.com",
	},
	{
		n: "Moment.js",
		c: "js",
		x: [/moment(\.with-locales)?(\.min)?\.js/],
		site: "https://momentjs.com",
	},
	{
		n: "Day.js",
		c: "js",
		x: [/dayjs(\.min)?\.js/],
		site: "https://day.js.org",
	},
	{
		n: "Axios",
		c: "js",
		x: [/axios(\.min)?\.js/],
		site: "https://axios-http.com",
	},
	{
		n: "Leaflet",
		c: "js",
		x: [/leaflet(\.min)?\.(js|css)/],
		site: "https://leafletjs.com",
	},
	{ n: "Webpack", c: "js", x: [/webpackJsonp/, /webpack-[\w]+\./] },

	// ---- CMS / site builders --------------------------------------------------
	{
		n: "WordPress",
		c: "cms",
		x: [/wp-content/, /wp-includes/],
		site: "https://wordpress.org",
	},
	{
		n: "WooCommerce",
		c: "ecommerce",
		x: [/woocommerce/],
		site: "https://woocommerce.com",
	},
	{
		n: "Shopify",
		c: "ecommerce",
		x: [/cdn\.shopify\.com/, /Shopify\.theme/],
		site: "https://www.shopify.com",
	},
	{ n: "Magento", c: "ecommerce", x: [/magento/, /static\/version\d+/] },
	{ n: "PrestaShop", c: "ecommerce", x: [/prestashop/] },
	{ n: "Elementor", c: "cms", x: [/elementor/] },
	{
		n: "Divi",
		c: "cms",
		x: [/et_pb_/, /et-divi/],
		site: "https://www.elegantthemes.com/gallery/divi",
	},
	{
		n: "Wix",
		c: "cms",
		x: [/static\.parastorage/, /wixstatic/, /data-wix/],
		site: "https://www.wix.com",
	},
	{
		n: "Squarespace",
		c: "cms",
		x: [/squarespace/],
		site: "https://www.squarespace.com",
	},
	{
		n: "Webflow",
		c: "cms",
		x: [/webflow(\.js|\.css)?/, /data-wf-page/],
		site: "https://webflow.com",
	},
	{
		n: "Joomla",
		c: "cms",
		x: [/generator[^>]*joomla/i, /\/media\/jui\//],
		site: "https://www.joomla.org",
	},
	{
		n: "Drupal",
		c: "cms",
		x: [/drupal\.js/, /drupal\.settings/, /\/sites\/default\/files\//],
		site: "https://www.drupal.org",
	},
	{
		n: "Ghost",
		c: "cms",
		x: [/generator[^>]*ghost/i, /ghost(\.min)?\.js/],
		site: "https://ghost.org",
	},
	{ n: "Blogger", c: "cms", x: [/blogger\.com/, /blogspot\.com/] },
	{
		n: "MediaWiki",
		c: "cms",
		x: [/generator[^>]*mediawiki/i, /wgPageName/],
		site: "https://www.mediawiki.org",
	},
	{ n: "phpBB", c: "cms", x: [/phpbb/] },
	{
		n: "Discourse",
		c: "cms",
		x: [/generator[^>]*discourse/i],
		site: "https://www.discourse.org",
	},
	{ n: "TYPO3", c: "cms", x: [/typo3/] },

	// ---- fonts ----------------------------------------------------------------
	{
		n: "Google Fonts",
		c: "fonts",
		x: [/fonts\.googleapis\.com/],
		site: "https://fonts.google.com",
	},
	{
		n: "Adobe Fonts",
		c: "fonts",
		x: [/use\.typekit\.(net|com)/],
		site: "https://fonts.adobe.com",
	},
	{ n: "Font Awesome", c: "fonts", x: [/font-?awesome/] },
	{
		n: "Material Icons",
		c: "fonts",
		x: [/material[-_]icons/, /Material\+Icons/],
	},
	{
		n: "Google Material Web",
		c: "fonts",
		x: [/fonts\.googleapis\.com\/icon/],
		site: "https://fonts.google.com/icons",
	},

	// ---- analytics / ads ------------------------------------------------------
	{
		n: "Google Analytics",
		c: "analytics",
		x: [
			/googletagmanager\.com\/gtag\/js/,
			/google-analytics\.com/,
			/gtag\/js\?id=/,
		],
		site: "https://analytics.google.com",
	},
	{
		n: "Google Tag Manager",
		c: "analytics",
		x: [/googletagmanager\.com\/gtm\.js/, /GTM-[A-Z0-9]+/],
	},
	{
		n: "Google AdSense",
		c: "analytics",
		x: [/adsbygoogle/, /pagead2\.googlesyndication/],
	},
	{
		n: "Facebook Pixel",
		c: "analytics",
		x: [/fbevents\.js/, /connect\.facebook\.net/],
	},
	{ n: "Hotjar", c: "analytics", x: [/hotjar/] },
	{
		n: "Microsoft Clarity",
		c: "analytics",
		x: [/clarity\.ms/],
		site: "https://clarity.microsoft.com",
	},
	{
		n: "Plausible",
		c: "analytics",
		x: [/plausible\.io/],
		site: "https://plausible.io",
	},
	{ n: "Umami", c: "analytics", x: [/umami(\.is)?\//] },
	{ n: "Matomo", c: "analytics", x: [/matomo/, /piwik/] },
	{ n: "Cloudflare Insights", c: "analytics", x: [/cloudflareinsights/] },
	{ n: "Yandex Metrica", c: "analytics", x: [/mc\.yandex/] },
	{ n: "Segment", c: "analytics", x: [/cdn\.segment\.com/] },
	{ n: "Amplitude", c: "analytics", x: [/amplitude/] },
	{ n: "Mixpanel", c: "analytics", x: [/mixpanel/] },

	// ---- security / consent ---------------------------------------------------
	{
		n: "reCAPTCHA",
		c: "security",
		x: [/recaptcha/],
		site: "https://www.google.com/recaptcha",
	},
	{
		n: "hCaptcha",
		c: "security",
		x: [/hcaptcha/],
		site: "https://www.hcaptcha.com",
	},
	{
		n: "Cloudflare Turnstile",
		c: "security",
		x: [/challenges\.cloudflare\.com\/turnstile/],
	},
	{
		n: "Cloudflare Email Protection",
		c: "security",
		x: [/\/cdn-cgi\/l\/email-protection/],
	},

	// ---- payments -------------------------------------------------------------
	{
		n: "Stripe",
		c: "ecommerce",
		x: [/js\.stripe\.com/],
		site: "https://stripe.com",
	},
	{ n: "PayPal", c: "ecommerce", x: [/paypalobjects/, /paypal\.com\/sdk/] },
	{ n: "Mercado Pago", c: "ecommerce", x: [/mercadopago/] },

	// ---- embeds / widgets -----------------------------------------------------
	{
		n: "YouTube embed",
		c: "embed",
		x: [/youtube\.com\/embed/, /youtube-nocookie/],
	},
	{ n: "Vimeo", c: "embed", x: [/player\.vimeo/] },
	{
		n: "Google Maps",
		c: "embed",
		x: [/google\.com\/maps/, /maps\.googleapis/],
	},
	{ n: "Mapbox", c: "embed", x: [/mapbox/] },
	{ n: "Intercom", c: "embed", x: [/intercom/] },
	{ n: "Crisp Chat", c: "embed", x: [/crisp\.chat/] },
	{ n: "Tawk.to", c: "embed", x: [/tawk\.to/] },
	{ n: "Calendly", c: "embed", x: [/calendly/] },
	{ n: "WhatsApp widget", c: "embed", x: [/wa\.me/, /api\.whatsapp\.com/] },

	// ---- static site generators ----------------------------------------------
	{
		n: "Hugo",
		c: "ssg",
		x: [/generator[^>]*hugo/i],
		site: "https://gohugo.io",
	},
	{
		n: "Jekyll",
		c: "ssg",
		x: [/generator[^>]*jekyll/i],
		site: "https://jekyllrb.com",
	},
	{
		n: "Docusaurus",
		c: "ssg",
		x: [/docusaurus/],
		site: "https://docusaurus.io",
	},
	{ n: "Sphinx", c: "ssg", x: [/generator[^>]*sphinx/i] },
	{ n: "MkDocs", c: "ssg", x: [/mkdocs/] },
	{ n: "GitBook", c: "ssg", x: [/gitbook/] },
	{
		n: "Eleventy",
		c: "ssg",
		x: [/generator[^>]*eleventy/i],
		site: "https://www.11ty.dev",
	},
	{ n: "VuePress", c: "ssg", x: [/vuepress/] },
	{ n: "VitePress", c: "ssg", x: [/vitepress/] },
	{ n: "Hexo", c: "ssg", x: [/generator[^>]*hexo/i] },

	// ---- other page features --------------------------------------------------
	{
		n: "PWA (manifest/SW)",
		c: "other",
		x: [/<link[^>]+rel=["']manifest/, /navigator\.serviceWorker/],
		site: "https://developer.mozilla.org/docs/Web/Progressive_web_apps",
	},
	{ n: "AMP", c: "other", x: [/<html[^>]+(\bamp\b|⚡)/i] },
	{ n: "RSS feed", c: "other", x: [/application\/rss\+xml/] },
	{ n: "Open Graph", c: "other", x: [/property=["']og:/] },
	{ n: "Twitter Card", c: "other", x: [/name=["']twitter:card/] },
];

/**
 * Derived languages: when an infra/framework signature matched, the runtime
 * language behind it is reported too (same evidence, honest derivation).
 */
const DERIVED_LANGUAGES = [
	{
		when: "Express (Node.js)",
		n: "Node.js",
		c: "language",
		site: "https://nodejs.org",
	},
	{
		when: "ASP.NET",
		n: "C#",
		c: "language",
		site: "https://dotnet.microsoft.com/languages/csharp",
	},
	{
		when: "ASP.NET MVC",
		n: "C#",
		c: "language",
		site: "https://dotnet.microsoft.com/languages/csharp",
	},
	{ when: "Apache Tomcat", n: "Java", c: "language", site: "https://dev.java" },
	{ when: "Jetty", n: "Java", c: "language", site: "https://dev.java" },
	{ when: "GlassFish", n: "Java", c: "language", site: "https://dev.java" },
	{
		when: "WildFly / JBoss",
		n: "Java",
		c: "language",
		site: "https://dev.java",
	},
	{
		when: "Django",
		n: "Python",
		c: "language",
		site: "https://www.python.org",
	},
	{
		when: "Gunicorn",
		n: "Python",
		c: "language",
		site: "https://www.python.org",
	},
	{
		when: "Werkzeug (Flask dev)",
		n: "Python",
		c: "language",
		site: "https://www.python.org",
	},
	{
		when: "Ruby on Rails",
		n: "Ruby",
		c: "language",
		site: "https://www.ruby-lang.org",
	},
	{
		when: "Cowboy (Elixir)",
		n: "Elixir",
		c: "language",
		site: "https://elixir-lang.org",
	},
];

/** Order in which result groups render (category id). */
export const TECH_CATEGORY_ORDER = [
	"language",
	"framework",
	"js",
	"cms",
	"ecommerce",
	"ssg",
	"server",
	"cdn",
	"analytics",
	"security",
	"fonts",
	"embed",
	"other",
];

/**
 * Extracts a compact evidence snippet around the first regex match in html.
 * @param {string} html
 * @param {RegExp} re
 * @returns {string|null}
 */
function htmlEvidence(html, re) {
	const match = re.exec(html);
	if (!match) return null;
	const idx = match.index ?? 0;
	const start = Math.max(0, idx - 24);
	const raw = html.slice(start, idx + 72);
	return `html: ${raw.replace(/\s+/g, " ").trim()}`;
}

/**
 * Detects technologies from a fetched page (headers + html).
 * @param {{html?: string, headers?: Record<string, string>, url?: string}} page
 * @returns {Array<{name: string, category: string, site?: string, evidence: string[]}>}
 */
export function detectTechnologies(page = {}) {
	const html = typeof page.html === "string" ? page.html : "";
	const headers =
		page.headers && typeof page.headers === "object" ? page.headers : {};
	const headerLines = Object.entries(headers).map(
		([key, value]) => `${key}: ${value}`,
	);

	/** @type {Array<{name: string, category: string, site?: string, evidence: string[]}>} */
	const found = [];
	/** @type {Map<string, {name: string, category: string, site?: string, evidence: string[]}>} */
	const byName = new Map();

	const add = (name, category, site, evidence) => {
		const existing = byName.get(name);
		if (existing) {
			if (evidence && !existing.evidence.includes(evidence)) {
				existing.evidence.push(evidence);
			}
			return;
		}
		const entry = {
			name,
			category,
			site: site || undefined,
			evidence: evidence ? [evidence] : [],
		};
		byName.set(name, entry);
		found.push(entry);
	};

	for (const sig of DB) {
		/** @type {string[]} */
		const evidence = [];
		for (const re of sig.h || []) {
			for (const line of headerLines) {
				if (re.test(line)) {
					evidence.push(`header: ${line.slice(0, 120)}`);
				}
			}
		}
		if (html) {
			for (const re of sig.x || []) {
				const snippet = htmlEvidence(html, re);
				if (snippet) evidence.push(snippet);
			}
		}
		// keep at most 3 evidence lines per technology
		if (evidence.length) {
			for (const ev of evidence.slice(0, 3)) {
				add(sig.n, sig.c, sig.site, ev);
			}
		}
	}

	// language derivation — copies the evidence of the tech that implies it
	for (const derived of DERIVED_LANGUAGES) {
		const source = byName.get(derived.when);
		if (source) {
			for (const ev of source.evidence) {
				add(derived.n, derived.c, derived.site, ev);
			}
			if (!byName.get(derived.n)?.evidence.length) {
				add(
					derived.n,
					derived.c,
					derived.site,
					`derived from: ${derived.when}`,
				);
			}
		}
	}

	return found;
}

/**
 * Determines whether a site can be shown inside an <iframe>: reads
 * X-Frame-Options and the CSP frame-ancestors directive from the
 * response headers.
 * @param {Record<string, string>} headers lowercase header record
 * @returns {{blocked: boolean, reason: string}}
 */
export function embeddingPolicy(headers = {}) {
	const xfo = String(headers["x-frame-options"] || "");
	if (/deny/i.test(xfo)) {
		return { blocked: true, reason: `X-Frame-Options: ${xfo}` };
	}
	if (/sameorigin/i.test(xfo)) {
		return { blocked: true, reason: `X-Frame-Options: ${xfo}` };
	}
	const csp = String(headers["content-security-policy"] || "");
	const ancestors = /frame-ancestors\s+([^;]+)/i.exec(csp);
	if (ancestors) {
		const value = ancestors[1].trim();
		if (/['"]?none['"]?/i.test(value)) {
			return { blocked: true, reason: `CSP frame-ancestors: ${value}` };
		}
		if (!/\*/.test(value)) {
			return { blocked: true, reason: `CSP frame-ancestors: ${value}` };
		}
	}
	return { blocked: false, reason: "" };
}

/**
 * Builds the plain-text analysis report the user can copy.
 * @param {{url: string, status: number, statusText?: string, elapsedMs?: number, sizeBytes?: number, headers: Record<string, string>, techs: Array<{name: string, category: string, site?: string, evidence: string[]}>, meta: Record<string, string>}} data
 * @param {(key: string) => string} tr i18n lookup
 * @returns {string}
 */
export function buildAnalyzerReport(data, tr) {
	const lines = [];
	lines.push("XCoder Site Analyzer");
	lines.push("=".repeat(40));
	lines.push(`${tr("url")}: ${data.url}`);
	const status = `${tr("status code")}: ${data.status}${data.statusText ? ` ${data.statusText}` : ""}`;
	const extras = [];
	if (typeof data.elapsedMs === "number") {
		extras.push(`${tr("load time")}: ${(data.elapsedMs / 1000).toFixed(1)} s`);
	}
	if (typeof data.sizeBytes === "number" && data.sizeBytes > 0) {
		extras.push(`${tr("page size")}: ${(data.sizeBytes / 1024).toFixed(1)} kB`);
	}
	lines.push([status, ...extras].join(" · "));

	const grouped = new Map();
	for (const tech of data.techs || []) {
		const list = grouped.get(tech.category) || [];
		list.push(tech);
		grouped.set(tech.category, list);
	}

	lines.push("");
	lines.push(`${tr("technologies")} (${(data.techs || []).length})`);
	lines.push("-".repeat(40));
	for (const [category, list] of grouped) {
		const key = `tech cat ${category}`;
		lines.push(`${tr(key) || category}: ${list.map((t) => t.name).join(", ")}`);
	}

	lines.push("");
	lines.push(tr("how detected"));
	lines.push("-".repeat(40));
	for (const tech of data.techs || []) {
		for (const ev of tech.evidence) {
			lines.push(`- ${tech.name} · ${ev}`);
		}
	}

	const meta = data.meta || {};
	const metaLines = Object.entries(meta).filter(
		([, value]) => typeof value === "string" && value.trim(),
	);
	if (metaLines.length) {
		lines.push("");
		lines.push(tr("page info"));
		lines.push("-".repeat(40));
		for (const [key, value] of metaLines) {
			lines.push(`${key}: ${String(value).slice(0, 200)}`);
		}
	}

	lines.push("");
	lines.push(`${tr("response headers")}`);
	lines.push("-".repeat(40));
	for (const [key, value] of Object.entries(data.headers || {})) {
		lines.push(`${key}: ${String(value).slice(0, 200)}`);
	}
	return lines.join("\n");
}
