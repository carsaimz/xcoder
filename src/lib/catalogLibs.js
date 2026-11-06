/**
 * CDN catalog libraries — 55+ popular web libraries served from
 * jsDelivr. Data-only module (no bundled files): the libs sidebar
 * shows them with a CDN badge and offers the ready-to-paste <script>
 * / <link> tags. Every URL in here was verified reachable (HTTP 200)
 * with HTTP-200 + size checks at v1.8.9 — re-verify URLs and sizes
 * before editing, so tags never go stale.
 */

/** @typedef {import('./localLibs').LocalLib} LocalLib */

/** @type {LocalLib[]} */
export const CATALOG_LIBS = [
	{
		id: "vue-router",
		name: "Vue Router",
		version: "4.5.0",
		license: "MIT",
		site: "https://router.vuejs.org",
		cdnBase: "https://cdn.jsdelivr.net/npm/vue-router@4.5.0",
		descPt:
			"Roteador oficial do Vue 3 (history/hash modes, guards, lazy routes) \u2014 build global para o navegador.",
		descEn:
			"Official Vue 3 router (history/hash modes, guards, lazy routes) \u2014 browser global build.",
		files: [{ path: "dist/vue-router.global.prod.js", size: 25396 }],
	},
	{
		id: "tailwind-browser",
		name: "Tailwind CSS (browser)",
		version: "4.1.4",
		license: "MIT",
		site: "https://tailwindcss.com",
		cdnBase: "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1.4",
		descPt:
			"Utilit\u00e1rios CSS on-the-fly no navegador (compilador JIT embutido) \u2014 sem build para prot\u00f3tipos r\u00e1pidos.",
		descEn:
			"On-the-fly CSS utilities in the browser (embedded JIT compiler) \u2014 no build step for fast prototyping.",
		files: [{ path: "dist/index.global.js", size: 250556 }],
	},
	{
		id: "bulma",
		name: "Bulma",
		version: "1.0.4",
		license: "MIT",
		site: "https://bulma.io",
		cdnBase: "https://cdn.jsdelivr.net/npm/bulma@1.0.4",
		descPt:
			"Framework CSS s\u00f3 com classes flexbox/grid, sem JavaScript \u2014 componentes prontos e temas por vari\u00e1veis.",
		descEn:
			"Flexbox/grid-only CSS framework with zero JavaScript \u2014 ready components and variable-based theming.",
		files: [{ path: "css/bulma.min.css", size: 677931 }],
	},
	{
		id: "pico",
		name: "Pico CSS",
		version: "2.1.1",
		license: "MIT",
		site: "https://picocss.com",
		cdnBase: "https://cdn.jsdelivr.net/npm/@picocss/pico@2.1.1",
		descPt:
			"CSS minimalista sem classes: escreve HTML sem\u00e2ntico e ganha tipografia, formul\u00e1rios e layout bonitos.",
		descEn:
			"Classless minimal CSS: write semantic HTML and get polished typography, forms and layout for free.",
		files: [{ path: "css/pico.min.css", size: 83319 }],
	},
	{
		id: "water-css",
		name: "Water.css",
		version: "2.1.1",
		license: "MIT",
		site: "https://watercss.kognise.dev",
		cdnBase: "https://cdn.jsdelivr.net/npm/water.css@2.1.1",
		descPt:
			"Drop-in de estilos sem classes (~2 kB) com tema claro/escuro autom\u00e1tico para p\u00e1ginas simples.",
		descEn:
			"Classless drop-in stylesheet (~2 kB) with automatic light/dark theme for simple pages.",
		files: [{ path: "out/water.min.css", size: 22668 }],
	},
	{
		id: "normalize",
		name: "Normalize.css",
		version: "8.0.1",
		license: "MIT",
		site: "https://necolas.github.io/normalize.css",
		cdnBase: "https://cdn.jsdelivr.net/npm/normalize.css@8.0.1",
		descPt:
			"Redefini\u00e7\u00e3o de estilos que uniformiza o rendering entre navegadores, preservando defaults \u00fateis.",
		descEn:
			"Style reset that makes browser rendering consistent while preserving useful defaults.",
		files: [{ path: "normalize.css", size: 6138 }],
	},
	{
		id: "animate-css",
		name: "Animate.css",
		version: "4.1.1",
		license: "Hippocratic 2.1",
		site: "https://animate.style",
		cdnBase: "https://cdn.jsdelivr.net/npm/animate.css@4.1.1",
		descPt:
			"Biblioteca de anima\u00e7\u00f5es CSS prontas (bounce, fade, flip, zoom) aplicadas com uma classe.",
		descEn:
			"Ready-made CSS animations (bounce, fade, flip, zoom) applied with a single class.",
		files: [{ path: "animate.min.css", size: 71750 }],
	},
	{
		id: "date-fns",
		name: "date-fns",
		version: "4.1.0",
		license: "MIT",
		site: "https://date-fns.org",
		cdnBase: "https://cdn.jsdelivr.net/npm/date-fns@4.1.0",
		descPt:
			"Toolkit moderno de datas com centenas de fun\u00e7\u00f5es puras \u2014 build CDN que exp\u00f5e dateFns global.",
		descEn:
			"Modern date toolkit with hundreds of pure functions \u2014 CDN build exposing the dateFns global.",
		files: [{ path: "cdn.min.js", size: 105691 }],
	},
	{
		id: "d3",
		name: "D3.js",
		version: "7.9.0",
		license: "ISC",
		site: "https://d3js.org",
		cdnBase: "https://cdn.jsdelivr.net/npm/d3@7.9.0",
		descPt:
			"Visualiza\u00e7\u00f5es de dados com SVG/Canvas a partir de data-binding \u2014 o canivete su\u00ed\u00e7o dos gr\u00e1ficos.",
		descEn:
			"Data-driven SVG/Canvas visualizations via data-binding \u2014 the Swiss-army knife of charts.",
		files: [{ path: "dist/d3.min.js", size: 0 }],
	},
	{
		id: "three",
		name: "Three.js",
		version: "0.158.0",
		license: "MIT",
		site: "https://threejs.org",
		cdnBase: "https://cdn.jsdelivr.net/npm/three@0.158.0",
		descPt:
			"3D com WebGL: cenas, materiais, luzes e c\u00e2maras \u2014 build UMD cl\u00e1ssica para scripts simples.",
		descEn:
			"WebGL 3D: scenes, materials, lights and cameras \u2014 classic UMD build for straightforward scripts.",
		files: [{ path: "build/three.min.js", size: 651651 }],
	},
	{
		id: "gsap",
		name: "GSAP",
		version: "3.12.5",
		license: "Standard GSAP",
		site: "https://gsap.com",
		cdnBase: "https://cdn.jsdelivr.net/npm/gsap@3.12.5",
		descPt:
			"Anima\u00e7\u00f5es profissionais de alta performance (timelines, eases, transforms) usadas pela ind\u00fastria.",
		descEn:
			"Industry-grade high-performance animations (timelines, eases, transforms).",
		files: [{ path: "dist/gsap.min.js", size: 72214 }],
	},
	{
		id: "animejs",
		name: "Anime.js",
		version: "3.2.2",
		license: "MIT",
		site: "https://animejs.com",
		cdnBase: "https://cdn.jsdelivr.net/npm/animejs@3.2.2",
		descPt:
			"Anima\u00e7\u00e3o leve de atributos CSS, SVG e objetos JS com timelines simples e poderosas.",
		descEn:
			"Lightweight animation of CSS attributes, SVG and JS objects with simple yet powerful timelines.",
		files: [{ path: "lib/anime.min.js", size: 17384 }],
	},
	{
		id: "swiper",
		name: "Swiper",
		version: "11.2.0",
		license: "MIT",
		site: "https://swiperjs.com",
		cdnBase: "https://cdn.jsdelivr.net/npm/swiper@11.2.0",
		descPt:
			"Slider/carrossel t\u00e1til moderno (free mode, parallax, lazy load) \u2014 bundle CSS+JS num ficheiro.",
		descEn:
			"Modern touch slider/carousel (free mode, parallax, lazy load) \u2014 CSS+JS bundle in one file.",
		files: [
			{ path: "swiper-bundle.min.js", size: 153005 },
			{ path: "swiper-bundle.min.css", size: 18455 },
		],
	},
	{
		id: "aos",
		name: "AOS",
		version: "2.3.4",
		license: "MIT",
		site: "https://michalsnik.github.io/aos",
		cdnBase: "https://cdn.jsdelivr.net/npm/aos@2.3.4",
		descPt:
			"Anima\u00e7\u00f5es on-scroll (Animate On Scroll) com data-attributes \u2014 entrada suave dos elementos.",
		descEn:
			"Animate On Scroll with data-attributes \u2014 smooth element entrances as the page scrolls.",
		files: [
			{ path: "dist/aos.js", size: 14690 },
			{ path: "dist/aos.css", size: 26053 },
		],
	},
	{
		id: "leaflet",
		name: "Leaflet",
		version: "1.9.4",
		license: "BSD-2-Clause",
		site: "https://leafletjs.com",
		cdnBase: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4",
		descPt:
			"Mapas interativos leves (tiles, markers, popups) \u2014 a biblioteca de mapas mais usada da web.",
		descEn:
			"Lightweight interactive maps (tiles, markers, popups) \u2014 the web's most-used mapping library.",
		files: [
			{ path: "dist/leaflet.js", size: 147552 },
			{ path: "dist/leaflet.css", size: 14806 },
		],
	},
	{
		id: "echarts",
		name: "ECharts",
		version: "5.6.0",
		license: "Apache-2.0",
		site: "https://echarts.apache.org",
		cdnBase: "https://cdn.jsdelivr.net/npm/echarts@5.6.0",
		descPt:
			"Gr\u00e1ficos e dashboards ricos da Apache (linha, mapa, heatmap, 3D) com rendering Canvas/SVG.",
		descEn:
			"Rich Apache charting/dashboards (line, map, heatmap, 3D) with Canvas/SVG rendering.",
		files: [{ path: "dist/echarts.min.js", size: 0 }],
	},
	{
		id: "apexcharts",
		name: "ApexCharts",
		version: "3.54.1",
		license: "MIT",
		site: "https://apexcharts.com",
		cdnBase: "https://cdn.jsdelivr.net/npm/apexcharts@3.54.1",
		descPt:
			"Gr\u00e1ficos interativos modernos com zoom, anota\u00e7\u00f5es e eixos temporais \u2014 API declarativa simples.",
		descEn:
			"Modern interactive charts with zoom, annotations and time axes \u2014 simple declarative API.",
		files: [{ path: "dist/apexcharts.min.js", size: 539664 }],
	},
	{
		id: "mermaid",
		name: "Mermaid",
		version: "11.4.1",
		license: "MIT",
		site: "https://mermaid.js.org",
		cdnBase: "https://cdn.jsdelivr.net/npm/mermaid@11.4.1",
		descPt:
			"Diagramas como c\u00f3digo (flowchart, sequ\u00eancia, Gantt) renderizados a partir de texto Markdown-ish.",
		descEn:
			"Diagrams as code (flowchart, sequence, Gantt) rendered from Markdown-ish text.",
		files: [{ path: "dist/mermaid.min.js", size: 2571900 }],
	},
	{
		id: "marked",
		name: "Marked",
		version: "15.0.6",
		license: "MIT",
		site: "https://marked.js.org",
		cdnBase: "https://cdn.jsdelivr.net/npm/marked@15.0.6",
		descPt:
			"Conversor Markdown\u2192HTML rapid\u00edssimo e compat\u00edvel com CommonMark \u2014 ideal para previews.",
		descEn:
			"Blazing-fast CommonMark-compatible Markdown\u2192HTML converter \u2014 ideal for previews.",
		files: [{ path: "marked.min.js", size: 39249 }],
	},
	{
		id: "markdown-it",
		name: "markdown-it",
		version: "14.1.0",
		license: "MIT",
		site: "https://github.com/markdown-it/markdown-it",
		cdnBase: "https://cdn.jsdelivr.net/npm/markdown-it@14.1.0",
		descPt:
			"Parser Markdown extens\u00edvel (plugins, regras custom) com 100% suporte CommonMark.",
		descEn:
			"Extensible Markdown parser (plugins, custom rules) with 100% CommonMark support.",
		files: [{ path: "dist/markdown-it.min.js", size: 123618 }],
	},
	{
		id: "highlight",
		name: "Highlight.js",
		version: "11.11.1",
		license: "BSD-3-Clause",
		site: "https://highlightjs.org",
		cdnBase: "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1",
		descPt:
			"Realce de sintaxe autom\u00e1tico para 190+ linguagens \u2014 deteta a linguagem sozinho.",
		descEn:
			"Automatic syntax highlighting for 190+ languages \u2014 detects the language on its own.",
		files: [
			{ path: "build/highlight.min.js", size: 127496 },
			{ path: "build/styles/github-dark.min.css", size: 0 },
		],
	},
	{
		id: "prism",
		name: "Prism",
		version: "1.29.0",
		license: "MIT",
		site: "https://prismjs.com",
		cdnBase: "https://cdn.jsdelivr.net/npm/prismjs@1.29.0",
		descPt:
			"Realce de sintaxe leve com componentes por linguagem e temas CSS minimalistas.",
		descEn:
			"Lightweight syntax highlighting with per-language components and minimal CSS themes.",
		files: [
			{ path: "prism.js", size: 58198 },
			{ path: "themes/prism-tomorrow.css", size: 1766 },
		],
	},
	{
		id: "katex",
		name: "KaTeX",
		version: "0.16.21",
		license: "MIT",
		site: "https://katex.org",
		cdnBase: "https://cdn.jsdelivr.net/npm/katex@0.16.21",
		descPt:
			"Renderiza LaTeX matem\u00e1tico de forma r\u00e1pida e offline-friendly no navegador.",
		descEn:
			"Renders math LaTeX quickly in the browser, friendly to offline use.",
		files: [
			{ path: "dist/katex.min.js", size: 276574 },
			{ path: "dist/katex.min.css", size: 23352 },
		],
	},
	{
		id: "mathjax",
		name: "MathJax",
		version: "3.2.2",
		license: "Apache-2.0",
		site: "https://www.mathjax.org",
		cdnBase: "https://cdn.jsdelivr.net/npm/mathjax@3.2.2",
		descPt:
			"Motor completo de LaTeX/MathML com sa\u00edda CHTML acess\u00edvel e de alta qualidade.",
		descEn:
			"Full LaTeX/MathML engine with accessible, high-quality CHTML output.",
		files: [{ path: "es5/tex-mml-chtml.js", size: 1173007 }],
	},
	{
		id: "fabric",
		name: "Fabric.js",
		version: "5.3.0",
		license: "MIT",
		site: "http://fabricjs.com",
		cdnBase: "https://cdn.jsdelivr.net/npm/fabric@5.3.0",
		descPt:
			"Canvas interativo com objetos (shapes, imagens, grupos, SVG) \u2014 editor gr\u00e1fico no navegador.",
		descEn:
			"Interactive canvas with objects (shapes, images, groups, SVG) \u2014 a graphics editor in the browser.",
		files: [{ path: "dist/fabric.min.js", size: 313283 }],
	},
	{
		id: "konva",
		name: "Konva",
		version: "9.3.20",
		license: "MIT",
		site: "https://konvajs.org",
		cdnBase: "https://cdn.jsdelivr.net/npm/konva@9.3.20",
		descPt:
			"Canvas 2D declarativo com palco/camadas, eventos e transforms \u2014 ideal para apps de desenho.",
		descEn:
			"Declarative 2D canvas with stage/layers, events and transforms \u2014 great for drawing apps.",
		files: [{ path: "konva.min.js", size: 174824 }],
	},
	{
		id: "pixi",
		name: "PixiJS",
		version: "7.4.3",
		license: "MIT",
		site: "https://pixijs.com",
		cdnBase: "https://cdn.jsdelivr.net/npm/pixi.js@7.4.3",
		descPt:
			"Rendering 2D acelerado por WebGL (sprites, filtros, texto) para jogos e efeitos ricos.",
		descEn:
			"WebGL-accelerated 2D rendering (sprites, filters, text) for games and rich effects.",
		files: [{ path: "dist/pixi.min.js", size: 0 }],
	},
	{
		id: "matter-js",
		name: "Matter.js",
		version: "0.20.0",
		license: "MIT",
		site: "https://brm.io/matter-js",
		cdnBase: "https://cdn.jsdelivr.net/npm/matter-js@0.20.0",
		descPt:
			"Motor de f\u00edsica 2D (corpos, colis\u00f5es, constraints) divertido e f\u00e1cil de ligar ao render.",
		descEn:
			"2D physics engine (bodies, collisions, constraints) that is fun and easy to wire up.",
		files: [{ path: "build/matter.min.js", size: 83476 }],
	},
	{
		id: "howler",
		name: "Howler.js",
		version: "2.2.4",
		license: "MIT",
		site: "https://howlerjs.com",
		cdnBase: "https://cdn.jsdelivr.net/npm/howler@2.2.4",
		descPt:
			"\u00c1udio na web sem dores de cabe\u00e7a (sprites, fade, codecs) com fallback autom\u00e1tico HTML5/WebAudio.",
		descEn:
			"Painless web audio (sprites, fades, codecs) with automatic HTML5/WebAudio fallback.",
		files: [{ path: "dist/howler.min.js", size: 36173 }],
	},
	{
		id: "tone",
		name: "Tone.js",
		version: "15.0.4",
		license: "MIT",
		site: "https://tonejs.github.io",
		cdnBase: "https://cdn.jsdelivr.net/npm/tone@15.0.4",
		descPt:
			"Framework de m\u00fasica web: sintetizadores, efeitos, transport e scheduling preciso.",
		descEn:
			"Web music framework: synthesizers, effects, transport and precise scheduling.",
		files: [{ path: "build/Tone.js", size: 345744 }],
	},
	{
		id: "socket-io",
		name: "Socket.IO client",
		version: "4.8.1",
		license: "MIT",
		site: "https://socket.io",
		cdnBase: "https://cdn.jsdelivr.net/npm/socket.io@4.8.1/client-dist",
		descPt:
			"Cliente WebSocket com reconex\u00e3o, fallback e namespaces \u2014 tempo real simples no navegador.",
		descEn:
			"WebSocket client with reconnection, fallback and namespaces \u2014 simple realtime in the browser.",
		files: [{ path: "socket.io.min.js", size: 46831 }],
	},
	{
		id: "jszip",
		name: "JSZip",
		version: "3.10.1",
		license: "MIT",
		site: "https://stuk.github.io/jszip",
		cdnBase: "https://cdn.jsdelivr.net/npm/jszip@3.10.1",
		descPt:
			"Criar/ler ficheiros .zip direto no navegador \u2014 \u00fatil para exportar projetos inteiros.",
		descEn:
			"Create/read .zip files right in the browser \u2014 handy to export whole projects.",
		files: [{ path: "dist/jszip.min.js", size: 97630 }],
	},
	{
		id: "file-saver",
		name: "FileSaver.js",
		version: "2.0.5",
		license: "MIT",
		site: "https://github.com/eligrey/FileSaver.js",
		cdnBase: "https://cdn.jsdelivr.net/npm/file-saver@2.0.5",
		descPt:
			"Guarda blobs/ficheiros no cliente (saveAs) resolvendo as manias de cada navegador.",
		descEn:
			"Saves blobs/files client-side (saveAs) smoothing out each browser's quirks.",
		files: [{ path: "dist/FileSaver.min.js", size: 2749 }],
	},
	{
		id: "papaparse",
		name: "Papa Parse",
		version: "5.4.1",
		license: "MIT",
		site: "https://www.papaparse.com",
		cdnBase: "https://cdn.jsdelivr.net/npm/papaparse@5.4.1",
		descPt:
			"Parser CSV r\u00e1pido com streaming de ficheiros grandes e convers\u00e3o para JSON.",
		descEn:
			"Fast CSV parser with streaming for huge files and JSON conversion.",
		files: [{ path: "papaparse.min.js", size: 19469 }],
	},
	{
		id: "sortablejs",
		name: "SortableJS",
		version: "1.15.6",
		license: "MIT",
		site: "https://sortablejs.github.io/Sortable",
		cdnBase: "https://cdn.jsdelivr.net/npm/sortablejs@1.15.6",
		descPt:
			"Reordena\u00e7\u00e3o drag-and-drop de listas e grids t\u00e1teis, com cloning entre listas.",
		descEn:
			"Drag-and-drop reordering for touch lists and grids, with cross-list cloning.",
		files: [{ path: "Sortable.min.js", size: 45092 }],
	},
	{
		id: "lucide",
		name: "Lucide icons",
		version: "0.469.0",
		license: "ISC",
		site: "https://lucide.dev",
		cdnBase: "https://cdn.jsdelivr.net/npm/lucide@0.469.0",
		descPt:
			"Biblioteca de \u00edcones SVG (fork do Feather) com centenas de glifos limpos e API createIcons.",
		descEn:
			"SVG icon library (Feather fork) with hundreds of clean glyphs and a createIcons API.",
		files: [{ path: "dist/umd/lucide.min.js", size: 358106 }],
	},
	{
		id: "feather",
		name: "Feather Icons",
		version: "4.29.2",
		license: "MIT",
		site: "https://feathericons.com",
		cdnBase: "https://cdn.jsdelivr.net/npm/feather-icons@4.29.2",
		descPt:
			"\u00cdcones SVG minimalistas de tra\u00e7o arredondado \u2014 280+ glifos em ~70 kB.",
		descEn: "Minimalist round-stroke SVG icons \u2014 280+ glyphs in ~70 kB.",
		files: [{ path: "dist/feather.min.js", size: 0 }],
	},
	{
		id: "supabase",
		name: "Supabase JS",
		version: "2.48.1",
		license: "Apache-2.0",
		site: "https://supabase.com/docs/reference/javascript",
		cdnBase: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.48.1",
		descPt:
			"Cliente Supabase (Postgres, auth, storage, realtime) \u2014 build UMD para o navegador.",
		descEn:
			"Supabase client (Postgres, auth, storage, realtime) \u2014 browser UMD build.",
		files: [{ path: "dist/umd/supabase.js", size: 112575 }],
	},
	{
		id: "flatpickr",
		name: "Flatpickr",
		version: "4.6.13",
		license: "MIT",
		site: "https://flatpickr.js.org",
		cdnBase: "https://cdn.jsdelivr.net/npm/flatpickr@4.6.13",
		descPt:
			"Seletor de data/hora leve e sem depend\u00eancias, com temas e i18n inclu\u00eddos.",
		descEn:
			"Dependency-free lightweight datetime picker with themes and i18n built in.",
		files: [
			{ path: "dist/flatpickr.min.js", size: 50679 },
			{ path: "dist/flatpickr.min.css", size: 16166 },
		],
	},
	{
		id: "tippy",
		name: "Tippy.js",
		version: "6.3.7",
		license: "MIT",
		site: "https://atomiks.github.io/tippyjs",
		cdnBase: "https://cdn.jsdelivr.net/npm/tippy.js@6.3.7",
		descPt:
			"Tooltips e popovers completos (bundle com Popper) \u2014 posicionamento perfeito e temas.",
		descEn:
			"Full tooltips and popovers (Popper bundled) \u2014 perfect positioning and themes.",
		files: [{ path: "dist/tippy-bundle.umd.min.js", size: 25717 }],
	},
	{
		id: "popper",
		name: "Popper",
		version: "2.11.8",
		license: "MIT",
		site: "https://popper.js.org",
		cdnBase: "https://cdn.jsdelivr.net/npm/@popperjs/core@2.11.8",
		descPt:
			"Motor de posicionamento de poppers (dropdowns, tooltips) \u2014 base da Bootstrap 5.",
		descEn:
			"Popper positioning engine (dropdowns, tooltips) \u2014 the engine behind Bootstrap 5.",
		files: [{ path: "dist/umd/popper.min.js", size: 20122 }],
	},
	{
		id: "confetti",
		name: "canvas-confetti",
		version: "1.9.3",
		license: "ISC",
		site: "https://github.com/catdad/canvas-confetti",
		cdnBase: "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3",
		descPt:
			"Confetti performante no canvas \u2014 uma chamada, zero depend\u00eancias, celebra\u00e7\u00f5es garantidas.",
		descEn:
			"Performant canvas confetti \u2014 one call, zero dependencies, guaranteed celebrations.",
		files: [{ path: "dist/confetti.browser.min.js", size: 10808 }],
	},
	{
		id: "jquery-ui",
		name: "jQuery UI",
		version: "1.14.1",
		license: "MIT",
		site: "https://jqueryui.com",
		cdnBase: "https://cdn.jsdelivr.net/npm/jquery-ui@1.14.1",
		descPt:
			"Widgets cl\u00e1ssicos (datepicker, sortable, dialog, draggable) sobre o jQuery.",
		descEn:
			"Classic widgets (datepicker, sortable, dialog, draggable) on top of jQuery.",
		files: [
			{ path: "dist/jquery-ui.min.js", size: 252957 },
			{ path: "dist/themes/base/jquery-ui.min.css", size: 30146 },
		],
	},
	{
		id: "select2",
		name: "Select2",
		version: "4.1.0-rc.0",
		license: "MIT",
		site: "https://select2.org",
		cdnBase: "https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0",
		descPt:
			"Selects avan\u00e7ados: pesquisa, tags, loading remoto e templates de op\u00e7\u00e3o.",
		descEn:
			"Advanced selects: search, tags, remote loading and option templating.",
		files: [
			{ path: "dist/js/select2.min.js", size: 73163 },
			{ path: "dist/css/select2.min.css", size: 16264 },
		],
	},
	{
		id: "choices",
		name: "Choices.js",
		version: "10.2.0",
		license: "MIT",
		site: "https://github.com/Choices-js/Choices",
		cdnBase: "https://cdn.jsdelivr.net/npm/choices.js@10.2.0",
		descPt:
			"Selects/multiselects/input de tags configur\u00e1vel, sem jQuery e com boa acessibilidade.",
		descEn:
			"Configurable selects/multi-selects/tag inputs, jQuery-free with good accessibility.",
		files: [
			{ path: "public/assets/scripts/choices.min.js", size: 89447 },
			{ path: "public/assets/styles/choices.min.css", size: 7666 },
		],
	},
	{
		id: "rxjs",
		name: "RxJS",
		version: "7.8.1",
		license: "Apache-2.0",
		site: "https://rxjs.dev",
		descPt:
			"ReactiveX: observables para fluxos assíncronos (eventos, timers, pedidos) com operadores combináveis.",
		descEn:
			"ReactiveX: observables for async streams (events, timers, requests) with composable operators.",
		cdnBase: "https://cdn.jsdelivr.net/npm/rxjs@7.8.1/dist/bundles",
		files: [{ path: "rxjs.umd.min.js", size: 88037 }],
	},
	{
		id: "immer",
		name: "Immer",
		version: "9.0.21",
		license: "MIT",
		site: "https://immerjs.github.io/immer",
		descPt:
			"Estados imutáveis com conforto mutável: escreve mutations e recebe o next-state congelado.",
		descEn:
			"Immutable state with mutable comfort: write mutations, get the frozen next-state.",
		cdnBase: "https://cdn.jsdelivr.net/npm/immer@9.0.21/dist",
		files: [{ path: "immer.umd.production.min.js", size: 16200 }],
	},
	{
		id: "moment",
		name: "Moment.js",
		version: "2.30.1",
		license: "MIT",
		site: "https://momentjs.com",
		descPt:
			"Datas clássicas: parse, validar, formatar e durações. Bundle grande — prefira dayjs em projetos novos.",
		descEn:
			"Classic dates: parse, validate, format and durations. Large bundle — prefer dayjs in new projects.",
		cdnBase: "https://cdn.jsdelivr.net/npm/moment@2.30.1/min",
		files: [{ path: "moment.min.js", size: 58890 }],
	},
	{
		id: "handlebars",
		name: "Handlebars",
		version: "4.7.8",
		license: "MIT",
		site: "https://handlebarsjs.com",
		descPt:
			"Templates {{mustache}} compilados no browser — lógica mínima, helpers e partials.",
		descEn:
			"{{mustache}} templates compiled in the browser — minimal logic, helpers and partials.",
		cdnBase: "https://cdn.jsdelivr.net/npm/handlebars@4.7.8/dist",
		files: [{ path: "handlebars.min.js", size: 88426 }],
	},
	{
		id: "zod",
		name: "Zod",
		version: "3.24.1",
		license: "MIT",
		site: "https://zod.dev",
		descPt:
			"Validação de schemas com total typesafety — parse de APIs, formulários e configs (build UMD).",
		descEn:
			"Fully type-safe schema validation — parse APIs, forms and configs (UMD build).",
		cdnBase: "https://cdn.jsdelivr.net/npm/zod@3.24.1/lib",
		files: [{ path: "index.umd.js", size: 176626 }],
	},
	{
		id: "quill",
		name: "Quill",
		version: "2.0.3",
		license: "BSD-3-Clause",
		site: "https://quilljs.com",
		descPt:
			"Editor WYSIWYG rico com toolbar, temas e formato delta (inclui o CSS do tema Snow).",
		descEn:
			"Rich WYSIWYG editor with toolbar, themes and delta format (includes the Snow theme CSS).",
		cdnBase: "https://cdn.jsdelivr.net/npm/quill@2.0.3/dist",
		files: [
			{ path: "quill.js", size: 209274 },
			{ path: "quill.snow.css", size: 24606, tag: false },
		],
	},
	{
		id: "cropperjs",
		name: "Cropper.js",
		version: "1.6.2",
		license: "MIT",
		site: "https://github.com/fengyuanchen/cropperjs",
		descPt:
			"Recorte, rotação e zoom de imagens com gestos touch (inclui o CSS).",
		descEn:
			"Image crop, rotate and zoom with touch gestures (includes the CSS).",
		cdnBase: "https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist",
		files: [
			{ path: "cropper.min.js", size: 37369 },
			{ path: "cropper.css", size: 4978, tag: false },
		],
	},
	{
		id: "toastify-js",
		name: "Toastify JS",
		version: "1.12.0",
		license: "MIT",
		site: "https://apvarun.github.io/toastify-js",
		descPt:
			"Notificações toast leves e estilizáveis, sem dependências (inclui o CSS).",
		descEn:
			"Lightweight, styleable toast notifications with no dependencies (includes the CSS).",
		cdnBase: "https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src",
		files: [
			{ path: "toastify.js", size: 15130 },
			{ path: "toastify.css", size: 1560, tag: false },
		],
	},
	{
		id: "sweetalert2",
		name: "SweetAlert2",
		version: "11.15.10",
		license: "MIT",
		site: "https://sweetalert2.github.io",
		descPt:
			"Modais e alertas bonitos, acessíveis e customizáveis — bundle all com CSS embutido.",
		descEn:
			"Beautiful, accessible and customizable modals and alerts — all bundle with embedded CSS.",
		cdnBase: "https://cdn.jsdelivr.net/npm/sweetalert2@11.15.10/dist",
		files: [{ path: "sweetalert2.all.min.js", size: 72231 }],
	},
	{
		id: "floating-ui",
		name: "Floating UI",
		version: "1.6.13",
		license: "MIT",
		site: "https://floating-ui.com",
		descPt:
			"Posicionamento de tooltips, popovers e dropdowns (@floating-ui/dom, build UMD).",
		descEn:
			"Positioning for tooltips, popovers and dropdowns (@floating-ui/dom, UMD build).",
		cdnBase: "https://cdn.jsdelivr.net/npm/@floating-ui/dom@1.6.13/dist",
		files: [{ path: "floating-ui.dom.umd.min.js", size: 9913 }],
	},
];

export default CATALOG_LIBS;
