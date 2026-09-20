import Url from "utils/Url";

/**
 * Local (bundled) web libraries — htmx, Alpine.js, jQuery, Bootstrap,
 * Bootstrap Icons, Boxicons, Font Awesome and Chart.js shipped INSIDE
 * the app (src/res/libs is copied verbatim to www/res/libs at build time
 * by utils/config.js, preserving the relative font paths the css files
 * reference) so projects can use them fully offline.
 *
 * This module is pure data + helpers (tag building, sizes, copy plans);
 * the sidebar app (sidebarApps/libs) is only the UI layer.
 *
 * Each entry:
 *   - id        folder name under libs/ (local + bundled)
 *   - cdnBase   jsDelivr directory the files are mirrored from
 *   - files     bundled files; `tag: false` = asset referenced by a css
 *   - defer     add the defer attribute to the <script> tag
 */

/** @typedef {{path: string, size: number, defer?: boolean, tag?: boolean}} LibFile */

/**
 * @typedef {object} LocalLib
 * @property {string} id
 * @property {string} name
 * @property {string} version
 * @property {string} license
 * @property {string} site
 * @property {string} descPt
 * @property {string} descEn
 * @property {string} cdnBase
 * @property {LibFile[]} files
 */

/** @type {LocalLib[]} */
export const LOCAL_LIBS = [
	{
		id: "htmx",
		name: "htmx",
		version: "2.0.4",
		license: "BSD-2-Clause",
		site: "https://htmx.org",
		descPt:
			"AJAX, transições e WebSockets direto do HTML com atributos hx-*. Sem build, sem framework — perfeito para páginas estáticas.",
		descEn:
			"AJAX, transitions and WebSockets straight from HTML via hx-* attributes. No build step, no framework — great for static pages.",
		cdnBase: "https://cdn.jsdelivr.net/npm/htmx.org@2.0.4/dist",
		files: [{ path: "htmx.min.js", size: 50917, defer: true }],
	},
	{
		id: "alpinejs",
		name: "Alpine.js",
		version: "3.14.9",
		license: "MIT",
		site: "https://alpinejs.dev",
		descPt:
			"Reatividade leve no HTML (x-data, x-show, x-on) — a mensagem 'Tailwind para JavaScript'. Requer o atributo defer.",
		descEn:
			"Lightweight reactivity in HTML (x-data, x-show, x-on) — think 'Tailwind for JavaScript'. Requires the defer attribute.",
		cdnBase: "https://cdn.jsdelivr.net/npm/alpinejs@3.14.9/dist",
		files: [{ path: "cdn.min.js", size: 44758, defer: true }],
	},
	{
		id: "jquery",
		name: "jQuery",
		version: "3.7.1",
		license: "MIT",
		site: "https://jquery.com",
		descPt:
			"O clássico — seletores, ajax e manipulação de DOM em um único ficheiro pequeno. Ainda útil em projetos legados.",
		descEn:
			"The classic — selectors, ajax and DOM manipulation in one small file. Still handy for legacy projects.",
		cdnBase: "https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist",
		files: [{ path: "jquery.min.js", size: 87533 }],
	},
	{
		id: "bootstrap",
		name: "Bootstrap",
		version: "5.3.3",
		license: "MIT",
		site: "https://getbootstrap.com",
		descPt:
			"Grid responsivo, componentes e utilitários — css + bundle JS com Popper incluído.",
		descEn:
			"Responsive grid, components and utilities — css + JS bundle with Popper included.",
		cdnBase: "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist",
		files: [
			{ path: "css/bootstrap.min.css", size: 232803 },
			{ path: "js/bootstrap.bundle.min.js", size: 80721 },
		],
	},
	{
		id: "bootstrap-icons",
		name: "Bootstrap Icons",
		version: "1.11.3",
		license: "MIT",
		site: "https://icons.getbootstrap.com",
		descPt:
			'Mais de 2000 ícones SVG como fonte — use com <i class="bi bi-search"></i>. Fonte woff2 incluída ao copiar.',
		descEn:
			'2000+ SVG icons as a font — use <i class="bi bi-search"></i>. The woff2 font ships along when you copy it.',
		cdnBase: "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font",
		files: [
			{ path: "bootstrap-icons.min.css", size: 85875 },
			{ path: "fonts/bootstrap-icons.woff2", size: 130396, tag: false },
		],
	},
	{
		id: "boxicons",
		name: "Boxicons",
		version: "2.1.4",
		license: "MIT",
		site: "https://boxicons.com",
		descPt:
			"Biblioteca de ícones simples (regular/solid) — use com <i class='bx bx-home'></i>. Fonte incluída ao copiar.",
		descEn:
			"Simple icon library (regular/solid) — use <i class='bx bx-home'></i>. Font included when you copy it.",
		cdnBase: "https://cdn.jsdelivr.net/npm/boxicons@2.1.4",
		files: [
			{ path: "css/boxicons.min.css", size: 68028 },
			{ path: "fonts/boxicons.woff2", size: 115680, tag: false },
		],
	},
	{
		id: "fontawesome",
		name: "Font Awesome",
		version: "6.7.2",
		license: "CC-BY-4.0 / OFL / MIT",
		site: "https://fontawesome.com",
		descPt:
			"O conjunto de ícones mais popular — solid, regular e brands no all.min.css. Fontes woff2 incluídas ao copiar.",
		descEn:
			"The most popular icon set — solid, regular and brands in all.min.css. woff2 fonts included when you copy it.",
		cdnBase: "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.7.2",
		files: [
			{ path: "css/all.min.css", size: 73890 },
			{ path: "webfonts/fa-solid-900.woff2", size: 158220, tag: false },
			{ path: "webfonts/fa-brands-400.woff2", size: 118684, tag: false },
			{ path: "webfonts/fa-regular-400.woff2", size: 25472, tag: false },
			{ path: "webfonts/fa-v4compatibility.woff2", size: 4796, tag: false },
		],
	},
	{
		id: "chartjs",
		name: "Chart.js",
		version: "4.4.7",
		license: "MIT",
		site: "https://www.chartjs.org",
		descPt:
			"Gráficos de linha, barra, pizza e mais em <canvas> — build UMD que funciona direto no navegador.",
		descEn:
			"Line, bar, pie and more charts on <canvas> — UMD build that runs straight in the browser.",
		cdnBase: "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist",
		files: [{ path: "chart.umd.js", size: 205615 }],
	},
];

/** Bundled libs root inside the app assets (www/res/libs). */
export function assetsLibsRoot() {
	const assets = globalThis.ASSETS_DIRECTORY || "";
	return Url.join(assets, "res/libs");
}

/** Url of one lib file — mode "local" (bundled) or "cdn". */
export function fileUrl(lib, file, mode) {
	if (mode === "cdn") {
		return `${lib.cdnBase}/${file.path}`;
	}
	return Url.join(Url.join(assetsLibsRoot(), lib.id), file.path);
}

/** Html tag that loads one file from the given url. */
export function tagFor(file, url) {
	if (file.path.endsWith(".css")) {
		return `<link rel="stylesheet" href="${url}" />`;
	}
	const defer = file.defer ? " defer" : "";
	return `<script src="${url}"${defer}></script>`;
}

/** Files that load directly (css/js) — font assets are excluded. */
function taggable(lib) {
	return lib.files.filter((file) => file.tag !== false);
}

/**
 * Ready-to-paste <link>/<script> tags pointing at the project copy
 * (`libs/<id>/…`, relative to the html file) — valid AFTER the lib has
 * been copied into the project with "Copy to project".
 */
export function localTags(lib) {
	return taggable(lib)
		.map((file) => tagFor(file, `libs/${lib.id}/${file.path}`))
		.join("\n");
}

/** Ready-to-paste <link>/<script> tags pointing at the CDN. */
export function cdnTags(lib) {
	return taggable(lib)
		.map((file) => tagFor(file, fileUrl(lib, file, "cdn")))
		.join("\n");
}

/** Total bytes of all bundled files of a lib. */
export function libSize(lib) {
	return lib.files.reduce((total, file) => total + Number(file.size || 0), 0);
}

/** 50917 → "49.7 KB" (for the file list and the lib cards). */
export function formatBytes(bytes) {
	const n = Number(bytes) || 0;
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Copy plan for moving a lib into a project: one entry per bundled file,
 * from the app assets into `<destRoot>/<lib-id>/<path>`.
 * @param {LocalLib} lib
 * @param {string} destRoot url of the project's libs/ directory
 * @returns {Array<{from: string, to: string, dirParts: string[], name: string}>}
 */
export function copyPlan(lib, destRoot) {
	const libRoot = Url.join(destRoot, lib.id);
	return lib.files.map((file) => {
		const parts = file.path.split("/");
		const name = parts.pop();
		return {
			from: fileUrl(lib, file, "local"),
			to: Url.join(Url.join(libRoot, parts.join("/")), name),
			dirParts: parts,
			name,
		};
	});
}

export default {
	LOCAL_LIBS,
	assetsLibsRoot,
	fileUrl,
	tagFor,
	localTags,
	cdnTags,
	libSize,
	formatBytes,
	copyPlan,
};
