import settings from "lib/settings";

/**
 * AI bots — one-tap assistant personas for the chat.
 *
 * A bot is a reusable system-prompt persona (like GPTs / Claude
 * projects): pick it once and every new message is framed by it, while
 * the XCoder agent tools, skills and workspace context stay available.
 *
 * BUILTIN_BOTS ship with the app; user bots live in settings.aiUserBots
 * and the active choice in settings.aiActiveBot ("" = no bot). All
 * helpers are pure where possible so tests can pin the behavior.
 */

/**
 * @typedef {object} AIBot
 * @property {string} id
 * @property {string} name
 * @property {string} icon single emoji used in the picker/pill
 * @property {string} description short line shown in the picker
 * @property {string} prompt persona instructions merged into the system prompt
 */

/** @type {AIBot[]} */
export const BUILTIN_BOTS = [
	{
		id: "reviewer",
		name: "Revisor de Código",
		icon: "🔍",
		description: "Encontra bugs, riscos e melhorias no código ativo",
		prompt: `Persona: revisor de código sênior. Quando analisar código:
1. Liste problemas por severidade (bug, segurança, performance, clareza) com caminho+linha.
2. Para cada problema, mostre a correção mínima como diff antes/depois.
3. Nunca reescreva tudo — correções cirúrgicas e objetivas. Termine com um veredito de uma linha.`,
	},
	{
		id: "architect",
		name: "Arquiteto",
		icon: "🏛️",
		description: "Planeja features e desenha soluções antes de codar",
		prompt: `Persona: arquiteto de software. Para qualquer tarefa:
1. Primeiro proponha um plano curto (objetivo, abordagem, ficheiros afetados, riscos) e AGUARDE confirmação antes de editar ficheiros.
2. Prefira a solução mais simples que funciona; justifique escolhas de tecnologia numa linha.
3. Divida a implementação em passos verificáveis e execute um de cada vez.`,
	},
	{
		id: "teacher",
		name: "Professor",
		icon: "🎓",
		description: "Explica código e conceitos passo a passo",
		prompt: `Persona: professor paciente. Explique com:
1. Uma analogia simples antes do detalhe técnico.
2. Passos numerados do mais básico ao avançado, com exemplos curtos.
3. Uma pergunta de verificação no fim para confirmar o entendimento.`,
	},
	{
		id: "translator",
		name: "Tradutor",
		icon: "🌍",
		description: "Traduz código, textos e mensagens de commit",
		prompt: `Persona: tradutor técnico PT↔EN↔ES. Regras:
1. Traduza preservando formatação, nomes de variáveis/identificadores e blocos de código intactos.
2. Para comentários de código, mantenha o estilo e o comprimento parecido do original.
3. Se um termo for ambíguo, dê a tradução escolhida e 1 alternativa entre parênteses.`,
	},
	{
		id: "regex",
		name: "Assistente de Regex",
		icon: "🧩",
		description: "Cria e explica expressões regulares",
		prompt: `Persona: especialista em expressões regulares. Sempre:
1. Dê a regex pronta para usar e explique cada parte numa linha.
2. Inclua 3 exemplos de correspondências e 3 não-correspondências.
3. Aviso sobre casos limites (catastrófico backtracking, greedy vs lazy) quando existirem.`,
	},
	{
		id: "shell",
		name: "Terminal",
		icon: "⌨️",
		description: "One-liners e scripts de shell sob medida",
		prompt: `Persona: especialista em shell (bash/termux). Para cada pedido:
1. Um comando único e pronto a copiar, com a variante mais segura possível.
2. Explique cada parte do comando num comentário.
3. Avise claramente se o comando apaga, sobrescreve ou envia dados.`,
	},
	{
		id: "docs",
		name: "Redator Técnico",
		icon: "📝",
		description: "READMEs, changelogs e mensagens de commit",
		prompt: `Persona: redator técnico. Regras:
1. Escreva documentação concisa: frases curtas, listas, exemplos copiáveis.
2. Mensagens de commit no padrão Conventional Commits (tipo(escopo): resumo no imperativo).
3. Proponha sempre a estrutura em tópicos antes do texto completo.`,
	},
	{
		id: "sql",
		name: "Analista SQL",
		icon: "🗄️",
		description: "Consultas, esquemas e otimização de queries",
		prompt: `Persona: especialista em SQL. Sempre:
1. Dê a query completa e correta primeiro, formatada.
2. Explique o plano de execução esperado e sugira índices quando útil.
3. Diga explicitamente o dialeto usado (SQLite/Postgres/MySQL) e diferenças quando relevantes.`,
	},
];

/** Active bot id setting ("" = none). */
export function activeBotId() {
	return String(settings.value?.aiActiveBot || "");
}

/**
 * The active bot or null when none/priority to builtin.
 * @returns {AIBot|null}
 */
export function activeBot() {
	const id = activeBotId();
	if (!id) return null;
	return listBots().find((bot) => bot.id === id) || null;
}

/** All bots: builtins first, then user bots. */
export function listBots() {
	const user = Array.isArray(settings.value?.aiUserBots)
		? settings.value.aiUserBots
		: [];
	const seen = new Set();
	const out = [];
	for (const bot of [...BUILTIN_BOTS, ...user]) {
		if (!bot?.id || seen.has(bot.id)) continue;
		seen.add(bot.id);
		out.push(bot);
	}
	return out;
}

/** Bot by id (builtin or user). */
export function getBot(id) {
	return listBots().find((bot) => bot.id === id) || null;
}

/** Sets (or clears with "") the active bot and returns the bot. */
export async function setActiveBot(id) {
	await settings.update({ aiActiveBot: getBot(id) ? id : "" });
	return activeBot();
}

/**
 * Validates + sanitizes a user bot. Throws with a friendly message when
 * invalid. Pure (no settings access).
 * @param {object} input
 * @returns {AIBot}
 */
export function validateUserBot(input) {
	const name = String(input?.name || "").trim();
	if (!name) throw new Error("Bot needs a name");
	if (name.length > 40) throw new Error("Bot name too long (max 40)");
	const prompt = String(input?.prompt || "").trim();
	if (!prompt) throw new Error("Bot needs persona instructions");
	if (prompt.length > 4000) throw new Error("Persona too long (max 4000)");
	const icon =
		String(input?.icon || "🤖")
			.trim()
			.slice(0, 4) || "🤖";
	const description = String(input?.description || "")
		.trim()
		.slice(0, 120);
	const slug =
		String(input?.id || name)
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "bot";
	const id = `user-${slug}`.slice(0, 60);
	const clash = BUILTIN_BOTS.some((bot) => bot.id === id);
	return { id: clash ? `user-${slug}-x` : id, name, icon, description, prompt };
}

/** Persists a user bot (create or update by id). */
export async function saveUserBot(input) {
	const bot = validateUserBot(input);
	const user = (settings.value?.aiUserBots || []).filter(
		(entry) => entry.id !== bot.id,
	);
	await settings.update({ aiUserBots: [...user, bot] });
	return bot;
}

/** Removes a user bot; also clears the active bot when it was active. */
export async function deleteUserBot(id) {
	const user = (settings.value?.aiUserBots || []).filter(
		(entry) => entry.id !== id,
	);
	const patch = { aiUserBots: user };
	if (activeBotId() === id) patch.aiActiveBot = "";
	await settings.update(patch);
}

/**
 * Merges the active bot persona into the agent system prompt. Pure —
 * the base prompt stays untouched when no bot is active.
 * @param {string} basePrompt full system prompt built by the agent
 * @param {AIBot|null} bot
 */
export function applyBotToPrompt(basePrompt, bot) {
	if (!bot?.prompt) return basePrompt;
	const section = [
		"",
		`ACTIVE PERSONA — ${bot.name}. Follow these persona rules on TOP of your role:`,
		bot.prompt,
		"",
	].join("\n");
	// persona goes right after the first paragraph (identity block) so it
	// colors every instruction below it
	const firstBreak = basePrompt.indexOf("\n");
	if (firstBreak < 0) return `${basePrompt}\n${section}`;
	return `${basePrompt.slice(0, firstBreak)}\n${section}${basePrompt.slice(
		firstBreak + 1,
	)}`;
}
