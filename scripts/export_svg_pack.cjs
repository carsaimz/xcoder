/**
 * export_svg_pack.cjs — gera os .svg do pacote a partir de src/utils/svgIcons.js
 * Uso: node scripts/export_svg_pack.cjs
 * Fonte única de verdade: src/utils/svgIcons.js (ICONS).
 */
const fs = require("fs");
const path = require("path");
const Module = require("module");

const ROOT = path.resolve(__dirname, "..");
const MODULE = path.join(ROOT, "src/utils/svgIcons.js");

// carrega o literal ICONS sem executar o módulo (que depende de DOM)
const src = fs.readFileSync(MODULE, "utf8");
const start = src.indexOf("const ICONS = {");
const end = src.indexOf("\n};", start);
if (start < 0 || end < 0) {
        console.error("Bloco ICONS não encontrado em", MODULE);
        process.exit(1);
}
const literal = src.slice(start + "const ICONS = ".length, end + 2).trim(); // inclui o "}" final
const ICONS = Function(`"use strict"; return (${literal});`)();

const OUT_DIR = path.join(ROOT, "src/res/icons/svg");
fs.mkdirSync(OUT_DIR, { recursive: true });

let count = 0;
for (const [name, nodes] of Object.entries(ICONS)) {
        const inner = nodes
                .map(([tag, attrs]) => {
                        const a = Object.entries(attrs)
                                .map(([k, v]) => `${k}="${v}"`)
                                .join(" ");
                        return `  <${tag} ${a} />`;
                })
                .join("\n");
        const svg = `<!-- Lucide-flavored icon from the Xcoder SVG pack (src/utils/svgIcons.js). -->
<!-- Path data © Lucide Contributors, ISC license (https://lucide.dev). -->
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
${inner}
</svg>
`;
        fs.writeFileSync(path.join(OUT_DIR, `${name}.svg`), svg);
        count++;
}
console.log(`SVGs gerados em src/res/icons/svg: ${count}`);
