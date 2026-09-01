#!/usr/bin/env node
/**
 * Adds translation keys for:
 *  - "cmd:<commandName>" — command palette descriptions (pt-br full set)
 *  - About page credits / developer menu keys (en-us + pt-br)
 *  - "settings-category-data" (en-us + pt-br)
 * Insertion keeps JSON keys sorted (case-insensitive) with tab indentation.
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const LANG_DIR = path.join(ROOT, "src", "lang");
const EN = path.join(LANG_DIR, "en-us.json");
const PT = path.join(LANG_DIR, "pt-br.json");

// ---- 1. Extract registered commands ------------------------------------
const src =
        fs.readFileSync(path.join(ROOT, "src/cm/commandRegistry.js"), "utf8") +
        fs.readFileSync(path.join(ROOT, "src/lib/keyBindings.js"), "utf8");
const re = /name:\s*["']([a-zA-Z][\w:-]*)["']\s*,\s*(?:description:\s*["']([^"']*)["'])?/g;
const commands = new Map();
let m;
while ((m = re.exec(src))) {
        if (!commands.has(m[1])) commands.set(m[1], m[2] || "");
}

// ---- 2. PT translations --------------------------------------------------
const ptTranslations = {
        focusEditor: "Focar editor",
        findFile: "Localizar arquivo no workspace",
        closeCurrentTab: "Fechar aba atual",
        newPane: "Criar novo painel do editor",
        moveTabToNewPane: "Mover aba atual para novo painel",
        closePane: "Fechar painel ativo do editor",
        focusNextPane: "Focar próximo painel",
        focusPreviousPane: "Focar painel anterior",
        closeAllTabs: "Fechar todas as abas",
        togglePinnedTab: "Fixar/desafixar aba atual",
        newFile: "Criar novo arquivo",
        openFile: "Abrir arquivo",
        openFolder: "Abrir pasta",
        saveFile: "Salvar arquivo atual",
        saveFileAs: "Salvar como",
        saveAllChanges: "Salvar todas as alterações",
        nextFile: "Abrir próxima aba",
        prevFile: "Abrir aba anterior",
        nextFileHistory: "Próxima aba do histórico",
        prevFileHistory: "Aba anterior do histórico",
        showSettingsMenu: "Mostrar menu de configurações",
        renameFile: "Renomear arquivo ativo",
        run: "Pré-visualizar HTML e Markdown",
        openInAppBrowser: "Abrir no navegador integrado",
        toggleFullscreen: "Alternar tela cheia",
        toggleSidebar: "Alternar barra lateral",
        toggleMenu: "Alternar menu principal",
        toggleEditMenu: "Alternar menu de edição",
        selectall: "Selecionar tudo",
        gotoline: "Ir para a linha...",
        find: "Localizar",
        copy: "Copiar",
        cut: "Cortar",
        paste: "Colar",
        share: "Compartilhar",
        problems: "Mostrar erros e avisos",
        replace: "Substituir",
        openCommandPalette: "Abrir paleta de comandos",
        modeSelect: "Alterar modo de linguagem...",
        toggleQuickTools: "Alternar ferramentas rápidas",
        selectWord: "Selecionar palavra atual",
        openLogFile: "Abrir arquivo de log",
        increaseUiZoom: "Aumentar zoom da interface",
        decreaseUiZoom: "Diminuir zoom da interface",
        increaseFontSize: "Aumentar fonte do editor",
        decreaseFontSize: "Diminuir fonte do editor",
        openPluginsPage: "Abrir página de plugins",
        openFileExplorer: "Explorador de arquivos",
        copyDeviceInfo: "Copiar informações do dispositivo",
        changeAppTheme: "Alterar tema do app",
        changeEditorTheme: "Alterar tema do editor",
        openTerminal: "Abrir terminal",
        "xcoder:showWelcome": "Mostrar boas-vindas",
        "run-tests": "Executar testes",
        "dev:openInspector": "Abrir inspetor",
        "dev:toggleDevTools": "Alternar ferramentas de desenvolvedor",
        duplicateSelection: "Duplicar seleção",
        copylinesdown: "Copiar linhas para baixo",
        copylinesup: "Copiar linhas para cima",
        movelinesdown: "Mover linhas para baixo",
        movelinesup: "Mover linhas para cima",
        removeline: "Remover linha",
        insertlineafter: "Inserir linha depois",
        selectline: "Selecionar linha",
        selectlinesdown: "Selecionar linha abaixo",
        selectlinesup: "Selecionar linha acima",
        selectlinestart: "Selecionar até o início da linha",
        selectlineend: "Selecionar até o fim da linha",
        indent: "Recuar (indentar)",
        outdent: "Desfazer recuo",
        indentselection: "Recuar seleção",
        newline: "Inserir nova linha",
        joinlines: "Juntar linhas",
        deletetolinestart: "Excluir até o início da linha",
        deletetolineend: "Excluir até o fim da linha",
        togglecomment: "Alternar comentário",
        comment: "Comentar linha",
        uncomment: "Remover comentário da linha",
        toggleBlockComment: "Alternar comentário de bloco",
        undo: "Desfazer",
        redo: "Refazer",
        simplifySelection: "Simplificar seleção",
        foldCode: "Dobrar linhas selecionadas (se possível)",
        unfoldCode: "Desdobrar intervalos nas linhas selecionadas",
        foldAll: "Dobrar tudo",
        unfoldAll: "Desdobrar tudo",
        formatDocument: "Formatar documento (Language Server)",
        renameSymbol: "Renomear símbolo (Language Server)",
        showSignatureHelp: "Mostrar ajuda de assinatura",
        nextSignature: "Próxima assinatura",
        prevSignature: "Assinatura anterior",
        jumpToDefinition: "Ir para definição (Language Server)",
        jumpToDeclaration: "Ir para declaração (Language Server)",
        jumpToTypeDefinition: "Ir para definição de tipo (Language Server)",
        jumpToImplementation: "Ir para implementação (Language Server)",
        findReferences: "Encontrar todas as referências (Language Server)",
        closeReferencePanel: "Fechar painel de referências",
        findReferencesInTab: "Encontrar referências em nova aba (Language Server)",
        restartAllLspServers: "Reiniciar todos os servidores LSP",
        stopAllLspServers: "Parar todos os servidores LSP",
        documentSymbols: "Ir para símbolo no documento...",
        openLintPanel: "Abrir painel de diagnósticos",
        closeLintPanel: "Fechar painel de diagnósticos",
        nextDiagnostic: "Ir para o próximo diagnóstico",
        previousDiagnostic: "Ir para o diagnóstico anterior",
        closeTabsToRight: "Fechar abas à direita",
        closeTabsToLeft: "Fechar abas à esquerda",
        closeOtherTabs: "Fechar outras abas",
        splitPaneRight: "Dividir painel à direita",
        splitPaneDown: "Dividir painel abaixo",
        focusPaneLeft: "Focar painel à esquerda",
        focusPaneRight: "Focar painel à direita",
        focusPaneUp: "Focar painel acima",
        focusPaneDown: "Focar painel abaixo",
        deleteToLineEnd: "Excluir até o fim da linha",
        formatCode: "Formatar código",
        deleteTrailingWhitespace: "Excluir espaços no fim das linhas",
};

// ---- 3. Shared UI keys ----------------------------------------------------
const newKeys = {
        "en-us": {
                "about description":
                        "A fast, offline-first code editor and web IDE for Android. Forked from Acode, rebuilt with AI assistance, Git integration and a Linux terminal in your pocket.",
                "about acknowledgments": "Acknowledgments",
                "credits acode": "Acode app",
                "credits acode desc": "XCoder is a fork of the awesome Acode editor",
                "credits libraries": "Open-source libraries",
                "credits contributors": "Contributors",
                "credits contributors desc":
                        "Everyone who improves XCoder on GitHub",
                "credits community": "Community",
                "credits community desc":
                        "Testers, translators and bug reporters — thank you!",
                "developer menu": "Developer menu",
                "clear cache": "Clear cache",
                "copy build info": "Copy build info",
                "copied to clipboard": "Copied to clipboard",
                "settings-category-data": "Data & backup",
        },
        "pt-br": {
                "about description":
                        "Um editor de código rápido, offline-first e IDE web para Android. Fork do Acode, reconstruído com assistência de IA, integração Git e um terminal Linux no seu bolso.",
                "about acknowledgments": "Agradecimentos",
                "credits acode": "Aplicativo Acode",
                "credits acode desc":
                        "O XCoder é um fork do incrível editor Acode",
                "credits libraries": "Bibliotecas de código aberto",
                "credits contributors": "Contribuintes",
                "credits contributors desc":
                        "Todos que melhoram o XCoder no GitHub",
                "credits community": "Comunidade",
                "credits community desc":
                        "Testadores, tradutores e quem reporta erros — obrigado!",
                "developer menu": "Menu de desenvolvedor",
                "clear cache": "Limpar cache",
                "copy build info": "Copiar informações da compilação",
                "copied to clipboard": "Copiado para a área de transferência",
                "settings-category-data": "Dados e backup",
        },
};

// cmd:* keys for pt-br
for (const [name, desc] of commands) {
        newKeys["pt-br"][`cmd:${name}`] = ptTranslations[name] || desc || name;
}

// ---- 4. Insert into files -------------------------------------------------
/**
 * Line-based insertion (keeps the file's historical key order and
 * formatting intact — no huge diffs). New keys are inserted right after
 * the opening brace.
 */
function insertKeys(file, keys) {
        const text = fs.readFileSync(file, "utf8");
        const json = JSON.parse(text);
        const lines = text.split("\n");
        const toAdd = [];
        for (const [k, v] of Object.entries(keys)) {
                if (json[k] === undefined) {
                        toAdd.push(`\t${JSON.stringify(k)}: ${JSON.stringify(v)},`);
                        json[k] = v;
                }
        }
        if (toAdd.length) {
                lines.splice(1, 0, ...toAdd);
                fs.writeFileSync(file, lines.join("\n"));
        }
        return toAdd.length;
}

const addedEn = insertKeys(EN, newKeys["en-us"]);
const addedPt = insertKeys(PT, newKeys["pt-br"]);
console.log(`en-us: +${addedEn} keys | pt-br: +${addedPt} keys (of ${commands.size} commands)`);
