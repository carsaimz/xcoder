# Roadmap do XCoder / XCoder Roadmap

[🇧🇷 Português](#português) | [🇺🇸 English](#english)

> Onde o XCoder está indo — nos dois idiomas, no mesmo ficheiro.
> Where XCoder is heading — both languages, same file.

---

<a id="português"></a>

## 🇧🇷 Português

> Tudo aqui é **gratuito** — o Premium continua limitado a remover anúncios
> e ampliar os limites de IA. Itens marcados com 💡 vêm da comparação
> contínua com o upstream [Acode](https://github.com/Acode-Foundation/Acode)
> (CHANGELOG lido por completo até a v1.13.5).

## ✅ Concluído até a v1.8.5

- **v1.8.5 — barra lateral com rosto VS Code:** grupos na barra de
  atividades (principais / ferramentas / conta+definições no fundo),
  badges de atividade (mudanças Git, notificações), tooltip de toque
  longo com o nome do painel e cabeçalhos de vista em maiúsculas
  pequenas; fix do ícone dos side-buttons (`<spam>` → `<span>`).

- **v1.8.4 — QR das formas de apoio:** os códigos QR (Ko-fi, Patreon,
  M-Pesa…) guardados na base de dados do site passam agora pelo
  `normalizeMethod()` e renderizam na página Apoie; métodos só-QR deixam
  de ser descartados. No site, o /admin explica a rejeição de bases de
  dados antigas (CHECK de 8 canais) e aponta para /setup › «Aplicar schema».

- **v1.8.3 — Dev Tools vivas ao abrir:** o painel renderiza em TODA
  ativação do ícone (paleta) e as consultas usam a raiz do app; imports
  em falta no Gradiente/Formulário apanhados por teste comportamental
  que percorre as 18 ferramentas.

- **v1.8.2 — grid CSS + border-radius (18 tools):** duas ferramentas
  novas nas Dev Tools e no site, mais 5 plugins no marketplace (Regex
  Tester, HTML to JSX, CSS Beautify, SQL Format, Text Wrap) — 33 no total.

- **v1.8.1 — marketplace +5 plugins (28):** unidades CSS, entidades
  HTML, tabelas Markdown, RGB↔hex e aparar espaços a fim de linha.

- **v1.8.0 — sessão GitHub PAT + lista vertical de tools:** normalização
  do token (espaços/zero-width/BOM) antes de guardar e em cada pedido,
  erro 401 com mensagem clara, «Atualizar perfil» no sidebar; Dev Tools
  passam a lista vertical com título+descrição e ganham 7 ferramentas de
  programador (JSON, Base64, IDs/UUID, Timestamp, Cor, Lorem, Slug).

- **v1.7.9 — Path de modelos + libs offline + 7 plugins:** fix do
  download de modelos (criação da cadeia de diretórios na 1.ª instalação),
  Bibliotecas offline copiáveis para o projeto (htmx, Alpine, jQuery,
  Bootstrap, Bootstrap Icons, Boxicons, Font Awesome, Chart.js) e 7
  plugins novos (tag-wrapper, quote-converter, html-skeleton, sort-json,
  url-tools, slugify, blank-lines) — 23 no total.


- **v1.7.8 — atualização dentro do app + ferramentas de webdev:** a
  notificação/verificação de atualização baixa o APK da release
  dentro do app (progresso em percentagem, cancelável, instalação via
  FileProvider + REQUEST_INSTALL_PACKAGES, fallback para o navegador)
  e a sidebar ganhou Ferramentas Dev: geradores de box-shadow,
  gradientes (linear/radial/conic), cartões (CSS+HTML) e placeholders
  SVG, com pré-visualização ao vivo e Copiar/Inserir no cursor

- **v1.7.7 — bots de IA + modelos locais:** personas prontas (Revisor,
  Arquiteto, Professor, Tradutor, Regex, Terminal, Redator, SQL) numa
  pill do chat com criação de bots próprios; tela de Modelos locais
  com catálogo de 10 modelos (LLM/STT/TTS, ~56MB–1,25GB), downloads
  com progresso/retoma/cancelar, provider "Local (no aparelho)" e
  runtime transformers.js a servir modelos do disco — chat, voz→texto
  e texto→voz 100% offline após instalar

- **v1.7.6 — substituição em lote grava em disco:** o "Substituir tudo"
  do painel Buscar em ficheiros agora persiste as alterações no disco
  (era o único fluxo de busca/substituição que não gravava — os
  ficheiros ficavam abertos como abas não salvas). Confirmação com
  contagem de ocorrências e ficheiros, progresso ficheiro a ficheiro,
  resumo com falhas por ficheiro (ex. ficheiro só de leitura) e
  re-busca automática ao terminar; abas abertas são sincronizadas e
  marcadas como salvas (sem falso "não salvo"); codificação respeitada
  (aba aberta ou padrão do utilizador); paridade de grupos de captura
  `$1` no backend nativo (Java) com fallback literal; ficheiros sem
  alteração deixam de ser reportados. Interruptor "HD" no painel
  mantém o comportamento antigo (abrir como abas não salvas). +5
  testes (814 no total)
- **v1.7.5 — linter de sintaxe + API de linters para plugins:** o editor
  agora marca erros de sintaxe em qualquer linguagem com parser
  CodeMirror 6 (nós `isError` do Lezer — php, c/cpp, java, yaml, xml…
  sem depender de LSP nem embutir engines de lint); em ficheiros
  cobertos por LSP (JS/TS, HTML, CSS, JSON, Python, Lua) o verificador
  embutido dá lugar aos diagnósticos do servidor — nunca duplicados.
  API `xcoder.require("linter")` para plugins registrem os próprios
  linters (escopo por plugin, descarregados no uninstall — mesmo
  modelo da fileIcons); painel de Problemas lista os novos
  diagnósticos; interruptor "Verificação de erros de sintaxe" nas
  configurações do editor. Dependência `esprima` (não utilizada)
  removida; +14 testes (809 no total)
- **v1.7.4 — links do upstream corrigidos:** o crédito do Acode na
  página Sobre e no README apontava para o endereço morto
  `deewarz/acodeapp` (404); agora aponta para
  `Acode-Foundation/Acode` (dono renomeado, redirecionamento
  permanente); URLs apenas — sem mudança de comportamento nem de
  dependências (`@deadlyjack/ajax` é pacote npm real)
- **v1.7.3 — API oficial de fileIcons + pacotes de ícones (Acode #2887
  portado):** os ícones de ficheiros e pastas agora passam por uma API
  pública estável (`acode.require("fileIcons")` com `register`, `icon`
  e `onChange`) — o mesmo sistema de temas estilo VS Code/Zed do
  upstream, quase 1:1. O pacote embutido continua o padrão e mantém as
  classes `file_type_*` existentes; plugins podem registar os próprios
  pacotes (SVG por URL/pasta ou classes), com propriedade ligada ao
  script do plugin e des-registo automático em falha de load ou
  desinstalação. Nova opção "Pacote de ícones" em Configurações do app
  → Interface, com lista viva dos temas disponíveis; ícones de pastas
  agora refletem aberto/fechado e a raiz tem ícone próprio; ícones
  renderizados são atualizados ao trocar de tema (árvore de ficheiros,
  listas, abas do editor, pesquisa e painel de referências); +56
  testes dos 5 ficheiros de teste do upstream (795 no total)
- **v1.7.2 — quebra de linha suave com indentação (Acode #2886 +
  #2880):** linhas quebradas continuam na indentação da linha original
  (ou +1/+2 níveis, configurável) em vez de voltar à margem;
  oportunidades de quebra em pontuação estilo VS Code (fecha
  `)`/`]` juntos, quebra antes de aberturas, inclusive CJK); nova
  opção "Indentação da quebra de linha" em Configurações do editor →
  Texto e layout (Nenhuma / Mesma indentação / Indentar (+1 nível) /
  Indentação profunda (+2 níveis)), reconfigura ao vivo; +6 testes
  (739 no total)
- **v1.7.1 — conta à prova de falha + repositórios onde são usados:**
  - **Perfil corrigido de vez:** a renovação de token em voo podia
    ressuscitar a sessão recém-apagada pelo "Terminar sessão" (guarda
    de época em `lib/supabase.js`); o botão voltar do hardware lançava
    erro nas páginas de perfil e suporte (chave `action` do
    actionStack); confirmação descartada pelo voltar agora resolve
    como cancelado; logout à prova de falha de rede
  - **"Meus repositórios" movido da página GitHub** para onde os
    repositórios são usados: cartão "Repositório GitHub" no Git
    (sidebar) com o repositório ativo + seletor, e o chat de IA ganhou
    o contexto do repositório ativo com as ferramentas
    `github_read`/`github_write` (árvore, conteúdo com sha, Contents
    API, issues — escrita sempre com aprovação; token nunca sai do
    aparelho)
  - **Acode #2851 portado:** chamadas de plugin muito cedo durante o
    boot do Cordova não falham mais (fallback
    `cordova.require("cordova/exec")`)
  - +18 testes (733 em 87 ficheiros)

- **v1.7.0 — Sessões SSH v2 + Fontes v2 (v1.7.x itens 3 e 4):**
  - **SSH v2:** cor estável por host (derivada do nome, determinística),
    histórico de comandos por servidor (local, cap 100, prompts de
    senha/fase-chave nunca gravados, Ctrl+C/D/U abandonam a linha) e
    diretório inicial configurável por servidor (precedência: opção
    explícita > home salvo > caminho da URL > `/`); hosts apagados são
    limpos automaticamente
  - **Fontes v2:** preview ao vivo de cada fonte na própria lista
    (pangrama traduzido, pré-carregamento em background), peso da fonte
    do editor 400–900 com reconfiguração ao vivo do CodeMirror e página
    de fontes 100% internacionalizada (+28 chaves)
  - **Suporte normalizado:** classes `main scroll` no corpo (mesmo
    defeito latente do perfil v1.6.4) + import `logger` faltante no
    caminho de erro
  - **proot fd fix (Acode #2878):** o probe do `init-sandbox.sh` passou a
    usar o pid do shell e a semântica do realpath(3) — sem mais avisos
    "can't sanitize binding /proc/self/fd/N"
  - **Repo:** `congrats-pr.yml` agradece PRs da comunidade mesclados
    (grátis, sem Discord); `Ctrl-Shift-W` abre o Welcome (Acode #2773)
  - **Site:** últimas lacunas de i18n fechadas (editor do blog admin,
    tiers do /sponsor, placeholders dinâmicos) — +47 traduções EN
  - +22 testes (716 no total)
- **v1.6.4 — conserto definitivo da conta:** "Entrar"/"Criar conta" da
  página de perfil estavam mortos desde sempre — o getter `body` do
  WCPage devolve `null` após o setter substituir o `.main` interno
  (o div do perfil não tinha a classe `main`), e as leituras dos campos
  explodiam num TypeError silencioso; corpo agora mantém referência
  local `$body` + classes padrão `main scroll` (padrão Sobre). Fecha o
  ciclo iniciado em 1.6.1/1.6.2 (sessão válida, PAT persistido, ponte
  site → app); +7 testes de regressão com renderização real (694 no
  total)
- **v1.6.3 — Console REPL v2 + wiki bilíngue:**
  - **Console REPL v2 (v1.7.x item 3):** histórico persistente entre
    sessões (localStorage, dedupe, cap 50), snippets salvos com nome
    (salvar/listar/excluir na toolbar) e **imports do workspace** —
    `import {x} from "./lib/mod.js"` resolve arquivos relativos à pasta
    do arquivo aberto, empacota como Blob URLs e roda no sandbox
    (transitivo, com guardas de ciclo e cap de 64 módulos)
  - **Wiki bilíngue:** as 16 páginas (14 conteúdo + `_Sidebar` +
    `_Footer`) trazem secções 🇧🇷 + 🇺🇸 num único ficheiro;
    `publish-wiki.mjs` extrai a secção ativa (`WIKI_LANG=pt|en`) e o
    checker `wiki/checkWikiBilingual.mjs` entrou no CI
  - +35 testes (652 → 687)
- **v1.6.2 — PAT de verdade, ícones e conta unificada:**
  - **PAT persistido de verdade (fix crítico):** o kit de settings não
    grava valores de prompt — o PAT colado era descartado em silêncio
    ("conectei via PAT e os repos não aparecem"); agora ghSettings
    persiste `ghToken`/`gitRemoteUrl`/`ghBranch` e busca o perfil na
    hora; limpar o token encerra a sessão GitHub
  - **Ícones Fontes/Sessões SSH:** `svg:server`, `svg:type` (e `copy`,
    `trash-2`, `check`, `qr-code`) adicionados ao pack — o fallback
    anterior (`icon svg:nome`) não existe na fonte de ícones e renderizava
    nada; `select` agora também desenha ícones `svg:` como vetores
    (picker de repos, chooser de login, ações de commit)
  - **Conta unificada site ↔ app:** botão "Continuar com a conta do site"
    (nova rota `/auth/app-handoff` no site entrega a sessão já existente
    para o app via `xcoder://auth/oauth`); página de conta re-renderiza
    em `authchange`; sessão expirada é renovada em background;
    erros de login aparecem DENTRO do formulário (nunca mais "não faz nada")
  - **Settings reagrupadas:** Core → Aparência → Código e ferramentas →
    Conexões → Dados e backup → Sobre (novas strings pt/en)
  - **Bot de review em PRs (grátis):** workflow `pr-review.yml` comenta
    no PR com resumo bilíngue por área, sugestões por regras e checklist
    (substitui reviewers pagos tipo Greptile por algo nosso)
  - Actions atualizadas (checkout v7, setup-node v7, github-script v9,
    create-pull-request v8, stale v11); +8 testes (640 → 652)
- **v1.6.1 — GitHub App web flow de um toque + conta à prova de
  webview:** "Conectar com GitHub (navegador)" como 1ª opção (site troca
  o código pelo token no servidor, retorno `xcoder://github/session`
  com validação anti-CSRF); card da conta do sidebar git renderiza
  mesmo quando o status do git local falha; cliente Supabase do app com
  camada HTTP nativa (login e-mail/senha à prova de CORS); site publicou
  `/api/github/callback` + `/api/github/webhook` (HMAC) e o formulário
  de conta não falha mais em silêncio
- **v1.6.0 — roadmap v1.6.x completo + fix do sign-in GitHub:**
  - **Sessões SSH** (item 1): página própria lista os servidores SFTP
    salvos e abre o terminal remoto com um toque
  - **Console JS** (item 2): REPL real num **Web Worker em sandbox**
  - **Gerenciador de fontes** (item 3): fontes por URL aplicadas ao
    editor e à interface separadamente
  - **Onboarding do terminal** (item 4): explica Alpine × FailSafe e
    oferece "Reinstalar ambiente" num toque
  - **Fix crítico do Device Flow**: sessão salvava VAZIA; agora o token é
    consumido como string e a sessão sem token é rejeitada
- **v1.5.4 — GitHub App oficial + model picker com logos:** Client ID do
  GitHub App embutido (Device Flow de fábrica) e picker de modelos com
  logo real por marca, badge grátis/pago e busca instantânea
- **v1.5.3 — polimento de UI + GitHub sem clientes próprios:** botões
  ←/→ removidos do header; suportes de IA abaixo do modelo com scroll;
  ids de modelo sem prefixo `models/`; sign-in GitHub refeito + guia
  `docs/github-oauth-app.md`; Dependabot agrupado por github-actions
- Agente de IA com ferramentas, subagentes e streaming + pílulas
  "Pensar"/"Buscar" que desligam de verdade
- Provedores **Integrados sem chave**: Pollinations (texto + imagem),
  DuckDuckGo AI — e logos REAIS de 16 marcas no chat
- Editor multi-painel (split view) com abas por painel 💡
- Navegação por histórico de abas com histórico persistente 💡
- **Guia de indentação ativa** (opt-in, estilo VSCode) 💡
- Terminal Alpine (proot) com **auto-cura do modo FailSafe**
- Site embutido (aba Website), marketplace com 16+ plugins, conta
  compartilhada com o site (login único)
- **Site 100% bilíngue pt/en** — incluindo /user/*, submissão de plugins,
  fórum, posts e docs
- **Anúncio automático de release no fórum** (release estável → post do bot)
- Release assinado automático, build de preview por rótulo (app + site),
  CI com checagem de traduções e typos, Dependabot + bot de dependências

## 🗂️ Lotes alfabéticos (A–Z)

> **Como ler:** os lotes são temáticos (A–Z), não por prioridade —
> cada release escolhe itens de vários lotes. Item feito muda para
> `- [x]` e sobe para «✅ Concluído» na release correspondente.
> Tags: 💡 Acode (PR/issue upstream) · 🖥️ inspirado noutros editores
> (VS Code, Zed, Spck, JetBrains…) · ✨ ideia XCoder · 🔁 carregado do
> roadmap anterior.

## Lote A — Acessibilidade & Aparência

- [ ] **Alto contraste + paletas para daltonismo** ✨ — Temas
  deuteranopia/protanopia/tritanopia e modo alto contraste verificado contra
  WCAG AA nos tokens de sintaxe.
- [ ] **Editor visual de temas** 🔁 — Editor de tokens (fundo, primária,
  cores de sintaxe) com export/import JSON partilhável.
- [ ] **Tipografia por linguagem** 🖥️ inspirado no VS Code — Tamanho,
  altura de linha e família configuráveis por modo de linguagem (ex.: mono
  grande em Markdown).
- [ ] **TalkBack nos menus principais** ✨ — Rótulos de conteúdo nos
  ícones, alvos de toque ≥48dp e navegação de foco coerente no sidebar, abas
  e dialogs.
- [ ] **Respeitar prefers-reduced-motion** ✨ — Desativar animações
  decorativas (pulso, transições de página) quando o SO pede movimento
  reduzido.

## Lote B — Busca & Build

- [ ] **Streaming na busca global** 💡 Acode #2883 — Resultados a chegar em
  fluxo sem reiniciar a descoberta (upstream evita restarts e streamiza de
  forma eficiente).
- [ ] **Globs na busca/substituição** ✨ — Incluir/excluir por padrão
  (`src/**`, `*.min.js`) e histórico de buscas persistente entre sessões.
- [ ] **«Ir para ficheiro» fuzzy** 🖥️ inspirado no VS Code — Abertura
  rápida por nome com ranking (abertos recentes primeiro), acessível da
  barra superior.
- [ ] **Build recipes por projeto** ✨ — `scripts.json` com build/test/run
  executados no console com ambiente do projeto e botão de parar.
- [ ] **Pré-visualização inline das ocorrências** 🖥️ inspirado no Spck —
  Cada resultado mostra a linha com realce e contexto, permitindo substituir
  individualmente.

## Lote C — Código, Console & Colaboração

- [ ] **Consola virtualizada** 💡 Acode #2882 — Milhares de linhas de log
  sem travar (upstream melhorou a virtualização do console).
- [ ] **Filtro por nível no console** ✨ — Filtrar log/warn/error com
  contagem por nível e limpar com gesto (deslizar).
- [ ] **Rainbow brackets + indent guides** 🖥️ inspirado no VS Code — Pares
  de chavetas coloridos por profundidade e guias de indentação opcionais nas
  configurações.
- [ ] **Backup agendado via ghBackend** 🔁 — Sincronizar settings + sessões
  de IA com backup/restore agendado e diff visual antes de aplicar.
- [ ] **Partilha de código via link/QR** ✨ — Gerar link temporário (gist
  anónimo) ou QR do ficheiro/seleção ativa para partilhar rapidamente.

## Lote D — Depuração & Dados

- [ ] **Watch expressions no console** 🖥️ inspirado no VS Code —
  Inspecionar objetos com árvore expansível e fixar expressões observadas
  entre execuções.
- [ ] **Painel de inspeção Eruda melhorado** ✨ — DOM/CSS em tempo real no
  preview web com editáveis inline (o módulo devTools já embarca Eruda).
- [ ] **Timeline local por ficheiro** 🖥️ inspirado no VS Code Timeline —
  Snapshots automáticos ao guardar (janela de tempo configurável) com diff e
  restauração.
- [ ] **Export/restore do estado do app** ✨ — Zip com settings, plugins,
  modelos instalados e sessões — para migrar de aparelho.
- [ ] **Visualizador de Logcat** ✨ — Ver logcat filtrado (por tag/app)
  enquanto executa builds Cordova, sem sair do app.

## Lote E — Editor & Extensões

- [ ] **Renderer canvas experimental** 💡 Acode #2988 — Motor de
  renderização por canvas atrás de flag (upstream lançou como experimental
  com @acode.app/canvas-view).
- [ ] **Sticky scroll** 🖥️ inspirado no VS Code — Cabeçalho do bloco atual
  fixo no topo ao navegar dentro de funções longas.
- [ ] **Minimapa opcional** 🖥️ inspirado no VS Code — Miniatura do
  ficheiro com viewport arrastável; desligada por defeito no telemóvel.
- [ ] **Multi-cursor: findAll e selectMore** 💡 Acode #2129 — Corrigir
  selectMoreAfter/Before e findAll (upstream reporta não funcionarem).
- [ ] **Dobragem fiável em ficheiros grandes** 💡 Acode #2912 — «Dobrar
  tudo» não deve congelar em ficheiros grandes (fix upstream a verificar no
  nosso build).
- [ ] **Quicktool adapter para plugins** 💡 Acode #2898 — Plugins podem
  registar ações rápidas na barra (adaptador upstream).

## Lote F — Ficheiros & Formatação

- [ ] **«Guardar como» fiável** 💡 Acode #1583 — Issue antigo (10💬):
  caminho, conflito de ficheiro existente e codificação corretos.
- [ ] **Botão «Recarregar» na aba** 💡 Acode #2390 — Reverter o ficheiro
  para o estado do disco com confirmação quando há alterações não guardadas.
- [ ] **Renomear unificado** 💡 Acode #2958 — Consolidar o fluxo de rename
  do file-browser com tratamento de erros claro (refatoração upstream).
- [ ] **Formatters entre modos de plugin** 💡 Acode #2976 — Modos de plugin
  podem reusar o formatter de outro modo (upstream #2976).
- [ ] **Fixar/favoritos no explorador** ✨ — Pins no topo do explorador
  para ficheiros de trabalho frequentes, sincronizados por projeto.

## Lote G — Git & GitHub

- [ ] **Diff side-by-side no app Git** 🖥️ inspirado no VS Code — Duas
  colunas sincronizadas com realce por linha (atualmente só inline).
- [ ] **Gists: guardar/abrir** ✨ — Guardar seleção/ficheiro como gist
  (secret ou público) e abrir gist existente como aba.
- [ ] **Status das GitHub Actions** ✨ — Badge dos workflows do repo aberto
  no painel Git (verde/vermelho + link para o run).
- [ ] **Pull requests do app** ✨ — Criar branch + PR a partir do app Git
  (API REST) e listar PRs abertos do repo.

## Lote H — HTML & Hosting

- [ ] **Tamanho de dispositivo padrão no preview** 💡 Acode #2966 — Definir
  viewport padrão (ex.: 390×844) para o preview in-app (upstream #2966).
- [ ] **Auto-refresh do preview HTML** 💡 Acode #2765 — Issue aberto:
  recarregar o preview ao guardar (live reload simples sem servidor).
- [ ] **Webview de preview melhorada** 💡 Acode #2924 — Melhorias upstream
  na webview (#2924) — avaliar e portar para o nosso preview.
- [ ] **Servidor HTTP local com partilha LAN** ✨ — Servir a pasta do
  projeto na rede (URL + QR) para testar no telemóvel/PC ao lado.

## Lote I — Interface & Internacionalização

- [ ] **Idiomas es/fr no app** 🔁 — A infra bilíngue pt/en e os dicionários
  modulares por área abrem caminho para es/fr.
- [ ] **Fullscreen imersivo + orientação** 💡 Acode #2919 — API de
  fullscreen imersivo e controlo de orientação (upstream #2919).
- [ ] **Split view** 🖥️ inspirado no VS Code — Dois ficheiros lado a lado
  no telemóvel (paisagem) e tablet; sync de scroll opcional.
- [ ] **Nav bar configurável** ✨ — Reordenar/esconder ícones da barra
  inferior e escolher apps do sidebar fixados.
- [ ] **Arrastar para reordenar abas** ✨ — Reordenação por arrasto com
  haptics e drop entre abas abertas.

## Lote J — JavaScript & JSON

- [ ] **Runner de scripts do package.json** ✨ — Detetar scripts npm e
  executar com node disponível (ou avisar a falta) — saída no console.
- [ ] **Schemas JSON catalogadas** 🖥️ inspirado no VS Code — Validação +
  hover para tsconfig/package.json/manifest com schemas embutidas offline.
- [ ] **Console como REPL persistente** 🖥️ inspirado no Zed — Histórico
  persistente entre sessões e envio de seleção para o REPL.
- [ ] **Deteção de imports ausentes** ✨ — No preview, import que falha →
  sugerir CDN ou copiar lib local (integra com o app libs).

## Lote K — Keyboard & Atalhos

- [ ] **Paleta de comandos** 🖥️ inspirado no VS Code — Todas as ações do
  app pesquisáveis num só lugar (com usage ranking).
- [ ] **Keybindings reconfiguráveis** 🖥️ inspirado no VS Code — Remapear
  atalhos com suporte a chords; export/import do perfil de teclas.
- [ ] **Gestos multi-toque** ✨ — 3 dedos ←/→ para desfazer/refazer, 4
  dedos para trocar de aba (configurável).
- [ ] **Modo vi/emacs básico** 🖥️ inspirado no Vim — Movimentos/modos
  essenciais como plugin (normal/insert/visual para vi).

## Lote L — Linguagens & Linters

- [ ] **Tailwind CSS LSP** 💡 Acode #2896 — Issue aberto: tailwind LSP não
  funciona — investigar e portar o fix se aplicável.
- [ ] **Realce JS/TS mais rico** 💡 Acode #2971 — JSDoc e métodos com
  realce próprio (upstream #2971) no nosso modo JS/TS.
- [ ] **Mermaid no markdown** 💡 Acode #2987 — Renderizar diagramas mermaid
  no preview de markdown (upstream usa a lib pele).
- [ ] **GFM no modo markdown** 💡 Acode #2922 — Tabelas, checkboxes e
  strikethrough (GFM) no realce e no preview.
- [ ] **Sass ao vivo** 🔁 — Compilador Sass do marketplace compilando ao
  vivo para CSS no guardar (plugin portado).

## Lote M — Marketplace & Modelos

- [ ] **Review inline na página do plugin** 💡 Acode #2925 — Botão de
  avaliação direto na página do plugin (upstream #2925) sobre a nossa API de
  ratings.
- [ ] **+modelos locais** ✨ — Novos LLM/STT/TTS no catálogo
  (Qwen3/Phi/Gemma novos) com tamanhos 50MB–2GB.
- [ ] **Filtros por tarefa no catálogo** ✨ — Separadores
  chat/código/STT/TTS com requisitos de RAM e espaço estimados.
- [ ] **Selo «Made for XCoder»** ✨ — Checklist de qualidade (manifest,
  i18n, permissões) e selo nas submissões aprovadas.

## Lote N — Navegação & Notificações

- [ ] **Breadcrumbs** 🖥️ inspirado no VS Code — Caminho do ficheiro
  navegável no topo do editor (pastas + símbolo atual).
- [ ] **Outline de símbolos** 🖥️ inspirado no VS Code — Lista de símbolos
  do ficheiro via LSP documentSymbol com salto direto.
- [ ] **Centro de notificações no app** ✨ — Consumir os producer hooks de
  notificações do site (user_notifications já existem).
- [ ] **Pilha de ficheiros recentes** ✨ — Voltar ao ficheiro anterior com
  um toque (stack de navegação).

## Lote O — Offline & Organização

- [ ] **Workspaces com estado** 🖥️ inspirado no VS Code — Abrir projeto
  restaura abas, scroll e sessão de IA (por workspace).
- [ ] **+bibliotecas offline** ✨ — Tailwind offline, Prism, KaTeX no
  seletor de libs (mesmo padrão de cópia para o projeto).
- [ ] **Cache SFTP/FTP robusta** 💡 Acode #1276 — Erro de cache antigo
  (#1276) — listar/purgar cache remota e invalidação por mtime.
- [ ] **Recuperação pós-crash** ✨ — Autossave em memória + restauração da
  sessão completa (abas não guardadas inclusive).

## Lote P — Performance & Plugins

- [ ] **Hang/flicker do CodeMirror novo** 💡 Acode #1968 — Issue mais
  quente (17💬): editor trava/cintila com CM novo — monitorizar upstream e
  portar fix.
- [ ] **Velocidade de carregamento de texto** 💡 Acode #2318 — Ficheiros
  grandes abrem mais rápido (streaming de ficheiro + render incremental).
- [ ] **Spam-paste performance** 💡 Acode #2364 — Colar repetidamente não
  deve degradar (batch de transações CM).
- [ ] **Arranque mais rápido — com cautela** 💡 Acode #2933 — Upstream
  lançou #2930/#2931 e REVERTEU (#2933): medir antes/depois no nosso build
  antes de copiar qualquer técnica.
- [ ] **Efeito ao segurar delete** 💡 Acode #2303 — Apagamento contínuo com
  artefactos visuais (#2303) — corrigir no nosso input pipeline.

## Lote Q — Qualidade & Testes

- [ ] **Suíte ftp/sftp/file-ops** 💡 Acode #2928 — Inspirar-se nos testes
  upstream (#2928) para cobrir os nossos providers remotos.
- [ ] **Fumo de UI em emulador** ✨ — Job agendado no CI que instala o APK
  num emulador e valida boot + apps do sidebar.
- [ ] **Regressão visual de temas** ✨ — Screenshots golden por tema em
  testes (apanhar regressões de cor/contraste).
- [ ] **Revisitar r8** 💡 Acode #2891 — Já estudado e adiado: exigir
  passada em dispositivo real (roturas só aparecem em runtime).

## Lote R — Runtime & Refatoração

- [ ] **Renomear símbolo via LSP** 🖥️ inspirado no LSP — Rename workspace
  edit com pré-visualização de ficheiros afetados.
- [ ] **Runner avançado** 🔁 — Executar scripts com env vars/argumentos
  guardados por projeto.
- [ ] **Visualizador de documentos** 🔁 — Abrir pdf/docx apenas para
  leitura a partir do explorador.
- [ ] **API USB experimental** 💡 Acode #2719 — Issue upstream pedindo
  acesso a USB — avaliar plugin OTG serial para hardware DIY.

## Lote S — Segurança & Sincronização

- [ ] **Segredos por projeto** ✨ — Além dos segredos de plugin: .env
  seguro por projeto com injeção no runner/console.
- [ ] **Sessões de terminal nomeadas** 💡 Acode #2894 — Sessões
  persistentes/nomeadas (retomar após fechar o app).
- [ ] **Build CLI sem terminal embutido** 💡 Acode #2897 — Opção de build
  que omite assets do terminal → APK menor para quem usa Termux.
- [ ] **Sync de settings entre dispositivos** 🔁 — ghBackend como
  transporte (mesma conta) com resolução de conflitos manual.

## Lote T — Terminal, Temas & TTS

- [ ] **Terminal não arranca em alguns aparelhos** 💡 Acode #2824 — Issue
  aberto — reproduzir em aparelhos reportados (proot/ABI) e portar correção.
- [ ] **Temas e fontes do terminal** ✨ — Paletas (Dracula/Nord/…) e font
  mono selecionáveis para o terminal embutido.
- [ ] **Vozes TTS configuráveis** ✨ — Velocidade/voz/tom do texto→voz
  local guardadas por persona do chat.

## Lote U — UI/UX & Updates

- [ ] **Anúncios recompensados** 🔁 (Acode Acode #1918/#1779) — Assistir um
  anúncio dá tempo extra sem anúncios; horário silencioso (padrão upstream).
- [ ] **Painel do bot de release** 🔁 — Administrar posts automáticos
  (editar/apagar anúncio do release) na área /admin do site.
- [ ] **Delta updates** ✨ — Baixar só o diff entre APKs quando a release o
  publicar (menor consumo de dados).
- [ ] **Changelog in-app renderizado** ✨ — Página Apoie/About liga ao
  CHANGELOG.md renderizado (versão atual em destaque).

## Lote V — Voz & Visualização

- [ ] **Preview Mermaid reutilizável** 💡 Acode #2987 — Painel de diagramas
  (pele) reutilizável por plugins/READMEs.
- [ ] **Voz→texto nas entradas** ✨ — Ditar nas caixas de busca/prompt
  usando o runtime STT local já embarcado.
- [ ] **Grafo de imports do projeto** 🖥️ inspirado no Zed — Diagrama
  simples de dependências (mermaid gerado) para orientar refatorações.

## Lote W — Web & Widgets

- [ ] **Widgets de homescreen por projeto** ✨ — Atalho «abrir projeto X»
  direto do launcher (shortcuts do Android).
- [ ] **Site PWA instalável** ✨ — Manifest + service worker mínimo para
  leitura offline de docs/ferramentas.
- [ ] **Web Share Target** ✨ — Partilhar ficheiro de outro app → XCoder
  abre direto (import para o projeto).

## Lote X — eXport & eXperimental

- [ ] **Exportar projeto em zip** ✨ — Zip da pasta do projeto (com/sem
  node_modules) partilhável por intents.
- [ ] **Deep link para Codespaces** 🖥️ inspirado no GitHub Codespaces —
  Abrir o repo atual num Codespace/gitpod quando o aparelho não dá conta.
- [ ] **Plugins em worker dedicado** ✨ — Experimental: correr plugins
  pesados num Web Worker isolado (sem travar o editor).

## Lote Y — YAML & Config-as-code

- [ ] **.xcoder/config.json por projeto** ✨ — Settings do projeto
  versionadas (tabs, build recipe, formatação) no repo.
- [ ] **Validação YAML com esquema** ✨ — GitHub Actions/workflows
  validados offline (schema embutida) com hover.

## Lote Z — Zen & Zoom

- [ ] **Zen mode** 🖥️ inspirado no VS Code — Esconder tudo
  (sidebar/abas/nav) com saída fácil — foco total no texto.
- [ ] **Zoom global** ✨ — Escalar editor + UI de uma vez (pinça ou Ctrl
  +/- com teclado).
- [ ] **Modo leitura** ✨ — Dobrar tudo + fullscreen + tipografia de
  leitura para revisar código longo.

## 🧭 Direção contínua

- Manter o CI verde e a pt-br 100% traduzida (`npm run lang:check`).
- **Acode triado até 26/10 (v1.13.x):** PRs mesados recentes catalogados
  nos Lotes — canvas renderer (#2988), mermaid no markdown (#2987),
  webview melhorada (#2924), fullscreen/orientação (#2919), GFM (#2922),
  quicktool de plugins (#2898), consola virtualizada (#2882), busca em
  streaming (#2883), dobragem fiável (#2912), formatter entre modos
  (#2976), realce JSDoc (#2971), preview com tamanho padrão (#2966) e
  review inline (#2925). **Atenção:** #2930/#2931 (startup) foram
  REVERTIDOS upstream (#2933) — medir no nosso build antes de copiar.
  Issues quentes mapeados nos Lotes: #1968 (17💬), #1583, #2318, #2129,
  #2824, #2765, #1276, #2894, #2896, #2719, #2897, #2390, #2303, #2364,
  #2590. Já portados: #2886+#2880 (wrap indentado), #2887 (fileIcons),
  #2863 (menu de contexto de abas), #2840 (recuperação SFTP), #2851
  (corrida do cordova.exec). **#2891 (r8) segue ADIADO** — regras
  sólidas, mas exige passada em dispositivo real (roturas só aparecem
  em runtime; precedente v1.4.8 no nosso fork).
- Verificar o CHANGELOG do Acode a cada release upstream e portar o que
  for útil (workflows, plugins, IA, editor).
- Nunca travar recursos atrás do Premium — doar é opcional.

---

<a id="english"></a>

## 🇺🇸 English

> Everything here is **free** — Premium stays limited to removing ads and
> raising AI limits. Items marked with 💡 come from continuous comparison
> with upstream [Acode](https://github.com/Acode-Foundation/Acode)
> (their CHANGELOG fully read up to v1.13.5).

## ✅ Done through v1.8.5

- **v1.8.5 — VS Code-style sidebar:** activity bar groups (primary /
  tools / bottom-pinned account+settings), activity badges (Git
  changes, notifications), long-press tooltip with the panel name and
  small-caps view headers; side-button icon typo fix (`<spam>` →
  `<span>`).

- **v1.8.4 — support QR codes:** payment QR images (Ko-fi, Patreon,
  M-Pesa…) stored in the site database now survive `normalizeMethod()`
  and render on the support page; QR-only methods are no longer dropped.
  On the site, /admin explains old-database rejection (8-channel CHECK)
  and points to /setup › «Aplicar schema».

- **v1.8.3 — Dev Tools alive on open:** the panel renders on EVERY
  activation of the palette icon and queries use the app root; missing
  Gradient/Form imports caught by a behavioral test driving all 18 tools.

- **v1.8.2 — CSS grid + border-radius (18 tools):** two new tools in the
  Dev Tools and on the site, plus 5 marketplace plugins (Regex Tester,
  HTML to JSX, CSS Beautify, SQL Format, Text Wrap) — 33 total.

- **v1.8.1 — marketplace +5 plugins (28):** CSS units, HTML entities,
  Markdown tables, RGB↔hex and trim trailing spaces.

- **v1.8.0 — GitHub PAT session + vertical tool list:** token
  normalization (whitespace/zero-width/BOM) before save and on every
  request, friendly 401 mapping, «Refresh profile» on the sidebar; Dev
  Tools become a vertical list with title+description and gain 7
  programmer tools (JSON, Base64, IDs/UUID, Timestamp, Color, Lorem, Slug).

- **v1.7.9 — model path fix + offline libs + 7 plugins:** model download
  fix (full directory chain created on first install), offline Libraries
  copyable into projects (htmx, Alpine, jQuery, Bootstrap, Bootstrap
  Icons, Boxicons, Font Awesome, Chart.js) and 7 new plugins
  (tag-wrapper, quote-converter, html-skeleton, sort-json, url-tools,
  slugify, blank-lines) — 23 total.


- **v1.7.8 — in-app update + webdev tools:** the update
  notification/check now downloads the release APK inside the app
  (percentage progress, cancelable, install via FileProvider +
  REQUEST_INSTALL_PACKAGES, browser fallback) and the sidebar gained
  Dev Tools: box-shadow, gradient (linear/radial/conic), card
  (CSS+HTML) and SVG placeholder generators with live preview and
  Copy/Insert at cursor

- **v1.7.7 — AI bots + local models:** ready-made personas (Reviewer,
  Architect, Teacher, Translator, Regex, Terminal, Tech Writer, SQL)
  in a chat pill with user-created bots; Local models screen with a 10
  model catalog (LLM/STT/TTS, ~56MB–1.25GB), downloads with
  progress/resume/cancel, a "Local (on device)" provider and a
  transformers.js runtime serving models from disk — chat, speech→text
  and text→speech run fully offline after install

- **v1.7.6 — batch replace writes to disk:** "Replace all" in the
  Search in files panel now persists changes to disk (the only
  search/replace flow that never saved — files were left open as
  unsaved tabs). Confirmation with occurrence/file counts, per-file
  progress, summary with per-file failures (e.g. read-only files) and
  an automatic re-search when done; open tabs are synced and marked as
  saved (no false "unsaved" state); encoding respected (open tab or
  user default); `$1` capture-group parity in the native (Java)
  backend with a literal fallback; unchanged files are no longer
  reported. The "HD" toggle keeps the old behavior (open as unsaved
  tabs). +5 tests (814 total)
- **v1.7.5 — syntax linter + linter API for plugins:** the editor now
  flags syntax errors in any language with a CodeMirror 6 parser (Lezer
  `isError` nodes — php, c/cpp, java, yaml, xml… no LSP required and no
  lint engines bundled); on LSP-covered files (JS/TS, HTML, CSS, JSON,
  Python, Lua) the built-in checker steps aside for server diagnostics
  — never duplicated. `xcoder.require("linter")` API lets plugins
  register their own linters (per-plugin scope, unregistered on
  uninstall — same model as fileIcons); the Problems panel lists the
  new diagnostics; "Syntax error checking" toggle in editor settings.
  Unused `esprima` dependency removed; +14 tests (809 total)
- **v1.7.4 — dead upstream links fixed:** the Acode credit in the
  About page and README pointed to the dead `deewarz/acodeapp` URL
  (404); now points to `Acode-Foundation/Acode` (owner renamed,
  permanent redirect); URLs only — no behavior or dependency changes
  (`@deadlyjack/ajax` is a real npm package)
- **v1.7.3 — official fileIcons API + icon packs (Acode #2887
  ported):** file and folder icons now go through a stable public API
  (`acode.require("fileIcons")` with `register`, `icon` and
  `onChange`) — the same VS Code/Zed-style icon theme system as
  upstream, ported nearly 1:1. The builtin pack stays the default and
  keeps the existing `file_type_*` classes; plugins can register their
  own packs (SVG by URL/folder or classes), with ownership bound to
  the plugin script and automatic unregistration on load failure or
  uninstall. New "Icon pack" option in App settings → Interface with a
  live list of available themes; folder icons now reflect
  expanded/collapsed state and roots get their own icon; rendered
  icons refresh on theme change (file tree, lists, editor tabs, search
  and references panel); +56 tests from upstream's 5 test files (795
  total)
- **v1.7.2 — indented soft wrap (Acode #2886 + #2880):** wrapped lines
  now continue at the original line's indentation (or +1/+2 levels,
  configurable) instead of returning to the margin; VS Code-style
  punctuation break opportunities (closing brackets stay together,
  breaks happen before openings, CJK included); new "Word wrap
  indentation" option in Editor settings → Text & layout (None / Same
  indent / Indent (+1 level) / Deep indent (+2 levels)), live
  reconfiguration; +6 tests (739 total)
- **v1.7.1 — bullet-proof account + repos where they are used:**
  - **Profile fixed for good:** an in-flight token refresh could
    resurrect the session just cleared by "Sign out" (epoch guard in
    `lib/supabase.js`); the hardware back button threw on the
    profile/support pages (actionStack `action` key); back-dismissed
    confirms now resolve as cancelled; sign-out survives network
    failures
  - **"Meus repositórios" moved out of the GitHub settings page** to
    where repos are used: a "Repositório GitHub" card in the Git
    sidebar (active repo + picker) and the AI chat now receives the
    active repo context with `github_read`/`github_write` tools (tree,
    file contents with sha, Contents API commits, issues — writes
    always user-approved; the token never leaves the device)
  - **Acode #2851 ported:** very-early plugin calls no longer fail
    during the Cordova boot race (`cordova.require("cordova/exec")`
    fallback)
  - +18 tests (733 in 87 files)

- **v1.7.0 — SSH sessions v2 + Fonts v2 (v1.7.x items 3 and 4):**
  - **SSH v2:** stable per-host color (derived from the name,
    deterministic), per-server command history (local, cap 100,
    password/key-phase prompts never recorded, Ctrl+C/D/U abandon the
    line) and a configurable home directory per server (precedence:
    explicit option > saved home > URL path > `/`); deleted hosts are
    cleaned automatically
  - **Fonts v2:** live preview of each font in the list itself
    (translated pangram, background preloading), editor font weight
    400–900 with live CodeMirror reconfiguration and a fully
    internationalized fonts page (+28 keys)
  - **Support normalized:** `main scroll` classes on the body (same
    latent defect as profile v1.6.4) + missing `logger` import on the
    error path
  - **proot fd fix (Acode #2878):** the `init-sandbox.sh` probe now
    uses the shell's pid and realpath(3) semantics — no more "can't
    sanitize binding /proc/self/fd/N" warnings
  - **Repo:** `congrats-pr.yml` thanks community PRs merged (free, no
    Discord); `Ctrl-Shift-W` opens the Welcome (Acode #2773)
  - **Site:** last i18n gaps closed (admin blog editor, /sponsor
    tiers, dynamic placeholders) — +47 EN translations
  - +22 tests (716 total)
- **v1.6.4 — definitive account fix:** the profile page's "Sign in"/
  "Sign up" buttons were dead from day one — the WCPage `body` getter
  returned `null` after the setter replaced the inner `.main` (the
  profile div lacked the `main` class), and field reads exploded in a
  silent TypeError; the body now keeps a local `$body` reference +
  default `main scroll` classes (About-page pattern). Closes the cycle
  started in 1.6.1/1.6.2 (valid session, persisted PAT, site → app
  bridge); +7 regression tests with real rendering (694 total)
- **v1.6.3 — Console REPL v2 + bilingual wiki:**
  - **Console REPL v2 (v1.7.x item 3):** persistent history across
    sessions (localStorage, dedupe, cap 50), named saved snippets
    (save/list/delete on the toolbar) and **workspace imports** —
    `import {x} from "./lib/mod.js"` resolves files relative to the
    open file's folder, inlines them as Blob URLs and runs them in the
    sandbox (transitive, with cycle guards and a 64-module cap)
  - **Bilingual wiki:** all 16 pages (14 content + `_Sidebar` +
    `_Footer`) carry 🇧🇷 + 🇺🇸 sections in a single file;
    `publish-wiki.mjs` extracts the active section (`WIKI_LANG=pt|en`)
    and the `wiki/checkWikiBilingual.mjs` checker joined CI
  - +35 tests (652 → 687)
- **v1.6.2 — real PAT persistence, icons and unified account:**
  - **PAT actually persisted (critical fix):** the settings kit does not
    save prompt values — pasted PATs were silently dropped ("connected via
    PAT and repos never appear"); ghSettings now persists
    `ghToken`/`gitRemoteUrl`/`ghBranch` and fetches the profile right
    away; clearing the token signs the GitHub session out
  - **Fonts/SSH icons:** `svg:server`, `svg:type` (plus `copy`,
    `trash-2`, `check`, `qr-code`) added to the pack — the previous
    fallback (`icon svg:<name>`) matches no icon-font glyph and rendered
    nothing; `select` dialogs now draw `svg:` icons as vectors (repo
    picker, sign-in chooser, commit actions)
  - **Site ↔ app unified account:** "Continue with the site account"
    button (new `/auth/app-handoff` site route hands the existing site
    session to the app via `xcoder://auth/oauth`); the account page
    re-renders on `authchange`; expired sessions refresh in the
    background; sign-in errors render INSIDE the form (never "nothing
    happens" again)
  - **Settings regrouped:** Core → Appearance → Code & tools →
    Connections → Data & backup → About (new pt/en strings)
  - **Free PR review bot:** `pr-review.yml` workflow comments on PRs with
    a bilingual per-area summary, rule-based suggestions and a checklist
    (replaces paid reviewers like Greptile with something of our own)
  - Actions bumped (checkout v7, setup-node v7, github-script v9,
    create-pull-request v8, stale v11); +8 tests (640 → 652)
- **v1.6.1 — one-tap GitHub App web flow + webview-proof login:** browser
  sign-in as first option (site exchanges the code server-side, returns
  via `xcoder://github/session` with anti-CSRF state); git sidebar
  account card renders even when local git status fails; native HTTP
  layer for the Supabase client; site published `/api/github/callback` +
  `/api/github/webhook` (HMAC); auth form never fails silently
- **v1.6.0 — v1.6.x roadmap complete + GitHub sign-in fix:** SSH sessions
  page, sandboxed JS console REPL, font manager, terminal onboarding;
  Device Flow saved an EMPTY session — token now consumed as a string
- **v1.5.4 — official GitHub App + model picker with logos:** built-in
  client id (factory Device Flow) and a model picker with real brand
  logos, free/paid badges and instant search
- **v1.5.3 — UI polish + clientless GitHub:** header arrow buttons
  removed; AI capability pills below the model; `models/` prefix
  normalized; GitHub sign-in rebuilt + `docs/github-oauth-app.md` guide
- AI agent with tools, subagents and streaming; real Think/Search pills
- Keyless built-in providers: Pollinations (text + image), DuckDuckGo AI
  — and real brand logos for 16 providers in the chat
- Multi-pane editor (split view) with per-pane tabs 💡
- Tab history navigation with persistent history across sessions 💡
- **Active indent guide** (opt-in, VSCode-style) 💡
- Alpine terminal (proot) with **FailSafe mode self-healing**
- Embedded site (Website tab), marketplace with 16+ plugins, shared site
  account (single sign-in)
- **Site fully bilingual pt/en** — including /user/*, plugin submission,
  forum, posts and docs
- **Automatic release announcement on the forum** (stable release → bot post)
- Auto-signed releases, label-based preview builds (app + site), CI with
  translation and typos checks, Dependabot + deps bot

## 🗂️ Batches in alphabetical order (A–Z)

> **How to read:** batches are thematic (A–Z), not priority-ordered —
> every release picks items from several batches. A done item flips to
> `- [x]` and moves up to «✅ Done» in the matching release.
> Tags: 💡 Acode (upstream PR/issue) · 🖥️ inspired by other editors
> (VS Code, Zed, Spck, JetBrains…) · ✨ XCoder idea · 🔁 carried over
> from the previous roadmap.

## Batch A — Accessibility & Appearance

- [ ] **High contrast + color-blind palettes** ✨ —
  Deuteranopia/protanopia/tritanopia themes plus a high-contrast mode
  checked against WCAG AA on syntax tokens.
- [ ] **Visual theme editor** 🔁 — Token editor (background, primary,
  syntax colors) with shareable JSON export/import.
- [ ] **Per-language typography** 🖥️ inspired by VS Code — Font size, line
  height and family configurable per language mode (e.g. larger serif for
  Markdown).
- [ ] **TalkBack on the main surfaces** ✨ — Content labels on icons, ≥48dp
  touch targets and coherent focus order across sidebar, tabs and dialogs.
- [ ] **Honor prefers-reduced-motion** ✨ — Disable decorative animations
  (pulses, page transitions) when the OS requests reduced motion.

## Batch B — Search & Build

- [ ] **Streamed global search** 💡 Acode #2883 — Results flowing in
  without discovery restarts (upstream prevents restarts and streams
  efficiently).
- [ ] **Glob search/replace** ✨ — Include/exclude patterns (`src/**`,
  `*.min.js`) and a search history persisted across sessions.
- [ ] **Fuzzy «Go to file»** 🖥️ inspired by VS Code — Quick open by name
  with ranking (recently opened first), reachable from the top bar.
- [ ] **Per-project build recipes** ✨ — `scripts.json` with build/test/run
  executed in the console with project env and a stop button.
- [ ] **Inline match preview** 🖥️ inspired by Spck — Each result shows the
  highlighted line with context and can be replaced individually.

## Batch C — Code, Console & Collaboration

- [ ] **Virtualised console** 💡 Acode #2882 — Thousands of log lines
  without freezing (upstream improved console virtualisation).
- [ ] **Console level filter** ✨ — Filter log/warn/error with per-level
  counters and clear-on-swipe.
- [ ] **Rainbow brackets + indent guides** 🖥️ inspired by VS Code —
  Depth-colored bracket pairs and optional indent guides in settings.
- [ ] **Scheduled ghBackend backup** 🔁 — Sync settings + AI sessions with
  scheduled backup/restore and a visual diff before applying.
- [ ] **Share code via link/QR** ✨ — Generate a temporary link (anonymous
  gist) or QR of the active file/selection for quick sharing.

## Batch D — Debugging & Data

- [ ] **Console watch expressions** 🖥️ inspired by VS Code — Inspect
  objects with an expandable tree and pin watched expressions across runs.
- [ ] **Improved Eruda inspector** ✨ — Real-time DOM/CSS in the web
  preview with inline editing (the devTools module already ships Eruda).
- [ ] **Per-file local timeline** 🖥️ inspired by VS Code Timeline —
  Automatic snapshots on save (configurable window) with diff and restore.
- [ ] **Full app state export/restore** ✨ — Zip with settings, plugins,
  installed models and sessions — for device migration.
- [ ] **Logcat viewer** ✨ — Filtered logcat (by tag/app) while running
  Cordova builds, without leaving the app.

## Batch E — Editor & Extensions

- [ ] **Experimental canvas renderer** 💡 Acode #2988 — Canvas-based
  rendering behind a flag (upstream shipped it as experimental with
  @acode.app/canvas-view).
- [ ] **Sticky scroll** 🖥️ inspired by VS Code — Current block header
  pinned to the top while scrolling inside long functions.
- [ ] **Optional minimap** 🖥️ inspired by VS Code — File thumbnail with a
  draggable viewport; off by default on phones.
- [ ] **Multi-cursor: findAll & selectMore** 💡 Acode #2129 — Fix
  selectMoreAfter/Before and findAll (reported broken upstream).
- [ ] **Reliable folding on large files** 💡 Acode #2912 — «Fold all» must
  not freeze on large files (upstream fix to verify in our build).
- [ ] **Plugin quicktool adapter** 💡 Acode #2898 — Plugins can register
  quick actions on the bar (upstream adapter).

## Batch F — Files & Formatting

- [ ] **Reliable «Save as»** 💡 Acode #1583 — Long-standing issue (10💬):
  correct path, existing-file conflict and encoding.
- [ ] **«Reload» button on the tab** 💡 Acode #2390 — Revert the file to
  its on-disk state, confirming when unsaved changes exist.
- [ ] **Unified rename flow** 💡 Acode #2958 — Consolidate the file-browser
  rename flow with clear error handling (upstream refactor).
- [ ] **Formatter reuse across plugin modes** 💡 Acode #2976 — Plugin modes
  can reuse another mode's formatter (upstream #2976).
- [ ] **Pins/favorites in the file browser** ✨ — Pins at the top of the
  browser for frequent files, synced per project.

## Batch G — Git & GitHub

- [ ] **Side-by-side diff in the Git app** 🖥️ inspired by VS Code — Two
  synchronized columns with per-line highlighting (currently inline only).
- [ ] **Gists: save & open** ✨ — Save selection/file as a gist (secret or
  public) and open an existing gist as a tab.
- [ ] **GitHub Actions status** ✨ — Workflow badge for the open repo in
  the Git panel (green/red + link to the run).
- [ ] **Pull requests from the app** ✨ — Create branch + PR from the Git
  app (REST API) and list open PRs of the repo.

## Batch H — HTML & Hosting

- [ ] **Default device size for preview** 💡 Acode #2966 — Set a default
  viewport (e.g. 390×844) for the in-app preview (upstream #2966).
- [ ] **HTML preview auto-refresh** 💡 Acode #2765 — Open issue: reload the
  preview on save (simple live reload without a server).
- [ ] **Improved preview webview** 💡 Acode #2924 — Upstream webview
  improvements (#2924) — evaluate and port to our preview.
- [ ] **Local HTTP server with LAN share** ✨ — Serve the project folder on
  the network (URL + QR) to test on a phone/PC nearby.

## Batch I — UI & Internationalization

- [ ] **es/fr app languages** 🔁 — The pt/en bilingual infra and modular
  per-area dictionaries pave the way for es/fr.
- [ ] **Immersive fullscreen + orientation** 💡 Acode #2919 — Immersive
  fullscreen API and orientation control (upstream #2919).
- [ ] **Split view** 🖥️ inspired by VS Code — Two files side by side on
  phones (landscape) and tablets; optional scroll sync.
- [ ] **Configurable nav bar** ✨ — Reorder/hide bottom-bar icons and
  choose pinned sidebar apps.
- [ ] **Drag to reorder tabs** ✨ — Drag-and-drop tab reordering with
  haptics and drop between open tabs.

## Batch J — JavaScript & JSON

- [ ] **package.json script runner** ✨ — Detect npm scripts and run them
  with node available (or warn) — output in the console.
- [ ] **Cataloged JSON schemas** 🖥️ inspired by VS Code — Validation +
  hover for tsconfig/package.json/manifest with offline embedded schemas.
- [ ] **Persistent REPL console** 🖥️ inspired by Zed — History persisted
  across sessions and send-selection-to-REPL.
- [ ] **Missing import detection** ✨ — In preview, failed import → suggest
  CDN or copy the local lib (integrates with the libs app).

## Batch K — Keyboard & Shortcuts

- [ ] **Command palette** 🖥️ inspired by VS Code — Every app action
  searchable in one place (with usage ranking).
- [ ] **Rebindable keybindings** 🖥️ inspired by VS Code — Remap shortcuts
  with chord support; export/import the key profile.
- [ ] **Multi-touch gestures** ✨ — 3-finger ←/→ for undo/redo, 4-finger to
  switch tab (configurable).
- [ ] **Basic vi/emacs mode** 🖥️ inspired by Vim — Essential motions/modes
  as a plugin (normal/insert/visual for vi).

## Batch L — Languages & Linters

- [ ] **Tailwind CSS LSP** 💡 Acode #2896 — Open issue: tailwind LSP not
  working — investigate and port the fix if applicable.
- [ ] **Richer JS/TS highlighting** 💡 Acode #2971 — JSDoc and methods with
  dedicated highlighting (upstream #2971) in our JS/TS mode.
- [ ] **Mermaid in markdown** 💡 Acode #2987 — Render mermaid diagrams in
  the markdown preview (upstream uses the pele lib).
- [ ] **GFM for markdown mode** 💡 Acode #2922 — Tables, checkboxes and
  strikethrough (GFM) in highlighting and preview.
- [ ] **Live Sass** 🔁 — Marketplace Sass compiler building live to CSS on
  save (ported plugin).

## Batch M — Marketplace & Models

- [ ] **Inline review on plugin page** 💡 Acode #2925 — Direct review
  button on the plugin page (upstream #2925) on top of our ratings API.
- [ ] **More local models** ✨ — New LLM/STT/TTS in the catalog
  (Qwen3/Phi/Gemma new) sized 50MB–2GB.
- [ ] **Task filters in the catalog** ✨ — Chat/code/STT/TTS tabs with RAM
  and storage requirements estimated.
- [ ] **«Made for XCoder» badge** ✨ — Quality checklist (manifest, i18n,
  permissions) and a badge on approved submissions.

## Batch N — Navigation & Notifications

- [ ] **Breadcrumbs** 🖥️ inspired by VS Code — Navigable file path at the
  top of the editor (folders + current symbol).
- [ ] **Symbol outline** 🖥️ inspired by VS Code — File symbol list via LSP
  documentSymbol with direct jump.
- [ ] **In-app notification center** ✨ — Consume the site's notification
  producer hooks (user_notifications already exist).
- [ ] **Recent files stack** ✨ — Return to the previous file with one tap
  (navigation stack).

## Batch O — Offline & Organization

- [ ] **Stateful workspaces** 🖥️ inspired by VS Code — Opening a project
  restores tabs, scroll and AI session (per workspace).
- [ ] **More offline libraries** ✨ — Offline Tailwind, Prism, KaTeX in the
  libs picker (same copy-to-project pattern).
- [ ] **Robust SFTP/FTP cache** 💡 Acode #1276 — Old cache bug (#1276) —
  list/purge remote cache and mtime-based invalidation.
- [ ] **Crash recovery** ✨ — In-memory autosave + full session restore
  (unsaved tabs included).

## Batch P — Performance & Plugins

- [ ] **New CodeMirror hang/flicker** 💡 Acode #1968 — Hottest issue (17💬):
  editor hangs/flickers with new CM — track upstream and port the fix.
- [ ] **Text load speed** 💡 Acode #2318 — Large files open faster (file
  streaming + incremental rendering).
- [ ] **Spam-paste performance** 💡 Acode #2364 — Repeated pasting must not
  degrade (batch CM transactions).
- [ ] **Faster startup — carefully** 💡 Acode #2933 — Upstream shipped
  #2930/#2931 and REVERTED (#2933): measure before/after in our build before
  copying any technique.
- [ ] **Hold-delete visual glitch** 💡 Acode #2303 — Continuous deletion
  shows visual artifacts (#2303) — fix in our input pipeline.

## Batch Q — Quality & Tests

- [ ] **ftp/sftp/file-ops suite** 💡 Acode #2928 — Use upstream tests
  (#2928) as inspiration to cover our remote providers.
- [ ] **Emulator UI smoke** ✨ — Scheduled CI job installing the APK on an
  emulator validating boot + sidebar apps.
- [ ] **Theme visual regression** ✨ — Golden screenshots per theme in
  tests (catch color/contrast regressions).
- [ ] **Revisit r8** 💡 Acode #2891 — Already studied and deferred:
  requires a real-device pass (breakages only show at runtime).

## Batch R — Runtime & Refactoring

- [ ] **LSP symbol rename** 🖥️ inspired by LSP — Rename workspace edit
  with a preview of affected files.
- [ ] **Advanced runner** 🔁 — Run scripts with env vars/arguments saved
  per project.
- [ ] **Document viewer** 🔁 — Read-only pdf/docx opening from the file
  browser.
- [ ] **Experimental USB API** 💡 Acode #2719 — Upstream issue asking for
  USB access — evaluate an OTG serial plugin for DIY hardware.

## Batch S — Security & Sync

- [ ] **Per-project secrets** ✨ — Beyond plugin secrets: a safe .env per
  project injected into runner/console.
- [ ] **Named terminal sessions** 💡 Acode #2894 — Persistent/named
  sessions (resume after closing the app).
- [ ] **CLI build without embedded terminal** 💡 Acode #2897 — Build option
  omitting terminal assets → smaller APK for Termux users.
- [ ] **Settings sync across devices** 🔁 — ghBackend as transport (same
  account) with manual conflict resolution.

## Batch T — Terminal, Themes & TTS

- [ ] **Terminal not starting on some devices** 💡 Acode #2824 — Open issue
  — reproduce on reported devices (proot/ABI) and port a fix.
- [ ] **Terminal themes & fonts** ✨ — Palettes (Dracula/Nord/…) and
  selectable mono fonts for the embedded terminal.
- [ ] **Configurable TTS voices** ✨ — Local text→voice speed/voice/pitch
  saved per chat persona.

## Batch U — UI/UX & Updates

- [ ] **Rewarded ads** 🔁 (Acode Acode #1918/#1779) — Watching an ad grants
  extra ad-free time; quiet hours (upstream pattern).
- [ ] **Release bot dashboard** 🔁 — Manage automatic announcements
  (edit/delete the release post) in the site's /admin area.
- [ ] **Delta updates** ✨ — Download only the APK diff when the release
  publishes one (less data usage).
- [ ] **Rendered in-app changelog** ✨ — Support/About page links to the
  rendered CHANGELOG.md (current version highlighted).

## Batch V — Voice & Visualization

- [ ] **Reusable Mermaid preview** 💡 Acode #2987 — Diagram panel (pele)
  reusable by plugins/READMEs.
- [ ] **Voice→text in inputs** ✨ — Dictate into search/prompt boxes using
  the embedded local STT runtime.
- [ ] **Project import graph** 🖥️ inspired by Zed — Simple dependency
  diagram (generated mermaid) to guide refactors.

## Batch W — Web & Widgets

- [ ] **Per-project homescreen widgets** ✨ — «Open project X» shortcut
  straight from the launcher (Android shortcuts).
- [ ] **Installable PWA site** ✨ — Manifest + minimal service worker for
  offline docs/tools reading.
- [ ] **Web Share Target** ✨ — Share a file from another app → XCoder
  opens it directly (import into the project).

## Batch X — eXport & eXperimental

- [ ] **Export project as zip** ✨ — Project folder zip (with/without
  node_modules) shareable via intents.
- [ ] **Codespaces deep link** 🖥️ inspired by GitHub Codespaces — Open the
  current repo in a Codespace/gitpod when the phone is not enough.
- [ ] **Plugins on a dedicated worker** ✨ — Experimental: run heavy
  plugins on an isolated Web Worker (editor never blocks).

## Batch Y — YAML & Config-as-code

- [ ] **Per-project .xcoder/config.json** ✨ — Versioned project settings
  (tabs, build recipe, formatting) in the repo.
- [ ] **Schema YAML validation** ✨ — GitHub Actions/workflows validated
  offline (embedded schema) with hover.

## Batch Z — Zen & Zoom

- [ ] **Zen mode** 🖥️ inspired by VS Code — Hide everything
  (sidebar/tabs/nav) with an easy exit — full focus on text.
- [ ] **Global zoom** ✨ — Scale editor + UI at once (pinch or Ctrl +/-
  with keyboard).
- [ ] **Reading mode** ✨ — Fold all + fullscreen + reading typography for
  reviewing long code.

## 🧭 Ongoing direction

- Keep CI green and pt-br 100% translated (`npm run lang:check`).
- **Acode triaged through 26/10 (v1.13.x):** recently merged PRs are
  catalogued in the Batches — canvas renderer (#2988), mermaid in
  markdown (#2987), improved webview (#2924), fullscreen/orientation
  (#2919), GFM (#2922), plugin quicktool (#2898), virtualised console
  (#2882), streamed search (#2883), reliable folding (#2912), formatter
  reuse across modes (#2976), richer JSDoc highlighting (#2971),
  default preview device size (#2966) and inline plugin review (#2925).
  **Careful:** #2930/#2931 (startup) were REVERTED upstream (#2933) —
  measure in our build before copying anything. Hot issues mapped to
  the Batches: #1968 (17💬), #1583, #2318, #2129, #2824, #2765, #1276,
  #2894, #2896, #2719, #2897, #2390, #2303, #2364, #2590. Already
  ported: #2886+#2880 (wrap indentation), #2887 (fileIcons), #2863 (tab
  context menu), #2840 (SFTP migration recovery), #2851 (cordova.exec
  race). **#2891 (r8) stays DEFERRED** — solid rules, but requires a
  real-device pass (breakages only show at runtime; v1.4.8 precedent
  in this fork).
- Check the Acode CHANGELOG on every upstream release and port what is
  useful (workflows, plugins, AI, editor).
- Never gate features behind Premium — donating is optional.
