# Interface

[🇧🇷 Português](#português) | [🇺🇸 English](#english)

---

<a id="português"></a>

## 🇧🇷 Português

A interface do XCoder segue o padrão de IDEs modernas: **editor no centro, abas no topo, apps na barra lateral e terminal em painel**. Quem vem do VS Code ou do Acode se sente em casa em segundos.

## Editor e abas

Cada arquivo aberto ocupa uma **aba** no topo do editor. Você pode dividir a tela em **painéis** — `Ctrl-\` divide à direita, `Ctrl-Shift-\` divide para baixo e `Ctrl-Alt-\` move a aba atual para um novo painel — útil para comparar arquivos ou escrever código e preview lado a lado. Navegue entre abas com `Ctrl-Tab` / `Ctrl-Shift-Tab` e feche com `Ctrl-Q` (atual) ou `Ctrl-Shift-Q` (todas).

O marcador de bolinha no título da aba indica alterações não salvas. Com o autosave ativado em **Configurações › Editor**, esse cuidado desaparece.

## Barra lateral (apps)

O botão `Ctrl-B` (ou o gesto de deslizar da borda esquerda) abre a barra lateral com os apps disponíveis:

- **Explorador de arquivos** (`Ctrl-Shift-E`) — árvore do projeto, criação, renomeação e exclusão, com menu de contexto no toque longo.
- **Busca em arquivos** — pesquisa textual em todo o projeto, com filtro por extensão.
- **Git** — status do repositório, staging, commits, push/pull e histórico. Veja [[Git]].
- **Chat de IA** — conversa com o modelo configurado, com acesso ao contexto do arquivo aberto. Veja [[Assistente-IA]].
- **Plugins** — gerenciamento do que está instalado e exploração do marketplace. Veja [[Plugins]].
- **Configurações** (`Ctrl-,`) — todas as preferências do app, editor, IA e atalhos.

Cada app é um painel independente; abrir um novo não fecha o que você estava usando — a barra lateral alterna entre eles.

## Terminal

``Ctrl-` `` abre o **terminal** em painel inferior. É um emulador xterm com comandos reais para navegar arquivos, ler/editar texto e operar Git — o estado do repositório é compartilhado com o painel Git. Tabs de terminal permitem manter mais de uma sessão. Não é um shell Linux completo (sem apt/npm do sistema), mas cobre o fluxo de trabalho de edição e versionamento.

## Paleta de comandos

`Ctrl-Shift-P` abre a **paleta de comandos**, o canivete suíço do app: todos os comandos registrados (mais de 100, incluindo os de plugins), com **busca fuzzy** — digite "svfl" e ela encontra "Salvar arquivo". As descrições aparecem no seu idioma e os **comandos recentes ficam no topo** da lista. Se você só decorar um atalho deste guia, que seja este.

## Menu e notificações

O menu principal (☰ ou `F3`) reúne ações de arquivo, edição e ferramentas. Avisos (salvamentos, erros de rede, resultados de comandos) aparecem como **toasts** na parte inferior; erros de código são sinalizados em **Problemas** (`Ctrl-Shift-M`).

## Menu oculto de desenvolvedor

Na página **Sobre**, tocar **7 vezes** no número da versão abre o menu de desenvolvedor: limpar cache, reiniciar o app, abrir o console e copiar informações de build. Ele existe para diagnóstico — não há nada de "manutenção" espalhado pelas configurações comuns. Detalhes em [[Solucao-de-Problemas]].

---

<a id="english"></a>

## 🇺🇸 English

The XCoder interface follows the modern IDE pattern: **editor in the center, tabs on top, apps in the sidebar and the terminal as a panel**. Anyone coming from VS Code or Acode feels at home within seconds.

## Editor and tabs

Each open file gets a **tab** at the top of the editor. You can split the screen into **panels** — `Ctrl-\` splits to the right, `Ctrl-Shift-\` splits downward and `Ctrl-Alt-\` moves the current tab to a new panel — handy for comparing files or writing code and preview side by side. Move between tabs with `Ctrl-Tab` / `Ctrl-Shift-Tab` and close with `Ctrl-Q` (current) or `Ctrl-Shift-Q` (all).

The dot marker on the tab title flags unsaved changes. With autosave enabled in **Settings › Editor**, that worry disappears.

## Sidebar (apps)

The `Ctrl-B` toggle (or the edge-swipe gesture from the left border) opens the sidebar with the available apps:

- **File explorer** (`Ctrl-Shift-E`) — project tree, create, rename and delete, with a context menu on long press.
- **File search** — text search across the whole project, with an extension filter.
- **Git** — repository status, staging, commits, push/pull and history. See [[Git]].
- **AI chat** — talk to the configured model, with access to the open file as context. See [[Assistente-IA|AI assistant]].
- **Plugins** — manage what is installed and browse the marketplace. See [[Plugins]].
- **Settings** (`Ctrl-,`) — every preference for the app, editor, AI and shortcuts.

Each app is an independent panel; opening a new one does not close what you were using — the sidebar switches between them.

## Terminal

``Ctrl-` `` opens the **terminal** as a bottom panel. It is an xterm emulator with real commands to navigate files, read/edit text and operate Git — the repository state is shared with the Git panel. Terminal tabs let you keep more than one session. It is not a full Linux shell (no system apt/npm), but it covers the editing and versioning workflow.

## Command palette

`Ctrl-Shift-P` opens the **command palette**, the app's swiss army knife: every registered command (100+, including plugin commands), with **fuzzy search** — type "svfl" and it finds "Save file". Descriptions appear in your language and **recent commands stay at the top** of the list. If you memorize a single shortcut from this guide, make it this one.

## Menu and notifications

The main menu (☰ or `F3`) gathers file, edit and tool actions. Notices (saves, network errors, command results) appear as **toasts** at the bottom; code errors are flagged under **Problems** (`Ctrl-Shift-M`).

## Hidden developer menu

On the **About** page, tapping the version number **7 times** opens the developer menu: clear cache, restart the app, open the console and copy build info. It exists for diagnostics — there is no "maintenance" clutter scattered through the regular settings. Details in [[Solucao-de-Problemas|Troubleshooting]].
