/**
 * wikiLang.mjs — extração da secção ativa de páginas bilíngues da wiki
 * (formato: âncora <a id="português"></a> ... <a id="english"></a> ...).
 * Módulo puro, sem efeitos colaterais — partilhado por publish-wiki.mjs
 * e checkWikiBilingual.mjs.
 */

const PT_ANCHOR = '<a id="português"></a>';
const EN_ANCHOR = '<a id="english"></a>';

/**
 * Extrai a secção ativa de uma página bilíngue.
 * Retorna { text, extracted } — extracted=false quando os marcadores não
 * existem (página publica como está) ou a secção pedida não existe.
 */
export function extractLangSection(raw, lang) {
        const p = raw.indexOf(PT_ANCHOR);
        const e = raw.indexOf(EN_ANCHOR);
        if (p === -1 && e === -1) return { text: raw, extracted: false };
        if (lang === "pt") {
                if (p === -1) return { text: raw, extracted: false };
                const end = e === -1 ? raw.length : e;
                return { text: stripDashes(raw.slice(p + PT_ANCHOR.length, end)), extracted: true };
        }
        if (e === -1) return { text: raw, extracted: false };
        return { text: stripDashes(raw.slice(e + EN_ANCHOR.length)), extracted: true };
}

/** Remove separadores `---` órfãos no início/fim da secção extraída. */
function stripDashes(text) {
        return text
                .replace(/^\s*\n---\s*\n/, "\n")
                .replace(/\n---\s*$/, "\n")
                .trimStart();
}
