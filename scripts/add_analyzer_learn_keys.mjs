#!/usr/bin/env node
/**
 * Adds the Site Analyzer + Learn keys to en-us.json and pt-br.json.
 * The other 29 languages are filled by scripts/translate_missing.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LANG_DIR = path.join(
	path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
	"src",
	"lang",
);

const EN = {
	// --- Site Analyzer ---------------------------------------------------
	analyzer: "Site Analyzer",
	analyze: "Analyze",
	"analyzer idle": "Enter an address to analyze",
	"analyzer running": "Analyzing",
	"analyzer done": "Analysis complete",
	"analyzer failed": "Could not fetch the site",
	"analyzer tech": "Technologies",
	"analyzer details": "Details",
	"analyzer report": "Report",
	"analyzer no results": "No technologies detected",
	"analyzer no results hint":
		"The site may have blocked the request — try “Rendered version”.",
	"analyzer rendered": "Rendered version",
	"analyzer rendered hint":
		"“Rendered version” loads the page in an internal WebView and analyzes the final DOM — handles SPA sites and blocks.",
	"analyzer rendered running": "Loading the rendered version…",
	"analyzer rendered done": "Rendered version analyzed",
	"analyzer copy report": "Copy report",
	"analyzer report copied": "Report copied",
	"analyzer copy failed": "Could not copy",
	"analyzer no report": "Analyze a site first",
	"analyzer found": "Found",
	"analyzer no details": "No details available.",
	// shared labels used by the analyzer rows/report
	title: "Title",
	description: "Description",
	generator: "Generator",
	viewport: "Viewport",
	canonical: "Canonical",
	language: "Language",
	url: "URL",
	technologies: "Technologies",
	"how detected": "Evidence",
	"page info": "Page info",
	"response headers": "Response headers",
	"status code": "Status",
	"load time": "Time",
	"page size": "Size",
	// tech categories
	"tech cat language": "Languages",
	"tech cat framework": "Frameworks",
	"tech cat js": "JS libraries",
	"tech cat cms": "CMS / builders",
	"tech cat ecommerce": "E-commerce & payments",
	"tech cat ssg": "Static generators",
	"tech cat server": "Web servers",
	"tech cat cdn": "CDN / hosting",
	"tech cat analytics": "Analytics & ads",
	"tech cat security": "Security & captcha",
	"tech cat fonts": "Fonts",
	"tech cat embed": "Embeds & widgets",
	"tech cat other": "Other features",
	// --- Learn ------------------------------------------------------------
	learn: "Learn",
	"learn intro":
		"Study and consult any language or tool — every site opens in the internal WebView.",
	"learn search": "Search sites…",
	"learn all": "All",
	"learn back": "Back",
	"learn native": "Open in internal WebView",
	"learn blocked": "This site does not allow embedding.",
	"learn blocked short": "does not allow embedding — opened in the internal WebView",
	"learn empty": "No sites found.",
	"learn cat general": "General & reference",
	"learn cat htmlcss": "HTML & CSS",
	"learn cat js": "JavaScript & TypeScript",
	"learn cat python": "Python",
	"learn cat jvm": "Java & Kotlin",
	"learn cat clang": "C / C++ / C#",
	"learn cat git": "Git & GitHub",
	"learn cat backend": "Backend & APIs",
	"learn cat practice": "Practice & challenges",
	"learn cat data": "Databases & SQL",
	"learn cat devops": "DevOps & security",
};

const PT = {
	// --- Analisador de sites ----------------------------------------------
	analyzer: "Analisador de Sites",
	analyze: "Analisar",
	"analyzer idle": "Introduza um endereço para analisar",
	"analyzer running": "A analisar",
	"analyzer done": "Análise concluída",
	"analyzer failed": "Falha ao obter o site",
	"analyzer tech": "Tecnologias",
	"analyzer details": "Detalhes",
	"analyzer report": "Relatório",
	"analyzer no results": "Nenhuma tecnologia detetada",
	"analyzer no results hint":
		"O site pode ter bloqueado o pedido — tente «Versão renderizada».",
	"analyzer rendered": "Versão renderizada",
	"analyzer rendered hint":
		"«Versão renderizada» carrega a página numa WebView interna e analisa o DOM final — resolve sites SPA e bloqueios.",
	"analyzer rendered running": "A carregar a versão renderizada…",
	"analyzer rendered done": "Versão renderizada analisada",
	"analyzer copy report": "Copiar relatório",
	"analyzer report copied": "Relatório copiado",
	"analyzer copy failed": "Não foi possível copiar",
	"analyzer no report": "Análise um site primeiro",
	"analyzer found": "Encontradas",
	"analyzer no details": "Sem detalhes disponíveis.",
	title: "Título",
	description: "Descrição",
	generator: "Generator",
	viewport: "Viewport",
	canonical: "Canonical",
	language: "Idioma",
	url: "URL",
	technologies: "Tecnologias",
	"how detected": "Evidências",
	"page info": "Informação da página",
	"response headers": "Cabeçalhos da resposta",
	"status code": "Estado",
	"load time": "Tempo",
	"page size": "Tamanho",
	"tech cat language": "Linguagens",
	"tech cat framework": "Frameworks",
	"tech cat js": "Bibliotecas JS",
	"tech cat cms": "CMS / construtores",
	"tech cat ecommerce": "E-commerce e pagamentos",
	"tech cat ssg": "Geradores estáticos",
	"tech cat server": "Servidores web",
	"tech cat cdn": "CDN / hospedagem",
	"tech cat analytics": "Analytics e anúncios",
	"tech cat security": "Segurança e captcha",
	"tech cat fonts": "Fontes",
	"tech cat embed": "Incorporações e widgets",
	"tech cat other": "Outros recursos",
	// --- Learn --------------------------------------------------------------
	learn: "Aprender",
	"learn intro":
		"Estude e consulte qualquer linguagem ou ferramenta — cada site abre na WebView interna.",
	"learn search": "Procurar sites…",
	"learn all": "Todos",
	"learn back": "Voltar",
	"learn native": "Abrir na WebView interna",
	"learn blocked": "Este site não permite ser incorporado.",
	"learn blocked short": "não permite incorporação — aberto na WebView interna",
	"learn empty": "Nenhum site encontrado.",
	"learn cat general": "Geral e referência",
	"learn cat htmlcss": "HTML e CSS",
	"learn cat js": "JavaScript e TypeScript",
	"learn cat python": "Python",
	"learn cat jvm": "Java e Kotlin",
	"learn cat clang": "C / C++ / C#",
	"learn cat git": "Git e GitHub",
	"learn cat backend": "Backend e APIs",
	"learn cat practice": "Prática e desafios",
	"learn cat data": "Bases de dados e SQL",
	"learn cat devops": "DevOps e segurança",
};

function addKeys(file, keys) {
	const target = path.join(LANG_DIR, file);
	const data = JSON.parse(fs.readFileSync(target, "utf8"));
	let added = 0;
	for (const [key, value] of Object.entries(keys)) {
		if (!(key in data)) {
			added += 1;
		}
		data[key] = value;
	}
	// preserve the original key order, append new keys at the end (the
	// translate script re-sorts nothing) — rewrite with TAB indentation
	const text = `${JSON.stringify(data, null, "\t")}\n`;
	fs.writeFileSync(target, text);
	console.log(`${file}: ${added} keys added`);
}

addKeys("en-us.json", EN);
addKeys("pt-br.json", PT);
