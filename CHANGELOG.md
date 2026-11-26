# Changelog / Registro de mudanças

[🇧🇷 Português](#português) | [🇺🇸 English](#english)

All notable changes to **XCoder** are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/).

<a id="português"></a>

## [1.8.42] - 2026-11-26


## [1.8.41] - 2026-11-26

### Added
- Widgets de consentimento e cartões de URL no chat
- 18 sites pt no catálogo + memória dos visitados

### Maintenance
- V1.8.41
- Tawk.to é um produto real (assinatura do Analisador), «individuais» é português legítimo (toolPage.js) e src/res/learn-sites.json tem descrições pt-br legítimas («Cursos») — exclusões/excetos no _typos.toml

## [1.8.40] - 2026-11-26

### Fixed
- **«Só analisa e retorna 200, mas nada aparece» — RESOLVIDO na raiz
  estrutural**: um restauro de arranque podia marcar uma app flutuante
  como «ativa» enquanto o `bootHold` impedia a abertura da sua janela —
  e o setter `active` do SidebarApp early-returnava na re-ativação, por
  isso o ícone ficava destacado mas **morto**: cada análise/scrape com
  HTTP 200 corria para um contentor que nunca esteve no documento. Agora:
  (1) o arranque nunca mais marca apps flutuantes como ativas;
  (2) `SidebarApp.ensureWindowVisible()` reabre a janela/host após cada
  ativação — toque em opção ativa SEMPRE abre a ferramenta;
  (3) `ensureActiveApp()` só entrega o arranque a apps ancoradas.

### Changed
- **Ferramentas movidas para PÁGINAS independentes e individuais (fora
  da Apps Sidebar e da janela flutuante)** — Analisador, Scraper,
  Inspector, Bibliotecas, Aprender, Site oficial e Consola JS são agora
  páginas de ecrã inteiro na mesma pilha fiável de Problemas/Definições
  (`app.append()` é síncrono e incondicional — os resultados aparecem
  sempre). A barra lateral fica apenas com **webdev (Dev Tools), chat IA
  e Git** + as vistas base (Ficheiros, Pesquisa, Extensões). O contentor
  de cada ferramenta é **cacheado**: fechar a página e reabrir mantém os
  resultados (nada de ecrã vazio na 2.ª visita). Nova página **hub
  «Ferramentas»** no menu principal (⋮) navega para todas; o menu do
  preview nativo (Inspect/Scrape/Analyze) abre as páginas diretamente,
  sem ativação de sidebar nem polling. A opção ativa da sidebar continua
  destacada (barra de acento + wash estilo VS Code) e nunca mais fica
  oculta/dead.

### Analysis
- **Plugin GitHub oficial do Acode (Acode-Foundation, pelo Ajit)
  analisado**: espaço de trabalho de repositórios/gists por API (editar
  remoto SEM clone), device-flow OAuth, sessão encriptada — complementa
  em vez de substituir o painel Git do XCoder (que faz git real: clone,
  stage, commit, push/pull, branches, diff e já usa o mesmo device-flow
  RFC 8628 no ghAuth). Pode ser instalado pela ponte do marketplace
  (.acode) para quem quiser editar ficheiros remotos sem clonar.

### English summary
- «Analyzes and returns 200 but nothing appears» fixed at the structural
  root: boot restore could mark a floating sidebar app active while
  bootHold blocked its window, and the SidebarApp active-setter
  early-returned on re-activation — the icon looked selected yet dead,
  and every 200-OK fetch rendered into a container never in the
  document. Boot no longer auto-activates floating apps;
  SidebarApp.ensureWindowVisible() re-opens the host after every
  activation; ensureActiveApp() only hands boot to docked apps.
- All web tools (Analyzer, Scraper, Inspector, Libs, Learn, Website, JS
  Console) moved OUT of the sidebar/floating-window into independent
  full-screen pages on the proven Problems/Settings page stack —
  results always visible, state cached across reopen. Sidebar keeps
  only webdev, AI chat and Git plus the core views. New «Tools» hub in
  the main menu; preview menu opens the pages directly. Active sidebar
  option stays highlighted (VS Code accent bar + wash) and never dead.
- Official Acode GitHub plugin (by Ajit) analyzed: API-based
  repo/gist workspace without cloning — complementary to our real-git
  panel (same RFC 8628 device flow already in ghAuth); installable via
  the marketplace bridge.

## [1.8.39] - 2026-11-26

### Added
- **Analisador de Sites** (ferramenta nova na barra lateral, glifo
  telescópio) — descobre «o que foi usado para se basear»: frameworks
  (Next.js, React, Vue, Angular, Astro, SvelteKit, Nuxt…), linguagens
  (PHP, Python, Java, C#, Ruby, Node.js…), servidores e CDNs (Cloudflare,
  Vercel, nginx, Apache, CloudFront…), CMSs e lojas (WordPress, Shopify,
  Wix, WooCommerce…), analytics, fontes, captchas, widgets — **110+
  assinaturas** de deteção, cada correspondência mostrada com a sua
  **EVIDÊNCIA** (linha de cabeçalho ou fragmento HTML). Aba Detalhes com
  meta da página + cabeçalhos da resposta; «Versão renderizada» carrega a
  página numa WebView interna e analisa o DOM final (resolve SPAs e
  bloqueios); relatório completo copiável. O menu do preview nativo ganhou
  **«Analyze»** (glifo SEARCH no icon.ttf do preview) que entrega o URL ao
  analisador — e o novo `httpFetchDetailed` devolve cabeçalhos + estado
  sem rejeitar respostas 4xx/5xx (um intersticial 403 ainda identifica a
  stack que protege o site).
- **Aprender** (ferramenta nova na barra lateral, glifo láurea) — catálogo
  com **43 sites principais** para estudar e consultar qualquer linguagem
  ou ferramenta de programação e desenvolvimento web (MDN, W3Schools,
  freeCodeCamp, javascript.info, roadmap.sh, Pro Git, SQLBolt,
  LearnGitBranching, desafios Codewars/LeetCode/Exercism…), organizados em
  11 categorias com pesquisa e filtros. Cada site abre na **WebView
  interna flutuante** (iframe dentro da janela flutuante do app, com
  barra Voltar/Recarregar/Externo) — e quando o site bloqueia
  incorporação (X-Frame-Options / CSP frame-ancestors detetados nos
  cabeçalhos por uma sonda HTTP), salta automaticamente para a **WebView
  nativa interna** (atividade em ecrã cheio); há sempre o botão «Abrir na
  WebView interna» à mão.

### Internationalization
- **68 chaves novas × 31 línguas** — todas as línguas do app a 100% (0
  ausentes, 0 vazias). «Framework» mantido como termo técnico onde a
  tradução genérica enganaria (Rahmenwerke/Рамки/Cadres → Frameworks).

### Tests
- 1368/1368 no total — 12 testes novos para o motor de deteção
  (assinaturas de cabeçalhos/HTML, derivação de linguagens, limite de
  evidências, política de incorporação, construtor do relatório).

## [1.8.38] - 2026-11-26

### Fixed
- **O congelamento das ferramentas web acabou de vez** — o Prettier corria
  na thread principal e uma página minificada (qualquer site moderno)
  bloqueava o app durante MINUTOS; o «timeout» de Promise.race nunca
  disparava porque timers não correm com a thread congelada («A
  embelezar…» para sempre, «nada funciona»). Agora o Prettier corre num
  **Web Worker dedicado** (build/beautifyWorker.js, ~0.9 MB, carregado só
  quando embeleza): a UI continua viva, o timeout de 20 s TERMINA o
  worker a sério, e fontes pequenas (<24 kB) têm fallback em linha quando
  o WebView não tem workers. Embelezar automático e botão «Embelezar»
  usam o novo caminho.

### Added
- **Galeria das imagens descarregadas** — «Todas as imagens» agora mostra
  progresso ao vivo (3/12 — nome.png), descarrega uma a uma (erros por
  imagem à vista, nada de streams paralelos que estagnam) e renderiza uma
  **galeria local** no separador Recursos: miniaturas lidas dos ficheiros
  guardados (object URLs, ≤1,5 MB), tamanho, falhas destacadas e toque
  abre a imagem no visualizador do editor. O que se vê é o que caiu no
  disco.
- **Menu do preview volta a ter «Inspect» e «Scrape»** — restaurados
  (mantêm-se no sidebar também; o «SEO» fica). A entrega do URL ao editor
  foi corrigida: `sidebarApps.get()` devolve o elemento do painel e
  `.active = true` nele era um no-op silencioso — a ferramenta nunca
  abria. Agora `setActiveApp()` activa a SidebarApp real (no arranque e
  na fila pendente de intents).

### Hardening
- `httpFetch` com teto rígido de 30 s nos dois transportes (cliente
  nativo e fetch) — o scraper nunca mais pode ficar pendurado em
  «A obter código-fonte…» sem diagnosticar.
- Script de captura do Inspector idempotente a sério
  (`window.__xcoderInspector = true`): cada re-injecção do nativo voltava
  a embrulhar console/fetch/XHR — registos duplicados na Consola.
- Chaves novas («Imagens descarregadas», «imagens guardadas», «Nenhuma
  imagem nesta página») traduzidas nas **31 línguas** do app.

### English summary
- Prettier moved to a dedicated Web Worker (UI freeze during beautify is
  gone; the 20 s timeout really terminates the worker; small sources keep
  an inline fallback). Local gallery of downloaded images with live
  progress and disk-read thumbnails. Preview menu restored («Inspect»,
  «Scrape», «SEO») and the URL hand-off now actually opens the tool
  (setActiveApp instead of a no-op on a container element). httpFetch has
  a hard 30 s ceiling; inspector capture is idempotent; new keys
  translated in all 31 languages.


## [1.8.37] - 2026-11-25

### Fixed
- Tudo funciona de novo — downloads de imagens sem «Path not found» (ensureDirDeep cria todas as pastas em falta, nomes deduplicados, sem abrir o site no navegador), Scraper nunca mais congela em «A abrir/obter…» (o prettier bloqueava a paint antes de mostrar o código; agora formata depois da 1.ª pintura, com limite de tamanho e timeout, e a cadeia de transporte HTTP nativo → fetch → WebView renderizada com cada passo visível), Inspector mostra SEMPRE a árvore (DOM parseado da fonte HTTP como fallback + watchdog com diagnóstico + erros da árvore viva à vista), SEO do preview nativo lê assets/www/browser/seo-audit.js (o <asset> era empacotado noutra pasta → «SEO audit unavailable»; cópia garantida no build via utils/config.js), miniaturas nas imagens do Scraper, httpFetch stringifica respostas JSON do cliente nativo — e i18n 100%: as 831 chaves em falta traduzidas nas 30 línguas do app (scripts/translate_missing.mjs, placeholders protegidos) — v1.8.37

### Maintenance
- Palavras pt-br legítimas do scraper/SEO (definitivo, relevante, presentes)


## [1.8.36] - 2026-11-25

### Pré-visualização: SEO e correções nas ferramentas web

- **Auditoria SEO na pré-visualização** — o menu do preview nativo ganhou
  o item **«SEO»**: abre, dentro da própria página, um relatório detalhado
  com **pontuações** (geral 0–100 e por categoria: Meta & tags,
  Conteúdo, Social & partilha, Técnico, Performance). Cada verificação
  mostra estado (✓ / ! / ✕), o valor medido e uma dica de correção:
  título, description, canónico, robots/noindex, lang, charset, h1/h2,
  volume de texto, imagens sem alt, ligações vazias, Open Graph,
  Twitter Card, HTTPS, viewport, favicon, JSON-LD, peso do HTML,
  scripts bloqueantes, TTFB/tempo de carga e pedidos de recursos.
  - Botões **Copiar** (relatório em texto), **Atualizar** e fechar;
    nada sai da página — o preview não é abandonado.
- **«Inspecionar» e «Scrape» removidos do menu do preview** (pedido do
  utilizador): as ferramentas continuam no sidebar, e um toque nelas não
  devolve mais ao editor — o menu do preview fica só com as suas próprias
  funções.
- **Inspector funciona de vez** — duas causas de raiz corrigidas:
  1. no nativo, uma sessão em ecrã inteiro criada *invisível* agora constrói
     a WebView headless imediatamente (antes o `loadURL` só estacionava o
     endereço e todos os comandos falhavam com "WebView is not ready");
  2. no JS, ao terminar o carregamento a árvore DOM é buscada de imediato
     (com uma segunda tentativa para SPAs que hidratam tarde) — acabou o
     spinner eterno.
- **Scraper: fim do «código criptografado»** — fontes minificadas
  (uma/ poucas linhas gigantes) são **formatadas automaticamente** com
  Prettier logo após a captura; o botão passa a alternar
  «Embelezar ↔ Bruto» e o original fica sempre disponível.
  - Se o pedido **bruto** falhar (403/bloqueio), a captura cai
    automaticamente para a página **renderizada**; respostas vazias são
    sinalizadas em vez de mostrarem uma tela em branco.
  - O separador **Análise** ganhou o cartão **Auditoria SEO** com as
    mesmas pontuações (auditada a partir do código-fonte).
- **Sidebar com muitas opções agora rola** — a barra de apps (15+ itens
  transborda em qualquer telemóvel) usa `touch-action: pan-y` e o gesto de
  slide ignora arrastos verticais dentro dela: os ícones escondidos são
  alcançáveis com scroll.
- **Copiar problemas** — a página Problemas tem um botão «copiar tudo» no
  cabeçalho (`ficheiro:linha:coluna [tipo] mensagem`) e um ícone de copiar
  em cada problema.

## [1.8.35] - 2026-11-24

### Inspecção e scraping na tela de pré-visualização

- **O ecrã de pré-visualização ganhou «Inspecionar» e «Scrape»** — dois
  novos itens no menu do preview nativo (ícones `< >` e globo). Um toque
  entrega o URL atual ao editor: o Inspector (Elementos/Consola/Rede) abre
  com a página carregada, ou o Scraper busca a fonte **renderizada** (o
  resultado do JavaScript) e mostra recursos, segredos e endpoints. O
  preview fica na pilha — voltar com o botão Back.
  - Funciona para QUALQUER URL em preview, incluindo `http://localhost`
    do servidor embutido (o servidor continua vivo quando a ferramenta
    abre, com a mesma sessão).
  - A entrega sobrevive à restauração: se os ficheiros ainda não
    reabriram, o pedido fica em fila e é executado depois.
- **Novos glifos no conjunto de ícones nativo** — `CODE` (`< >`) e
  `GLOBE`, usados nos novos itens de menu.
- O modo apenas-consola do preview não mostra os novos itens.


## [1.8.34] - 2026-11-24

### Novidades do Acode oficial, portadas para o XCoder

Esta versão traz as novidades mais importantes do repositório oficial do
Acode (Acode-Foundation/Acode), adaptadas ao XCoder:

- **Arrastar e largar no Explorador** — segure um ficheiro (ou uma seleção
  inteira do modo multi-seleção) e arraste-o para outra pasta para o mover;
  pastas fechadas abrem-se sozinhas ao pairar (spring-loaded), a lista faz
  scroll nas bordas, o cartão de arrasto mostra um selo com a quantidade de
  itens e pastas não podem cair dentro de si mesmas. Funciona por toque e
  por rato, com vibração e animações de assentamento. Movimentos
  entre-provedores (ex.: SFTP ↔ local) transferem por cópia + remoção
  quando a renomeação direta não está disponível.
- **Guarda `color-mix()` com `@supports`** — toda a camada de redesign
  (tokens, vscode-ui, inspector, chat IA, dragMove…) agora compila cada
  declaração com `color-mix()` dentro de um bloco
  `@supports (color: color-mix(…))`, com o fallback simples antes. WebViews
  antigos deixam de perder cores (o valor com `var()` era "invalid at
  computed-value time" e ficava transparente) — 118 guardas no CSS principal.
- **Fullscreen imersivo + API de orientação** — o WebView Android entra em
  modo imersivo real (barras escondidas, Back entregue à sessão de
  fullscreen via `xcoder.require("fullscreen")`) e pede orientação
  temporária (`xcoder.require("orientation").lock("landscape")`) durante a
  sessão; restaurado ao sair. O hook nativo (ImmersiveFullscreen.java)
  vive no CordovaLib injetado no prepare, sem substituir o WebChromeClient.
- **Partilhar documentos de outras apps** — o manifest agora aceita
  SEND / SEND_MULTIPLE (pdf, docx, xlsx, pptx, ods, csv, tsv); a
  inicial nativa recolhe todos os uris (EXTRA_STREAM + ClipData) com
  persistência de permissões quando possível, e o XCoder abre os ficheiros
  partilhados em lote (o último recebe o foco).
- **Pré-visualização com tamanho de dispositivo predefinido** — no modo
  Dispositivos do browser interno, «Fixar como predefinição» e «Limpar
  predefinição» guardam o tamanho (reajustado ao ecrã atual ao restaurar);
  o preview reabre no modo guardado sem recarregar duas vezes.
- **Markdown com GFM** — o modo markdown do editor usa o
  `markdownLanguage` (GFM: tabelas, risco, listas de tarefas, autolinks).
- **Dicas nos filtros de pesquisa** — os botões aA / a-z / .* / IDX / HD
  ganham dica por toque longo (novo sistema de tooltips por long-press
  com título + descrição, inclusive dentro de shadow roots), com
  `title`/`aria-label` para acessibilidade.
- **Ligações `file://` em documentação LSP abrem no editor** — em vez de
  irem para o browser (que crashava com FileUriExposedException), com
  suporte a fragmentos `#L12:5`; e o `openInBrowser` nativo recusa `file:`
  e já não mata o app se não houver activity.
- **Substituição nativa com regras do JavaScript** — o índice nativo
  expande `$1…$99`, `$<nome>`, `$&`, `` $` ``, `$'` e `$$` igual ao
  `String.prototype.replace`, incluindo grupos nomeados.
- Correcções portadas do Acode oficial:
  - **Substituir-tudo com substituição vazia** funciona (apaga todas as
    ocorrências) e um ficheiro fechado cujo conteúdo foi substituído por
    "" recarrega certo;
  - **Barra de rolagem** já não reabre o teclado ao arrastar (touchend
    cancelado) e reposiciona o polegar ao reaparecer/medir sempre;
  - **Pastas** não são renderizadas duas vezes quando abre/fecha durante o
    carregamento (gerações + destruição do tree pendente);
  - **Colar texto CRLF** mantém o cursor dentro do documento;
  - **Dobrar tudo** é fiável em ficheiros grandes (parsing forçado).


## [1.8.33] - 2026-11-24

### Redesign completo estilo VS Code (para além dos ícones)

- **Camada de interface `vscode-ui.scss`** — o chrome todo foi afinado para
  a linguagem visual do VS Code desktop: geometria viva (raios de 2–6px em
  vez do arredondado 6–18px), elevação plana (hairlines em vez de sombras
  grandes), métricas exatas (abas de 35px, activity bar de 48px, entradas
  de 32px), scrollbars de 9px que só aparecem ao rolar, abas ativas com
  filete superior no acento e que derretem na superfície do editor, ponto
  de «não guardado» em vez do asterisco, menus de contexto e diálogos com
  borda fina e canto pequeno. Os temas continuam a mandar nas CORES — tudo
  funciona em claro e escuro.
- **Fim das duas engrenagens no chatbot IA** — o botão de modelos (tune)
  e as definições da IA usavam o mesmo glifo de engrenagem; o seletor de
  modelos agora usa o ícone «sparkle» do VS Code (✨), distinto das
  Definições.

### Inspector — ferramentas de inspecção como no PC (com URL)

- **Novo app Inspector na activity bar** — abre QUALQUER site num webview
  nativo com um script de captura injetado ANTES dos scripts da página
  (document start + document end, em cada navegação), como o DevTools do
  Chrome:
  - **Elementos** — árvore DOM navegável (expandir/colapsar por nível),
    atributos, estilos computados, box model, HTML do nó (copiar/inserir
    no editor), busca por selector CSS e **realce do elemento na página**.
  - **Consola** — console.log/warn/error da página, erros e rejeições não
    tratadas, e um campo para **executar JavaScript** no contexto da página.
  - **Rede** — log de fetch/XHR com método, URL, estado, tempo e tamanho,
    com filtros por tipo (XHR/JSON, JS, CSS, imagens, fontes).
  - Barra de endereço própria (URL incluído), recarregar, abrir a página
    em tela cheia e fechar a sessão.

### Scraper + engenharia reversa

- **Novo app Scraper** — baixa o código-fonte de qualquer site de duas
  formas: **bruto** via cliente HTTP nativo (sem CORS, com User-Agent de
  browser) ou **renderizado** num webview escondido (pega o DOM depois do
  JavaScript — resolve sites que são uma casca vazia de JS). O código fica
  pré-visualizado e pode ser **guardado no projeto**, **aberto no editor**,
  copiado ou **embelezado** (Prettier para HTML/CSS/JS/JSON).
- **Recursos** — extrai imagens (src + srcset + CSS url()), scripts,
  folhas de estilo, fontes e media com URLs absolutos; descarregue item a
  item, os seleccionados ou **todas as imagens** de uma vez para a pasta
  Download/<site>/ do app.
- **Análise de engenharia reversa** — metadados da página (title,
  description, generator, Open Graph, canonical), **detecção de segredos**
  no código (chaves AWS, Google, OpenAI, tokens GitHub/Slack/GitLab, JWT,
  chaves privadas e atribuições api_key/secret — mascarados na lista, com
  linha e contexto) e **endpoints de API** (`/api/...`, /graphql, /v1…)
  e URLs absolutos referenciados.

### Servidores de linguagem — gestor com filtros e tamanhos

- **Página refeita** («Definições › Servidores de linguagem»): busca por
  texto, **filtros Todos/Instalados/Não instalados**, filtro por
  **linguagem**, ordenação por nome/linguagem/estado/**tamanho** e botão
  de atualizar; cada linha mostra o estado real (verificado na shell do
  runtime, com versão), as linguagens e **os dois tamanhos**: estimativa
  de **download antes de instalar** (APIs do npm registry, PyPI e
  crates.io) e **tamanho no disco depois de instalar** (`du -sk` nos
  caminhos reais de cada instalador — npm global, pip site-packages,
  base de dados do apk, binários). A criação de servidores personalizados
  continua no botão «+» do cabeçalho.

### Plataforma

- **Plugin webview nativo com `setInjectScript`** — registre um script
  que o Android reinjeta no início E no fim de cada navegação (base das
  capturas do Inspector; API pública para apps/plugins).

## [1.8.32] - 2026-11-23

### Look VS Code — ícones de verdade em todo o app

- **Pacote de ícones de ficheiros vscode-icons completo** — os 843 ícones
  oficiais (MIT) ficam embutidos no app: navegador de ficheiros, abas do
  editor, quick open e diálogos mostram os ícones coloridos do VS Code
  (TypeScript azul, JavaScript amarelo, Rust laranja, pastas especiais
  como `src/`/`.github/`…), com mapeamento por nome de ficheiro,
  extensão e linguagem. Ativo por defeito; o pack antigo continua
  disponível em Definições › Icon pack.
- **Codicons em toda a interface** — a fonte oficial @vscode/codicons
  (570 glifos) substitui os glifos Material da interface: menus, caixas
  de diálogo, definições e a activity bar (Explorador, Pesquisa, Source
  Control, Extensões, IA, Terminal…) passam a usar os mesmos ícones do
  VS Code.
- **Tema de editor VS Code Dark+ por defeito** — novos utilizadores
  recebem `vscodeDark`/`vscodeLight` e há migração única dos antigos
  `one_dark`/`noctisLilac`, em sintonia com o tema do app (Dark Modern).

### Chat IA mais robusto

- **Blocos de código estilo VS Code** — cabeçalho com o nome da
  linguagem e botão de copiar em cada bloco; tocar no corpo continua a
  abrir as ações de código.
- **Botão «Regenerar» direto nas bolhas de erro** — além do gesto de
  long-press, os erros passam a oferecer um retry explícito.

### Correções

- **About volta a abrir** — a lista de bibliotecas OSS referenciava um
  global que nunca era definido (ReferenceError) e derrubava a página;
  agora importa `res/oss-libraries.json` diretamente.
- **Tamanhos sem tag &lt;span&gt; à vista** — a lista de bibliotecas
  (local/CDN) mostrava literalmente «&lt;span&gt;43KB&lt;/span&gt&gt;»;
  o tamanho agora renderiza como elemento.
- **Ícones de ficheiro nas abas do editor** — o shadow root das abas
  agora adota a stylesheet do tema de ícones ativo (repartida via
  `adoptedStyleSheets`), para os ícones aparecerem também nas abas.

## [1.8.31] - 2026-11-23

### Git — clone corrigido de vez

- **Fim do «HTTP Error: undefined undefined»** — o isomorphic-git lê
  `statusCode`/`statusMessage` e `headers['content-type']` (estilo Node),
  mas o cliente HTTP nativo respondia `status`/`statusText` com headers
  sem acesso direto por propriedade: TODA resposta — mesmo um 200! — era
  rejeitada como erro. O cliente agora devolve os dois formatos e headers
  em objeto plano (lowercase, com helpers `.get()`), então clonar, push,
  pull e fetch voltaram a funcionar de verdade no painel Git e no bot.

### Sobre / Changelog

- **Changelog da versão atual sempre correto** — a aba «versão atual» lê
  primeiro o CHANGELOG.md empacotado no build (seção da versão em
  execução) em vez do resumo de commits do release do GitHub, que
  repetia as mesmas informações curtas; as notas bilíngues completas
  aparecem como no repositório.
- **Todas as bibliotecas open-source no About** — «Open-source libraries»
  agora cobre as 80 dependências de produção (nome, versão, licença e
  site), geradas do package.json; toque num item para abrir a página do
  projeto.
- **«Version xx.xx» com espaço** — o rótulo e o número da versão deixaram
  de aparecer colados no topo do About.
- **Links não vazam mais da tela** — URLs longas quebram dentro do item
  no About e no changelog (overflow-wrap + word-break).

### Web

- O site passou a publicar o **CHANGELOG.md completo** na página
  /changelog (além do resumo das releases) e recebeu os anúncios das
  versões 1.8.28–1.8.30.


## [1.8.30] - 2026-11-23

### Plugins — ponte com o marketplace do Acode

- **XCoder agora lista, instala e executa plugins do Acode** — o
  marketplace do app passou a mesclar o registro nativo com a loja
  oficial do Acode (`acode.app/api`): 350 pacotes aparecem na mesma
  lista, com badge «Acode» nos itens, novo filtro por fonte
  (XCoder / Acode), busca e paginação unificadas. O download vai direto
  ao endpoint oficial (`/api/plugin/download/<id>`) — sem servidor
  intermediário. Plugins pagos (IAP do Acode) e pacotes feitos para
  outro núcleo de editor são ocultados automaticamente.
- **Compatibilidade de runtime (ponte `window.acode`)** — o XCoder expõe
  a mesma API sob o global que os plugins do Acode esperam:
  `acode.require()`, `acode.setPluginInit/setPluginUnmount`,
  `acode.execCommand`, formatters, temas do editor, terminal e demais
  módulos funcionam idênticos. Plugins `.acode` rodam sem modificação ao
  lado dos `.xcoder`, inclusive quando um plugin do Acode pede
  dependências (`acode.installPlugin` resolve na lista mesclada).
- **Suporte simultâneo a .xcoder e .acode** — arquivos `.xcoder`,
  `.xcoder-plugin`, `.acode` e `.acode-plugin` são instaláveis pelo
  navegador de arquivos (tocar oferece instalar; o menu de ações ganha
  «Instalar como plugin»), por URL no «Adicionar origem» e por deep
  link: o app agora responde também a `acode://plugin/install/<id>`
  (além do `xcoder://`), aceitando os ids com underscore do ecossistema
  Acode.
- **Página de detalhes como na loja do Acode** — para plugins da ponte,
  o app busca o readme markdown, changelogs, contribuidores e metadados
  direto da loja (com cache), então a descrição fica completa como no
  Acode. A verificação de `min_version_code` é mantida.
- **Instalador mais robusto** — manifests legados sem `id` recebem um id
  estável derivado do nome/ficheiro; o download de plugins ganhou
  fallback `fetch` para desktop/webviews sem o plugin HTTP nativo.


## [1.8.29] - 2026-11-14

### Git — clone que funciona de verdade

- **Fim do «Failed to fetch» ao clonar** — o WebView impõe CORS e os
  endpoints git smart-HTTP do GitHub não enviam cabeçalhos CORS, então
  o cliente padrão do isomorphic-git falhava SEMPRE em clonar/push/pull.
  Agora o app usa um cliente HTTP próprio com três transportes em
  cascata: **nativo** (cordova-plugin-advanced-http, sem CORS, corpos
  binários via serializer `raw`, timeout de 30min) → **fetch direto**
  → **proxy CORS** (`cors.isomorphic-git.org`, configurável em
  `gitCorsProxy`). Falhas HTTP (401/404) continuam sendo RESPOSTAS para
  o isomorphic-git mapear autenticação — só erro de transporte cai para
  o próximo transporte.
- **Clonar pelo terminal Alpine (fallback automático)** — quando o git
  interno não conecta, o painel Git oferece clonar pelo terminal: o
  comando roda headless via Executor do plugin de terminal (sem abrir
  aba PTY), **instala o git sozinho** (`apk add git`) se o Alpine não
  tiver, injeta o token da sessão na URL (mascarado em toasts/logs),
  respeita os binds `/sdcard` `/storage` `/data` e confere o exit code.
  Nova ação «Abrir terminal do projeto (git no Alpine)» no menu de
  ações abre o terminal já dentro da pasta do projeto.
- **Meus repositórios** — o painel Git lista os repositórios da conta
  (owner + colaborador) na welcome view e no menu SCM: escolher um
  repo e clonar direto para o projeto (com fallback de terminal) ou
  definir como repositório ativo (GitHub tools/bot). Depois de clonar,
  o app pergunta «Abrir pasta clonada?» e abre o repo como projeto
  ativo (o SCM passa a rastrear o repo na hora).

### Git — o bot agora trabalha em repositórios

- **Três novas tools do agente** — `repo_list` (lista os repos da
  conta), `repo_open` (define o repo ativo p/ github_read/github_write
  e o painel Git) e `repo_clone` (clona para o workspace — engine com
  fallback de terminal — e aponta o ambiente de trabalho para a pasta
  clonada). Depois disso o bot lê/edita ficheiros com as file tools e
  publica com `git add/commit/push` via run_command ou terminal.
- O prompt do sistema do agente passou a incluir o **contexto git do
  workspace** (branch, remote e repo GitHub ativo), então "trabalhe no
  repo X" funciona de ponta a ponta: listar → clonar → editar →
  commitar → push.

### IA — mais modelos, importar e baixar via link

- **Novos modelos no catálogo** (tamanhos verificados blob a blob na HF):
  - **Whisper Tiny** (q8, ~44MB) — a voz → texto mais leve (pt + 98
    idiomas), para aparelhos modestos;
  - **MMS TTS English** (fp16, ~58MB) — texto → voz em inglês, na faixa
    50–100MB pedida.
- **Baixar modelo via link** — cole um link do Hugging Face
  (huggingface.co/org/repo, inclusive /tree, /blob, /resolve e .git) na
  tela de Modelos: o app consulta a API do HF, detecta a tarefa
  (pipeline_tag, com fallback no config.json), escolhe a menor
  quantização ONNX realmente presente (q4f16 → q4 → q8 → int8 → fp16 →
  fp32, inclusive shards externos `.onnx_data`), registra o modelo no
  catálogo com tamanho real e baixa com o gestor de downloads normal
  (com retomada).
- **Importar arquivos do aparelho** — modelos já baixados na internet
  (pasta com config.json + tokenizer + onnx/) viram modelo local sem
  re-download: o app procura pastas de modelo no projeto aberto,
  detecta tipo/dtype pelos nomes dos ficheiros, copia para
  `xcoder-models/<id>/`, escreve o `_manifest.json` de instalação e o
  modelo aparece (com chip «Importado»/«Link HF») funcionando offline
  via o cache de disco do runtime.

### Atualização — notificação + download nativo

- **Notificação de nova versão agora é padrão** — `checkForAppUpdates`
  era `false` por omissão, então o app nunca avisava de releases novas;
  agora nasce `true` (desativável nas configurações).
- **Download via DownloadManager nativo do Android** — novo plugin
  `com.carsaimz.xcoder.downloader`: o APK da release vai para a pasta
  Downloads com **notificação nativa de progresso**, sem os timeouts de
  leitura de 60s que matavam o download anterior (o transporte antigo
  agora também usa readTimeout de 30min), com cancelamento, retomada do
  sistema e abertura automática do instalador ao terminar. Cascata
  completa: DownloadManager → download interno (advanced-http) →
  navegador (página de releases).

### English summary

**Git**: clone/push/pull now work in the WebView via a 3-transport HTTP
client (native advanced-http → fetch → CORS proxy); automatic Alpine
terminal fallback for clones that **auto-installs git**; account repo
picker in the Git panel (clone / set active) and repo-aware agent tools
(`repo_list`, `repo_open`, `repo_clone`) with git context in the system
prompt — the bot can download, read, modify, commit and push to a
specific repo. **AI**: catalog additions (Whisper Tiny ~44MB, MMS TTS
English ~58MB), import models by Hugging Face link (task/dtype auto
detection, real sizes) and from device files (copy + manifest, offline
ready). **Update**: update notifications are ON by default again and
the APK downloads through the native Android DownloadManager (progress
notification, no timeouts, installer opens automatically) with
in-app/browser fallbacks.



### Fixed
- **«PATH NOT FOUND» ao baixar modelos** — a causa era a escrita em
  ficheiros que ainda não existem: o `internalFs.writeFile` resolve a
  entrada com `getFile({create: false})`, então gravar um ficheiro novo
  falha com NOT_FOUND_ERR. Toda primeira instalação batia nisso (o
  transporte fetch no 1.º ficheiro e, no Android nativo, a escrita do
  `_manifest.json` DEPOIS de baixar todos os ~200MB). Agora um helper
  `writeModelFile` escreve via `createFile` quando o ficheiro não existe
  e via `writeFile` quando existe — e os testes mockam o comportamento
  real (writeFile falha em ficheiro ausente) para nunca regredir.
- **Painel Git em branco (v1.8.26)** — o painel ligava os corpos com
  `ref={função}`, mas o runtime JSX só instancia refs de objeto
  (`instanceOfRef`): as funções eram descartadas em silêncio,
  `$accountBody`/`$mainBody` ficavam `null` para sempre e
  `renderAccount()`/`refresh()` saíam cedo — ecrã vazio. Agora o painel
  usa instâncias de `Ref()` em todos os cinco corpos, e um teste que
  monta o painel REAL (happy-dom + JSX) garante que a conta e a vista
  principal renderizam (a conta, o welcome sem repo e o re-mount).

### Added
- **Catálogo local expandido (10 LLMs)** — quatro novos modelos, todos
  com tamanhos verificados blob a blob na HF:
  - **LFM2.5 350M** (onnx-community, q4f16, ~258MB, multilingue com
    português) — irmão maior do 230M;
  - **Qwen3 0.6B** (q4f16, ~579MB, multilingue) — raciocínio passo a
    passo e código;
  - **SmolLM2 1.7B** (q4f16, ~1,1GB, inglês) — o SmolLM2 mais capaz;
  - **Qwen2.5 Coder 1.5B** (q4f16, ~1,36GB, multilingue) — o mais forte
    para programar offline.
- **Ecrã de Modelos locais com busca, filtros e ordenação** — campo de
  busca por nome/descrição, chips de idioma (Todos/PT/Multi/EN) e ordenar
  por (mais leve primeiro / maior primeiro / nome A–Z), com estado vazio
  quando nenhum modelo corresponde.

### Changed
- **Redesign visível (temas intactos)** — a camada de tokens agora
  aparece de fato:
  - linhas de lista (Definições, Sobre, Perfil…) viram cartões
    arredondados com superfície `--surface-1`, sem hairlines e com hover/
    press mais claro;
  - o ícone ativo da barra lateral ganha pílula arredondada com a cor de
    destaque (além da barra de acento VS Code);
  - menu de contexto com raio 10px e toast com raio 14px;
  - o ecrã de Modelos locais inteiro segue os tokens (tabs segmentadas,
    cartões com sombra `--shadow-1`, chips e inputs preenchidos).

English summary: fixes the «PATH NOT FOUND» download failure (writes to
not-yet-existing files — fetch transport's first file and the Android
manifest write after ~200MB downloaded — now go through a
createFile-or-writeFile helper, with the test mock mirroring real cordova
NOT_FOUND semantics) and the blank Git panel (function refs were silently
dropped by the JSX runtime; all five bodies now bind through Ref()
instances, with a real-DOM render test). Adds four verified local models
(LFM2.5-350M, Qwen3-0.6B, SmolLM2-1.7B, Qwen2.5-Coder-1.5B — 10 LLMs
total), search/language filters and size/name sorting on the Models
screen, and makes the token redesign visible: list rows become rounded
surface cards, the active sidebar icon gets an accent pill, menus/toast
softer radii.

## [1.8.27] - 2026-11-13

### Added
- **Modelo local LFM2.5 230M (Liquid AI) no catálogo offline** —
  o LLM mais novo da Liquid AI, feito para rodar no aparelho:
  - ~216 MB, multilingue com **português** entre os 10 idiomas
    (en, pt, es, fr, de, it, ar, zh, ja, ko), arquitetura híbrida
    conv+atenção otimizada para CPU — rápido até em telemóveis modestos.
  - Export oficial ONNX (`LiquidAI/LFM2.5-230M-ONNX`, dtype `q4`) no
    runtime transformers.js existente — aparece entre o SmolLM2 135M e o
    360M no ecrã de modelos e no provedor «Local (no aparelho)».
  - Download sob demanda direto do CDN da Hugging Face para o armazenamento
    do aparelho (`xcoder-models/lfm2.5-230m/`) com retomada e manifesto —
    nada entra nos repositórios do XCoder nem passa por qualquer servidor
    nosso (a inferência é 100% local, zero custo de servidor).
  - Ficheiros do catálogo verificados blob a blob na HF: o export Liquid
    não tem `special_tokens_map.json` e usa `chat_template.jinja` à parte —
    listados exatamente para o gestor de downloads não 404.

### Nota
- A variante **«heretic»** (sem censura) só existe em GGUF para
  llama.cpp (~153 MB) — acima do limite de ficheiros do GitHub e
  incompatível com o runtime ONNX; se um dia for desejada, pede um
  segundo motor (llama.cpp WASM). O modelo adicionado é a mesma base
  de 230M no export oficial.

English summary: the local catalog gains Liquid AI's LFM2.5-230M (~216 MB,
Portuguese among 10 languages, hybrid conv+attention built for on-device
speed) as the official ONNX export for the existing transformers.js runtime,
downloaded on demand straight from the Hugging Face CDN into app storage
with resume + manifest — never through our servers or repos, all inference
stays on-device. Catalog files are blob-verified (the Liquid export ships
no special_tokens_map.json and uses a standalone chat_template.jinja).

## [1.8.26] - 2026-11-13

### Added
- **Painel Git configurável no próprio painel (estilo VS Code)** —
  fim da configuração espalhada entre definições e painel:
  - Conta GitHub no topo do painel: entrar (site / device flow / PAT),
    avatar com menu (atualizar perfil, colar PAT, sair) e **auto-cura**:
    quem tem token guardado mas perfil em branco vê o painel buscar o
    perfil sozinho ao abrir (o estado «sessão ativa nas definições mas
    sem conta no git» desaparece).
  - Sem repositório: welcome view com «Inicializar repositório» e
    «Clonar repositório» (igual ao VS Code).
  - Com repositório sem remote: cartão «Publicar no GitHub» — escolhe o
    repositório da conta (ou cola uma URL), liga o `origin` e faz push
    da branch num só fluxo.
  - Menu ... com tudo: publicar/alterar remote, branches (trocar, criar,
    apagar), pull, push, fetch, clonar e remover remote.
  - Secções Staged/Changes/Untracked colapsáveis com ações por ficheiro
    (preparar, despreparar, descartar, abrir), letras A/M/D/U e
    ahead/behind no cabeçalho da branch.
  - Snapshots locais continuam como fallback para projetos sem git.

### Changed
- **Redesign dos componentes e do CSS base (temas intactos)** — novo
  sistema de tokens (`styles/tokens.scss`): escala de raios, superfícies
  `color-mix`, hairlines, sombras em camadas, focus ring e motion, todos
  derivados das variáveis de tema (qualquer tema continua a vestir tudo).
  Inputs passam a ser preenchidos com borda e focus ring; diálogos e
  menus têm linhas alinhadas à esquerda, hover arredondado e sem
  caixa-alta; toast, janelas flutuantes, botões e listas seguem os tokens.
- **Definições GitHub enxutas** — apenas a conta (entrar/PAT/sair);
  repositório, remote e branch passam a ser configurados no painel Git
  (nova linha abre o painel diretamente).

### Fixed
- Remote removível (`git remote remove origin`) e push com guarda:
  «faça um commit antes de publicar a branch» em vez de falha críptica.

English summary: the Git panel is now self-contained (VS Code style) —
account sign-in/refresh/PAT/logout at the top with automatic profile
heal for stored tokens, a welcome view (Initialize/Clone repository) when
there is no repo, a Publish-to-GitHub card that wires `origin` and pushes
in one flow, a ... menu with every git command, and collapsible
Staged/Changes/Untracked sections with per-file actions. GitHub settings
shrink to account-only; repository/remote/branch live in the panel. Base
CSS got a design-token layer (radii, surfaces, hairlines, layered
shadows, focus ring, motion) derived from theme variables — themes stay
untouched while dialogs, menus, inputs, buttons, toast and floating
windows adopt the new language.

## [1.8.25] - 2026-11-08

### Fixed
- **PC: «storage is unavailable / File encoding error» no arranque** —
  toda a leitura de ficheiros no desktop falhava em dupla falha: o XHR
  para `file://` era bloqueado (faltavam as flags
  `allowFileAccessFromFileUrls`/`allowUniversalAccessFromFileUrls`) e o
  fallback do FileReader crashava («parameter 1 is not of type 'Blob'»,
  o File do plugin vendido não é um Blob real). O `internalFs.readFile`
  agora usa o `nativeURL` (`file://`) no desktop e converte qualquer
  falha do FileReader no código numérico 4 («File not readable»); o
  check da pasta de plugins no arranque já não derruba o boot; a splash
  mostra a 1ª linha do stack quando algo falha (diagnóstico).
- **Android: painel Git sem conta nem repositório** — a causa era de
  fluxo: o login do site (Supabase) guardava a sessão da CONTA mas
  descartava o `provider_token` do GitHub; o painel Git precisa de um
  token GITHUB (fluxo GitHub App separado). Agora «Entrar com GitHub»
  no site devolve o token do GitHub no mesmo fragmento e o app faz a
  ponte automaticamente: token guardado, perfil @login carregado, painel
  Source Control com conta e repositórios de imediato (estilo VS Code:
  um login, git a funcionar). Quem já tem sessão mas sem GitHub usa o
  botão «Entrar» do cartão do painel Git (fluxo web/dispositivo).

English summary: desktop file reads failed twice (file:// XHR blocked by
missing webPreferences flags + FileReader fallback crashing on the
vendored non-Blob File) — readFile now prefers the file:// nativeURL on
desktop and maps failures to numeric codes; the boot no longer dies on a
plugin-dir hiccup and the splash prints the failing stack line. The git
panel was empty because the site login (Supabase) dropped the GitHub
provider_token — the site now forwards it and the app auto-bridges it
into the git session (one login → Source Control live). Existing
sessions connect via the panel's sign-in button.

## [1.8.24] - 2026-11-08

### Fixed
- **Ícones desaparecendo em todo o app (welcome, header do editor,
  janelas flutuantes, árvore de ficheiros)** — desde a v1.8.21 o
  `output.publicPath` relativo (`./build/`, necessário para o desktop
  em `file://`) passou a ser embutido TAMBÉM nos `url()` do CSS, embora
  o CSS extraído já viva dentro de `build/`; o browser resolvia
  `build/build/icons.ttf` (404) e a fonte de ícones nunca carregava —
  todos os glifos ficavam em branco (o css-loader v7 removeu a opção
  `publicPath`, que permitia separar os dois). Um plugin do rspack
  (`FixCssAssetUrls`) reescreve os `url()` dos assets para
  sibling-relative no pós-emit; válido para Android, desktop e dev
  server, e cobre também as fontes KaTeX e imagens (logo/about).

English summary: since v1.8.21 the relative `output.publicPath` was also
baked into CSS `url()` assets while the extracted CSS already lives inside
`build/` — browsers resolved `build/build/icons.ttf` (404) and the icon
font never loaded, blanking every icon-font glyph app-wide (welcome,
editor header, floating windows, file tree; KaTeX fonts and images too).
A tiny rspack post-emit plugin (`FixCssAssetUrls`) rewrites CSS asset
urls to sibling-relative on every platform and every CI workflow.

## [1.8.23] - 2026-11-07

### Added
- **Git real no painel Source Control (isomorphic-git)** — o painel Git
  deixa de ser "snapshots + comandos preparados": agora há git de verdade
  dentro da pasta do projecto (`.git` real) — init, status com secções
  **Preparadas / Mudanças / Sem rastreio** (estilo VS Code), stage/unstage
  por ficheiro ou tudo, discard com confirmação, commit, histórico
  (checkout + copiar hash), branches (criar/trocar/eliminar), push, pull,
  fetch, clone e ahead/behind por branch.
- **Credential manager estilo VS Code** — o token da sessão (site/device
  flow/PAT) é usado automaticamente em push/pull/clone (`lib/git/
  credentials.js`); em 401 o app pede um PAT uma vez e pode guardá-lo.
  Tokens finos/App usam `x-access-token` como utilizador.
- **`git` no terminal (vshell) e integração bidirecional** — o terminal
  da IA (e o `vshell`) ganhou `git init|status|add|commit|log|branch|
  checkout|push|pull|fetch|remote|clone` sobre o mesmo motor; toda
  mutação (de qualquer superfície) refresca o painel via
  `lib/git/events.js` e acções do painel ecoam o comando no terminal
  aberto (`[xcoder] git …`).
- **Multiselecção no Explorador (estilo VS Code)** — Ctrl/⌘-clica
  alterna, Shift-clica selecciona intervalo; no toque, «Selecionar» no
  menu de contexto entra no modo de selecção (toque alterna, segure
  abre o menu de acções). Acções em massa: abrir (até 10 ficheiros),
  copiar, cortar e eliminar com uma confirmação; «Selecionar tudo» e
  «Sair da selecção». A área de transferência de pastas passou a
  suportar múltiplos itens (colar em lote).
- **Assinatura de código Windows (setup)** — o workflow Desktop assina
  o setup NSIS e o exe portátil quando os segredos
  `WINDOWS_CSC_LINK` (PFX em base64) e `WINDOWS_CSC_KEY_PASSWORD`
  existem; sem segredos compila não-assinado sem falhar. Guia completo
  em `docs/CODE_SIGNING.md` (certificado, segredos, verificação
  signtool, EV/Azure Trusted Signing).

### Fixed
- Detecção de estado do git com a matriz real do isomorphic-git
  (`[head, workdir, stage]`) — untracked/modificado/preparado/eliminado
  classificados por tabela de verdade testada contra a biblioteca.
- `desktop/package.json` sincronizado com a versão do app no build
  (`utils/config.js`).

### Changed
- Painel Git reorganizado: cartão de conta, cartão de repositório
  (picker partilhado), cartão Source Control (branch + pull/push +
  ficheiros) e Histórico; os snapshots locais continuam como recurso
  secundário em projectos sem git.
- `isomorphic-git` entra como dependência e é empacotado num chunk
  lazy (só carrega quando o painel Git abre); fallback `buffer` no
  rspack para o build web.

## [1.8.22] - 2026-11-07

### Added
- Biome blocking no CI, boot smoke, ratchet checkJs em lib/ai

### Fixed
- Check-plugin-refs usa imports com protocolo node:
- Setup órfão, sync desktop e docs npm

### Changed
- Biome --write normaliza biome.json e utils/config.js (escopo utils/)
- Normalize src/ formatting via biome check --write

### Maintenance
- Scripts/archive, remove webpack.config.js legado, docs


## 🇧🇷 Português

Todas as mudanças notáveis do **XCoder** ficam neste ficheiro. As entradas
históricas estão em pt-br; a partir da v1.6.2 cada release traz também um
resumo em inglês.

## [1.8.20] - 2026-11-06

### Added
- **Menu nativo no desktop (Windows/Linux)** — barra de menus Arquivo,
  Editar, Visualizar, Terminal e Ajuda: novo arquivo, abrir arquivo/pasta,
  salvar/salvar tudo, fechar abas, desfazer/refazer, área de transferência,
  localizar arquivo, paleta de comandos, ampliar/reduzir zoom (persistente),
  alternar barra lateral, tela cheia, novo terminal, console, documentação,
  releases, reportar bug, **verificar atualizações** (compara a versão com a
  última release do GitHub) e dialog **Sobre**. Etiquetas em pt-BR ou inglês
  conforme o idioma do sistema.
- **Ponte menu → comandos do app** — o menu envia os mesmos comandos do
  registro interno (`lib/commands` e comandos do CodeMirror) via
  `lib/desktopMenu.js`; os aceleradores já usados pelo app são exibidos mas
  NÃO registados no SO (`registerAccelerator: false`), preservando atalhos
  remapeados pelo utilizador.

### Changed
- `package-lock.json` ressincronizado com a versão actual (estava em 1.8.9).

## [1.8.21] - 2026-11-06

### Fixed
- **O app PC (Windows/Linux) arrancava sempre no ecrã de splash com
  "Update Android WebView or Chrome. Uncaught ReferenceError: strings is not
  defined"** — a primeira chamada nativa do arranque
  (`System.get-available-encodings`) não existia no runtime desktop e o
  callback de erro referenciava o global `strings`, que só é criado mais
  tarde pelo `lang.set()`. Correção em várias camadas:
  - `initEncodings()` já não depende de `strings` nem rejeita: usa
    `console.warn` e um mapa de charsets predefinido (UTF-8, ISO-8859-1,
    windows-1252, UTF-16LE/BE, ASCII), mantendo o boot vivo e o seletor de
    codificação funcional mesmo sem resposta nativa.
  - O serviço `System` do desktop implementa `get-available-encodings`,
    `decode` (TextDecoder full-ICU) e `encode` — a conversão de charsets de
    ficheiros passa a funcionar no PC.
  - Shim `BuildInfo` no preload (versão, versionCode monotónico a partir do
    semver, packageName) — o boot seguinte morreria em "BuildInfo is not
    defined".
  - Erros de ficheiro voltam a seguir o contrato do Android: o IPC envia o
    código numérico do FileError (1 = NOT_FOUND, …) e o preload reconstrói
    esse número — `exists()` deixa de rejeitar para caminhos inexistentes
    (causava "storage is unavailable" no arranque).
  - Os diretórios de dados (`files/`, `cache/`) são criados no arranque do
    desktop, como o Android faz nativamente.
  - `publicPath` do bundle passa a relativo (`./build/`): sobre `file://` os
    chunks dinâmicos (incluindo os JSON de idioma) falhavam com
    ChunkLoadError e o app ficava sem traduções.
  - Stub `statusbar` instalado correctamente (o BarProp nativo do browser
    tornava o guarda `if (!window.statusbar)` inoperante).
  - `HandleIntent` tolera intent `null` (arranque sem deep link no desktop).
- **Mensagem do splash consciente da plataforma** — no PC o erro de arranque
  sugere reinstalar/reportar em vez de "Update Android WebView"; rede de
  segurança `window.strings = {}` criada antes de qualquer módulo.

### Added
- Testes unitários para o fallback de `initEncodings` (4 novos; 1185 no
  total).

## [1.8.19] - 2026-11-06

### Added
- **Versão para PC (Windows + Linux)** — o novo workflow `Desktop` publica em
  cada release o instalador NSIS + o .exe portátil (Windows) e AppImage + .deb
  (Linux). A mesma interface web corre num shell Electron com uma camada de
  compatibilidade Cordova própria: `cordova-plugin-file` → Node fs (com as
  classes originais do plugin — Entry/FileWriter/FileReader), plugin `sdcard`
  → Node fs + diálogos nativos, plugin `system` → Electron (shell, área de
  transferência, tema), `Executor`/terminal → shell real do sistema com
  streaming por linhas, pré-visualização → servidor http local e deep links
  `xcoder://` registados no SO, para o login via site voltar ao app
  exactamente como no Android.
- **Testes de shim locais** — o runtime de compatibilidade (mini cordova +
  exec por IPC + registry de plugins) tem teste de fumaça que valida o ciclo
  completo: carregamento dos plugins, `deviceready`, leitura/escrita via
  `Entry`/`FileWriter`, `sdcard`, `system`, streaming do `Executor` e clipboard.

### Notas
- No desktop o terminal usa a shell do sistema (bash/PowerShell) em vez do
  Alpine/proot; o restante — editor, IA, plugins, temas — é igual ao Android.

## [1.8.18] - 2026-11-05

### Changed
- **Login apenas pelo site** — a página de conta deixou de pedir
  e-mail/palavra-passe (e os botões OAuth do app saíram): o login da
  conta XCoder acontece SOMENTE no site oficial. O botão «Entrar pelo
  site» abre o navegador, o utilizador entra lá (e-mail, Google ou
  GitHub) e a sessão volta sozinha via deep link `xcoder://auth/oauth`;
  quem preferir continua podendo colar o link de retorno à mão. Nenhuma
  credencial é digitada dentro do app.
- **GitHub: site primeiro** — o seletor de métodos saiu; com o site
  configurado, «Entrar com GitHub» abre directamente o fluxo web do
  GitHub App (o site troca o código no servidor e devolve a sessão via
  `xcoder://github/session`). Sem configuração no site, cai para o
  Device Flow (também no navegador); o PAT manual deixou de ser opção
  do seletor e continua disponível como campo avançado em Definições ›
  GitHub.
- **Ferramentas da IA em linha compacta** — cada tool call aparece como
  um «chip» amigável («Criou src/app.js», «Executou npm test», «Pesquisou
  na web: "..."») com ícone por tipo de acção, em vez do nome cru da
  ferramenta; os argumentos (JSON) e a saída completa ficam escondidos
  e só aparecem ao tocar na linha — o transcript deixou de despejar o
  conteúdo inteiro dos ficheiros criados.

### Added
- **Rótulos traduzidos para as ferramentas da IA** — 25 novas chaves de
  tradução (pt-br, en-us) descrevem cada ferramenta em linguagem natural.

### Fixed
- **Meio-traduzido acabou** — `lib/lang` agora funde `en-us` DEBAIXO do
  idioma escolhido: idiomas parciais (647 chaves novas desde a última
  tradução) mostram inglês em vez de cair em fallbacks codificados
  (maioria em português) no meio de outra língua.
- **Español completo** — as 647 chaves que faltavam em `es-sv.json`
  foram traduzidas (1.059 → 1.706; cobertura total vs en-us), com
  placeholders, tags HTML e nomes técnicos preservados.
- **pt-br normalizado** — 10 textos com formas de português europeu
  («ficheiro», «utilizador», «se precisares») convertidas para pt-BR
  («arquivo», «usuário», «se precisar»).

### Docs
- README (pt + en) actualizado ao estado actual: terminal Alpine real
  no agente, chat com tools compactas, login apenas pelo site,
  estrutura `lib/ai/` com as novas tools; «Sem conta» trocado por
  «conta opcional via site».

## [1.8.17] - 2026-11-05

### Added
- **IA com terminal real** — o agente ganhou a ferramenta «terminal»:
  abre e fecha o Terminal (Alpine Linux) do app, executa QUALQUER
  comando (apk, git, node, python, npm, curl, builds…), espera o
  comando terminar, captura a saída e o código de saída e decide o
  passo seguinte sozinho. Detecção de fim por marcador único no PTY
  (com eco ignorado), saída ANSI limpa e truncada (8k caracteres,
  cabeça+cauda), Ctrl+C disponível («signal») para comandos presos,
  tempo por comando ajustável (90s padrão, até 300s) e execuções
  serializadas (um comando de cada vez). Comandos interactivos em
  ecrã inteiro (vim/htop) ficam documentados como a evitar.

### Fixed
- **«Abrir pasta» desaparecia ao fechar todos os projectos** — o
  Explorador agora mostra um estado vazio à la VS Code («Nenhuma pasta
  aberta» + botão «Abrir pasta» funcional) em vez de ficar em branco;
  ao fechar o último projecto sem ficheiros abertos, a aba Boas-vindas
  volta sozinha com o botão grande. Era impossível abrir um novo
  projecto sem reiniciar o app.
- **Projectos duplicados** — abrir a mesma pasta por caminhos com
  forma diferente (com/sem barra final, SAF vs doc id) criava dois
  cartões do mesmo projecto; a verificação de duplicados compara
  agora URLs normalizados (o mesmo critério do openFolder.find), e o
  saveState também elimina duplicados de sessões antigas ao gravar.

## [1.8.16] - 2026-11-04

### Added
- **Acções de título de vista (VS Code)** — a barra de título do painel
  da sidebar passou a alojar botões-ícone à direita (paridade com o
  Explorer do VS Code). O Explorador ganhou quatro: «Novo ficheiro»,
  «Nova pasta», «Actualizado» (recarrega todas as pastas abertas) e
  «Colapsar tudo». As apps registram as suas acções via `titleActions`
  (array ou fábrica — à prova de mudança de idioma; fábrica que lança
  degrada para sem acções em vez de matar a activação).
- **Linha do tempo local do ficheiro (VS Code Timeline)** — cada
  gravação guarda uma captura do ficheiro em
  `<dados>/timeline/<hash>/<timestamp>.txt` (máx. 20 capturas / 2 MB por
  ficheiro, gravações idênticas consecutivas são desduplicadas, ficheiros
  acima de 512 KB são ignorados e falhas de armazenamento nunca quebram
  a gravação). «Menu do ficheiro › Linha do tempo» abre a página com
  horas relativas, tamanho e botão Restaurar — restaura no disco e
  recarrega a aba aberta mantendo o cursor; «Limpar linha do tempo»
  remove tudo. Interruptor «Linha do tempo» em Definições › Editor
  (ligado por defeito).

### Changed
- **«Ir para ficheiro» difuso (Quick Open)** — a pesquisa de ficheiros
  (Ctrl-P) trocou a busca por sub-cadeia por pontuação difusa com os
  bónus do VS Code: início da cadeia, fronteiras de palavra, sequências
  consecutivas e correspondência no nome (vs. pasta). Empates ficam por
  prioridade: abas abertas, depois usados recentemente, depois o índice
  nativo; os caracteres correspondentes ficam realçados no resultado.

### Accessibility
- **prefers-reduced-motion respeitado globalmente** — as animações
  decorativas (ondulação, transições de páginas, janela flutuante,
  quicktools, tooltips) desligam-se quando o SO pede movimento reduzido
  (WCAG 2.3.3), com interruptor global de duração para o resto.

## [1.8.15] - 2026-11-03

### Changed
- **Barra de actividades só com glifos** — os ícones da sidebar deixaram
  de ter legendas (nada de nomes debaixo/ao lado dos ícones) e as
  categorias («Vistas»/«Ferramentas»/«Conta») saíram da barra. O nome
  aparece só quando a opção é pressionada, na barra de título do painel
  (o «view title» do VS Code), e ao manter o dedo no ícone.
- **Design de todas as páginas** — o cabeçalho de cada página (sobre,
  definições, perfil, plugins, ficheiros…) troca a barra colorida de
  app móvel pelo estilo VS Code: barra da cor do fundo, título
  alinhado à esquerda junto à seta de voltar, 35px e filete inferior.
  As listas ficaram mais densas (linhas de 48px com hover e foco) e o
  conteúdo ganha uma coluna de leitura centrada em ecrãs largos.
  Cartões arredondados (12px+) ficaram widgets de 3px nas páginas
  Sobre, Perfil, Modelos, Apoio, Temas, Novidades, Markdown,
  Quicktools e Processos.

### Removed
- **Skills «Codex» e «Claude Code»** — cascas vazias (prompts que só
  imitavam os CLIs, sem agente por trás). Removidas a pedido; para
  agentes completos, instale o opencode (ou similar) pelo terminal.

## [1.8.14] - 2026-11-03

### Added
- **Minimapa (VS Code)** — visão geral do código na borda direita do
  editor: uma barra por linha (indentação + comprimento) com as cores
  dos tokens por cima (strings, comentários, números, palavras-chave e
  tags, lidos da árvore de sintaxe Lezer), cursor de viewport
  arrastável, toque/arrasto para rolar até ao ponto. Esconde-se nas
  páginas (boas-vindas/terminal), cada painel dividido tem o seu, e há
  um interruptor em Configurações > Editor («Minimapa»).
- **Painel de IA ancorado** — o chat de IA abre por padrão como painel
  acoplado à borda direita do ecrã (o «secondary side bar» do VS Code):
  redimensionável pela borda esquerda, termina acima da barra de estado
  (que continua a atravessar toda a largura, como no VS Code) e acima do
  rodapé de quicktools. As janelas flutuantes continuam POR CIMA do
  painel (nunca ficam escondidas atrás dele) e desviam-se da sidebar. O
  botão de alfinete no cabeçalho do chat alterna entre painel ancorado e
  janela flutuante (preferência guardada; toque de novo no ícone da
  barra de actividades fecha/reabre o painel).
- **Pesquisa nas Bibliotecas e nas Ferramentas web** — caixa de pesquisa
  no painel de bibliotecas (por id, nome, descrição e licença, com
  «nenhuma biblioteca encontrada» quando vazia) e no seletor de
  ferramentas web (filtra as linhas por título e descrição). A caixa não
  perde o foco ao escrever.
- **Filtro Free/Pago nos modelos de IA** — o seletor de modelos ganhou
  chips «Todas / Free / Pago» (a escolha fica lembrada) que se combinam
  com a pesquisa; grupos de provedores só aparecem quando têm modelos
  do tipo escolhido.

### Changed
- **Reestruturação VS Code (estrutura, não só cores)** — ordem da barra
  de actividades igual à do VS Code (Explorador, Pesquisa, Git, IA,
  Extensões; ferramentas depois do separador); breadcrumbs do ficheiro
  activo entre os separadores e o código («pasta › ficheiro», um por
  painel, relativo à raiz do projecto); etiquetas da barra lateral
  passaram a ficar AO LADO dos glifos (linha única, nunca partem para
  baixo do ícone) e escondem-se no modo rail de 52px; barra lateral
  expande até 90% do ecrã (o deslize no telemóvel vai a 92%) com
  predefinição mais larga (62vw, mínimo 320px).
- **Economia de tokens da IA** — o histórico completo deixa de ser
  reenviado em cada pedido: janela deslizante de 24 mensagens (turnos
  antigos colapsam num marcador único, sem «orfãos» de tool calls),
  saídas de ferramentas de turnos anteriores comprimidas para ~400
  caracteres, resultados de ferramentas limitados a 8000 caracteres ao
  entrarem no histórico e contexto do projecto mais enxuto (12 ficheiros
  abertos / 25 entradas da raiz). Conversas longas custam muito menos em
  provedores pagos e gratuitos.

## [1.8.20] - 2026-11-06

### Added
- **Native desktop menu (Windows/Linux)** — File, Edit, View, Terminal and
  Help menu bar: new file, open file/folder, save/save all, close tabs,
  undo/redo, clipboard, find file, command palette, zoom in/out/reset
  (persisted), toggle sidebar, full screen, new terminal, console,
  documentation, releases, bug reporting, **check for updates** (compares
  the installed version with the latest GitHub release) and an **About**
  dialog. Labels follow the OS locale (pt-BR or English).
- **Menu → app command bridge** — the menu dispatches the very same commands
  the app UI uses (`lib/commands` and CodeMirror commands) through
  `lib/desktopMenu.js`; accelerators already bound by the app are displayed
  but NOT registered with the OS (`registerAccelerator: false`), keeping
  user-remapped key bindings working.

### Changed
- `package-lock.json` re-synced with the current version (was stuck at
  1.8.9).

## [1.8.21] - 2026-11-06

### Fixed — PC builds failed to boot ("strings is not defined")
- The Windows/Linux app always died on the splash screen with
  "Update Android WebView or Chrome. Uncaught ReferenceError: strings is not
  defined". Root cause chain, fixed layer by layer:
  - The first native boot call (`System.get-available-encodings`) did not
    exist in the desktop runtime and its error callback referenced the
    `strings` global, only populated later by `lang.set()`. `initEncodings()`
    now never touches `strings`, never rejects, and seeds a default charset
    map (UTF-8, ISO-8859-1, windows-1252, UTF-16LE/BE, ASCII).
  - The desktop `System` service implements `get-available-encodings`,
    `decode` (full-ICU TextDecoder) and `encode` — file charset conversion
    now works on PC.
  - `BuildInfo` shim in the preload (version, monotonic versionCode from
    semver, packageName) — boot would have crashed next with "BuildInfo is
    not defined".
  - File errors follow the Android contract again: IPC carries the numeric
    FileError code (1 = NOT_FOUND, …) and the preload rebuilds it —
    `exists()` no longer rejects for missing paths (caused the follow-up
    "storage is unavailable" splash).
  - Data directories (`files/`, `cache/`) are created at desktop startup,
    like Android does natively.
  - Bundle `publicPath` is now relative (`./build/`): over `file://` dynamic
    chunks (including language JSONs) failed with ChunkLoadError, leaving
    the app without translations.
  - `statusbar` stub installed correctly (the browser's built-in BarProp
    made the `if (!window.statusbar)` guard a no-op).
  - `HandleIntent` tolerates a `null` intent (desktop launch without deep
    link).
- Platform-aware splash error message — on PC it suggests reinstalling /
  reporting the issue instead of "Update Android WebView"; a
  `window.strings = {}` safety net is created before any module loads.

### Added
- Unit tests for the `initEncodings` fallback (4 new; 1185 total).

## [1.8.19] - 2026-11-06

### Added
- **Desktop version (Windows + Linux)** — the new `Desktop` workflow attaches
  to every release: NSIS setup + portable .exe (Windows) and AppImage + .deb
  (Linux). The same web UI runs in an Electron shell backed by its own Cordova
  compatibility layer: `cordova-plugin-file` → Node fs (with the plugin's
  original Entry/FileWriter/FileReader classes), the `sdcard` plugin → Node fs
  + native dialogs, the `system` plugin → Electron (shell, clipboard, theme),
  `Executor`/terminal → the real system shell with line streaming, live
  preview → a local http server, and OS-registered `xcoder://` deep links so
  site-based login returns to the app exactly like on Android.
- **Local shim tests** — the compatibility runtime (mini cordova + IPC exec +
  plugin registry) has a smoke test covering the full loop: plugin loading,
  `deviceready`, Entry/FileWriter reads and writes, `sdcard`, `system`,
  `Executor` streaming and clipboard.

### Notes
- On desktop the terminal uses the system shell (bash/PowerShell) instead of
  Android's Alpine/proot; everything else — editor, AI, plugins, themes — is
  identical.

## [1.8.18] - 2026-11-05

### Summary
- **Site-only sign-in**: the account page no longer asks for e-mail or
  password and the in-app OAuth buttons are gone — XCoder sign-in
  happens ONLY on the official site. A «Sign in on the site» button
  opens the browser and the session returns automatically via the
  `xcoder://auth/oauth` deep link; a paste-link fallback remains.
- **GitHub: site first**: the method chooser is gone — with the site
  configured, sign-in goes straight to the GitHub App web flow (code
  exchanged server-side, session returned via `xcoder://github/session`);
  the Device Flow remains as a browser-based fallback and the manual PAT
  stays as an advanced Settings field.
- **Compact AI tool rows**: every tool call renders as a friendly chip
  («Created src/app.js», «Ran npm test») with a per-action icon; raw
  arguments and full output stay hidden until tapped — no more dumped
  file contents in the transcript.
- **Translation fixes**: partial locales now fall back to English
  (en-us merged underneath) instead of hardcoded Portuguese;
  Spanish (es-sv) is complete (647 keys translated, full coverage);
  pt-BR normalized (10 pt-PT forms fixed); 25 new AI tool label keys.

## [1.8.17] - 2026-11-05

### Added
- **AI with a real terminal** — the agent gained a «terminal» tool:
  it opens and closes the app's Terminal (Alpine Linux), runs ANY
  command (apk, git, node, python, npm, curl, builds...), waits for
  completion, captures output + exit code and decides the next step on
  its own. Completion is detected with a unique PTY marker (echo-safe),
  output is ANSI-cleaned and clamped (8k chars, head+tail), Ctrl+C is
  available via the «signal» action, per-command timeout is tunable
  (90s default, up to 300s) and runs are serialized (one at a time).

### Fixed
- **«Open Folder» vanished after closing all projects** — the Explorer
  now shows a VS Code-style empty state («No folder opened» + a working
  Open Folder button) instead of going blank; when the last project
  closes with no editor files open, the Welcome tab comes back on its
  own with the big button. Opening a new project used to require an
  app restart.
- **Duplicate projects** — opening the same folder through differently
  shaped paths (trailing slash, SAF vs doc id) created two tiles for
  one project; the duplicate check now compares normalized URLs (same
  criterion as openFolder.find) and saveState also dedupes legacy
  sessions while persisting.

## [1.8.16] - 2026-11-04

### Summary
- **View title actions**: the sidebar panel title bar now hosts icon
  buttons on its right edge (VS Code Explorer parity). The Explorer gets
  New File, New Folder, Refresh and Collapse All; apps register actions
  via `titleActions` (static array or throwing-safe factory).
- **Local file timeline (VS Code Timeline)**: every save stores a
  snapshot (max 20 / 2 MB per file, identical saves de-duplicated);
  File menu > Timeline lists them with relative times and a Restore
  button that writes to disk and reloads the open tab keeping the
  cursor. Settings > Editor > Timeline toggles it (on by default).
- **Fuzzy Quick Open**: Ctrl-P file search now scores matches like VS
  Code (start-of-string, word boundaries, consecutive runs, basename
  beats folder) and highlights the matched characters. Ties rank open
  tabs first, then recents, then the native index.
- **prefers-reduced-motion** is honoured globally (WCAG 2.3.3).

## [1.8.15] - 2026-11-03

### Summary
- **Glyph-only activity bar**: rail icons lost their captions and the
  category groups went away — the app name now appears only when the
  option is pressed, in the panel title bar (VS Code "view title"),
  plus the long-press tooltip.
- **Every page redesigned** with the VS Code design language: flat
  page-background header with a left-aligned title next to the back
  chevron (35px, hairline), denser 48px list rows with hover/focus
  states and a centered reading column on wide screens. Rounded cards
  became squared 3px widgets across About, Profile, Models, Support,
  Themes, Changelog, Markdown, QuickTools and Processes.
- **Removed** the "Codex" and "Claude Code" AI skills — empty shells
  (prompt playbooks, not real agents). Install opencode or similar via
  the terminal for full agents.

## [1.8.14] - 2026-11-03

### Summary
- New **minimap**: a VS Code code overview on the editor's right edge —
  per-line bars with Lezer token colors (strings, comments, numbers,
  keywords, tags), a draggable viewport cursor and tap/drag scrolling.
  Per split pane, hidden on non-editor pages, toggle in Settings >
  Editor.
- New **anchored AI panel**: the chat opens by default docked to the
  right edge (VS Code "secondary side bar") — resizable, ending above
  the full-width status bar. Floating windows stay ABOVE it; the pin
  button in the chat header switches between anchored panel and floating
  window (persisted).
- **Search** in the Libraries panel and the web-tools picker; the model
  picker gained **All / Free / Paid** filter chips (persisted) that
  combine with the search box.
- **VS Code structure pass**: activity bar order now matches VS Code
  (Explorer, Search, Git, AI, Extensions); per-pane **breadcrumbs**
  between the tabs and the code; sidebar labels sit beside the glyphs
  (never wrap below) and hide in rail mode; the sidebar expands up to
  90% of the screen.
- **AI token economy**: a sliding 24-message window replaces the
  full-history resend, older tool outputs collapse to ~400-char stubs,
  new tool results are capped at 8000 chars and the workspace context
  shrank — long conversations cost far fewer tokens on paid and free
  providers.

## [1.8.13] - 2026-11-02

### Changed
- **Visual ainda mais VS Code** — separadores de arquivos com o estilo
  Dark Modern verdadeiro (o ativo derrete no editor com o filete azul no
  topo e peso médio; os inactivos ficam planos na faixa #181818); barra
  de actividades sem a caixa de fundo arredondada no ícone activo
  (agora só o filete de 2px e o glifo a opacidade total, como no VS
  Code); paleta de comandos e listas de sugestões como «quick input»
  flutuante (cantos 6px nos quatro lados, sombra elevada); menus de
  contexto com selecção tingida pelo azul; quicktools sem o «salto» dos
  ícones (feedback por tinte suave); barra de pesquisa plana com fio
  inferior.
- **Barra de estado com caminho do arquivo** — o lado esquerdo passa a
  mostrar o caminho do arquivo activo em estilo breadcrumbs
  (pasta › arquivo), esmaecido, com os diagnósticos LSP ao lado.
- **Cabeçalho «EXPLORER» no painel de arquivos** — o painel de arquivos
  da barra lateral abre com o título da vista em maiúsculas com
  espaçamento de letras (fixo no topo, com fio inferior), como a vista
  Explorer do VS Code.

### Fixed
- **Builds verdes (v1.8.12.1)** — o comentário XML do splash continha
  «--» (duplo hífen é proibido dentro de comentários XML): o parser
  expat do cordova rejeitava o config.xml inteiro e TODAS as compilações
  caíam em «No platforms added to this project». Comentário corrigido e
  «cordova platform add» agora falha ALTO (sem «|| true»), com
  preferência pelo cordova-android fixado em node_modules e tentativa
  nova no registo — nos quatro workflows (release, debug, prerelease,
  preview).

### Tests
- 1086/1086 no total (sem alterações de cobertura; alterações visuais
  cobertas pelas suítes existentes).

<a id="english-1"></a>

## [1.8.12] - 2026-11-02

### Fixed
- **Inserir no editor (raiz verdadeira)** — a v1.8.11 curava os sintomas,
  mas as ferramentas dev e as bibliotecas ainda falhavam sempre: ambas
  importavam a FUNÇÃO-fábrica assíncrona de «lib/editorManager» e liam
  «.activeFile» da própria função (sempre «undefined») — por isso o
  aviso «não há arquivo aberto no editor» aparecia mesmo com arquivos
  abertos. Agora leem a instância viva «window.editorManager» (como a
  IA já fazia), com teste de regressão que proíbe o import errado.
- **Splash de Cordova com o logo oficial** — o cordova-android valida
  «AndroidWindowSplashScreenAnimatedIcon» com fs.existsSync(): o valor
  «@mipmap/ic_launcher_fg» (v1.8.11) nunca existe como ficheiro e a
  compilação caía no robô predefinido do Cordova («o logo saiu de
  vez»). O novo «res/splash-icon.png» (marca oficial, 960×960 com
  margem de segurança para a máscara circular) é agora apontado por
  caminho real e copiado como «ic_cdv_splashscreen.png» no prepare.

### Changed
- **O espaço do sidebar só existe para apps que abrem nele** — o menu
  categorizado que ocupava a área dos painéis foi removido: com só
  ferramentas em janela activas, a sidebar colapsa para a barra de
  ícones de 52px (modo «rail-only»); escolher um app acoplado
  (arquivos, plugins, notificações…) devolve o painel completo. Os
  TÍTULOS das opções ficam agora À FRENTE dos ícones na própria barra
  (rótulo acima do glifo, por pedido do utilizador).
- **Janelas flutuantes já não cobrem nada** — a janela desceu para o
  nível z 106 (sob a sidebar 109, páginas 108, menus de contexto 111 e
  diálogos 999+); ao abrir a sidebar com uma janela aberta, a janela
  desliza para o lado da sidebar («avoidSidebar») em vez de ficar por
  cima das opções.
- **Mais temas VS** — seis temas novos no estilo do VS Code desktop:
  VS Dark+ e VS Light+ (barra de estado azul clássica), VS Light
  Modern, VS Monokai e os dois Solarized; o par claro usa o novo tema
  de editor «vscodeLight» (tokens Light+ reais). Todos gratuitos.
- **Barra de estado estilo VS Code** — faixa fina no fundo com dados
  reais do editor: linha/coluna (toca abre «ir para linha»),
  indentação (espaços/tamanho de tabulação), codificação (toca abre a
  paleta) e linguagem (toca abre a paleta de modos), mais erros/avisos
  do LSP quando existem; esconde-se quando não há arquivo aberto
  (boas-vindas, terminal) e sobe acima da barra de quicktools.

### Tests
- 13 novos (ponte do editor 3, temas VS 4, barra de estado 5, e o
  teste sidebarMenu foi reescrito como sidebarRailOnly): 1086/1086 no
  total.

## [1.8.11] - 2026-11-02

### Fixed
- **Inserir no editor (de vez)** — a mensagem «não há arquivo aberto no
  editor» aparecia mesmo com arquivos abertos: os quatro botões de
  inserir (IA no chat e nos blocos de código, ferramentas dev e
  bibliotecas) agora partilham um único caminho
  («insertIntoEditorFile») que (1) recolhe os arquivos de editor de
  todas as abas e painéis, (2) activa o mais recente quando a aba atual
  é uma página (IA, terminal, boas-vindas) e (3) espera até ~1s o
  CodeMirror ficar pronto antes de falhar. A IA deixou de falhar quando
  o próprio chat é a aba ativa.

### Changed
- **Visual VS Code (Dark Modern)** — o tema predefinido «Xcoder» foi
  repintado com a paleta do VS Code: chrome #181818, editor/menus
  #1f1f1f, texto #cccccc, azul de acção #0078d4 (botões incluídos — o
  laranja de CTA foi reformado) e tema do editor «vscodeDark». Cabeçalho
  plano de 40px com fio de 1px (sem sombra), separadores de arquivos
  planos (o ativo derrete no editor), janelas flutuantes com raio 6px e
  cabeçalho transparente, diálogo com cantos 6px e botões VS, e pilha de
  tipos «Segoe UI» à frente (face do VS Code no desktop).
- **Menu da barra lateral** — o título fica À FRENTE do ícone em cada
  linha (pedido do utilizador), com a linha ativa tingida pelo azul de
  acção; a seta de abertura alinha à direita.
- **O espaço da barra lateral só para apps da barra lateral** — abrir
  uma ferramenta em janela flutuante (Git, IA, ferramentas dev,
  bibliotecas…) fecha a barra lateral em TODOS os layouts (antes só em
  telemóvel): o painel lateral só fica de pé para apps acoplados
  (arquivos, notificações, plugins…).
- **Plugins Codex e Claude Code removidos** — as réplicas do
  marketplace não eram agentes de verdade (geravam prompts
  off-line). Removidos do registo; os modos de trabalho «act like
  Codex/Claude Code» continuam disponíveis como habilidades do agente
  de IA real (com leitura de AGENTS.md/CLAUDE.md, plano, edição e
  verificação).

### Fixed (build)
- **Ícone do splash (Cordova)** — o splash do Android 12+ usava um
  vector desenhado à mão estilo Acode; agora usa a marca oficial
  («@mipmap/ic_launcher_fg», o X com os parênteses de código do
  logo.png). O ícone monocromático temático também passou a usar a marca
  oficial.

### Tests
- 11 novos (ponte de inserção 8, tema predefinido 3): 1073/1073 no
  total.

## [1.8.10] - 2026-11-01

### Fixed
- **Inserir código no arquivo (dev tools, bibliotecas, IA)** — as
  ferramentas falhavam com «sem arquivo aberto» sempre que a aba ativa
  não era um editor (terminal, pré-visualização) ou não havia aba
  aberta. Agora a inserção localiza automaticamente o último arquivo do
  editor aberto (histórico de abas), activa-o e insere lá, com toast a
  mostrar o arquivo-alvo; as mensagens de falha ficam traduzidas.
- **Terminal no caminho do projecto (de vez)** — o cd ignorava
  projectos abertos via SAF: as árvores
  «content://com.carsaimz.xcoder.documents» agora mapeiam para /public,
  documentos do armazenamento externo Android («primary:…») para
  /storage/emulated/0 e as pastas privadas do app (public/alpine) para
  os respectivos pontos de montagem. Sem arquivo ativo, o terminal cai
  na pasta do projecto aberto (addedFolder) em vez da home do sandbox.

### Changed
- **Ferramentas dev: 24 → 32** — oito novas utilidades: Easing (curvas
  cubic-bezier com pré-visualização animada e presets), Unidades
  (px ↔ rem ↔ em), Caixa (camelCase/PascalCase/snake/kebab/CONSTANT/
  Title), Entidades HTML (escapar/des-escapar com refs nomeadas e
  numéricas), CSV ↔ JSON (campos com aspas e delimitador à escolha) e
  três componentes prontos para colar — Toast, Modal e Separadores —
  gerados como HTML + CSS + JS com pré-visualização viva.
- **CSS e JS dos componentes vêm com tags** — quando uma ferramenta
  produz código misto, a saída (copiar e inserir) chega embrulhada em
  «<style>…</style>» e «<script>…</script>»; CSS puro inserido num
  arquivo .html também é embrulhado automaticamente (nova
  «wrapHtmlSnippet»/«isHtmlFile» em lib/webdevTools.js).

### Tests
- 32 novos (recuperação de inserção 5, mapeamento SAF do terminal 6,
  wrapping e geradores novos 21): 1062/1062 no total.

## [1.8.13] - 2026-11-02

### Summary
- Even closer to VS Code: true Dark Modern file tabs (active tab melts
  into the editor with the blue top accent), activity bar with the bare
  2px accent indicator (no rounded box), floating quick-input palette
  and hints (6px corners, lifted shadow), accent-tinted context menu
  selection, steady quicktools icons, flat search bar.
- The status bar now shows the active file path breadcrumb-style
  (folder › file) next to the LSP diagnostics.
- The files panel opens with an EXPLORER-style uppercase section header.
- Build pipelines fixed: an XML comment containing "--" made cordova
  reject config.xml (all builds fell back to "No platforms added");
  platform add is now loud and retried, preferring the pinned
  cordova-android from node_modules.

## [1.8.12] - 2026-11-02

### Summary
- The insert "No file is open in the editor" bug is fixed for real: dev
  tools and libs imported the async editorManager FACTORY and read
  .activeFile from the function itself (always undefined). They now use
  the live window.editorManager instance, with a regression test that
  bans the wrong import.
- Cordova splash regression fixed: the splash icon preference must be a
  real file path (cordova checks fs.existsSync), so the official logo
  (res/splash-icon.png, 960×960 with circular-mask safe margins) ships
  as the Android 12+ splash icon.
- The sidebar panel space now exists only for docked apps (files,
  plugins, notifications…): with windowed tools only, the sidebar
  collapses to a 52px icon rail; option titles now sit in front of the
  rail glyphs.
- Floating windows no longer cover anything: z-order lowered below
  sidebar/pages/menus/dialogs, and windows slide away from an opening
  sidebar.
- Six new VS Code themes (Dark+, Light+, Light Modern, Monokai,
  Solarized Dark/Light) backed by a new real Light+ editor theme, plus
  a VS Code-style status bar (Ln/Col, indent, encoding, language, LSP
  diagnostics). 1086/1086 tests.

## [1.8.11] - 2026-11-02

### Summary
- Insert-anywhere, take three: all four insert buttons (AI chat, AI code
  blocks, dev tools, libraries) now share one battle-tested path that
  scans every open editor tab (files list + panes), activates the most
  recent one when a page tab is in front, and waits up to ~1s for the
  CodeMirror view to be ready — "no file is open" is gone for real.
- VS Code Dark Modern look: repainted default theme (#181818 chrome,
  #1f1f1f surfaces, #cccccc text, #0078d4 blue), vscodeDark editor
  theme, flat 40px header, flat file tabs, 6px floating windows and
  dialogs, Segoe UI font stack.
- Sidebar menu rows show the title before the icon; opening a floating
  tool now closes the sidebar in every layout (the panel space is for
  docked apps only).
- The Codex and Claude Code marketplace replicas are removed (they were
  prompt generators, not real agents); the real AI agent keeps their
  playbooks as skills.
- Cordova splash now shows the official logo mark instead of the
  hand-drawn vector.
- 1073/1073 tests.

## [1.8.10] - 2026-11-01

### Fixed — inserting code into files + terminal project path
- Dev tools, libraries and the AI could fail with "no file is open"
  whenever the active tab wasn't an editor (terminal, preview, nothing
  open). Insertion now falls back to the most recent editor tab,
  activates it and reports the target file in the toast; failure
  messages are localized.
- The terminal now lands in the project even for SAF-opened folders:
  the XCoder public provider maps to /public, Android external-storage
  documents ("primary:…") to /storage/emulated/0 and app-owned
  public/alpine dirs to their sandbox mounts; with no active file the
  session cd's into the first open project folder instead of the
  sandbox home.

### Changed — 8 new dev tools (24 → 32) + wrapped component output
- New: Easing (animated cubic-bezier), Units (px/rem/em), Case, HTML
  entities, CSV ↔ JSON, and three paste-ready components — Toast, Modal
  and Tabs — generated as HTML + CSS + JS.
- Mixed tool output (and bare CSS inserted into .html files) now
  arrives wrapped in <style>/<script> tags.
- 32 new tests: 1062/1062.

## [1.8.9] - 2026-11-01

### Fixed
- **Descarregar dentro do app (site embutido)** — os links de descarga
  do site (ex.: o APK na página /download) morriam dentro do iframe do
  painel Website. Agora o site, ao detetar que corre embutido no app,
  interceta cliques em links de APK/releases e envia a URL ao app via
  postMessage; o painel Website entrega-a ao gestor de descargas (novo
  «lib/siteDownloadBridge.js»), com progresso nas notificações e, para
  APKs, abertura direta do instalador do Android ao terminar. Se ambos
  os transportes falharem, a URL abre no navegador do sistema (último
  recurso) com aviso no toast.

### Changed
- **Sidebar: apps nativos voltam ao painel; só ferramentas ficam
  flutuantes** — ficheiros, plugins, notificações e pesquisa abrem
  novamente acoplados ao sidebar (comportamento clássico do Acode);
  git, IA, bibliotecas, consola JS, ferramentas dev e o site continuam
  a abrir como janelas independentes. O painel acoplado ocupa a área do
  menu (que volta quando uma ferramenta abre em janela), tocar de novo
  no ícone ativo esconde o sidebar, e ao arrancar o último app nativo
  restaura o painel sem abrir janelas.
- **Ferramentas dev: 18 → 24** — seis novas utilidades: Regex (matches
  com índice, grupos e named groups), URL (codificar/descodificar/
  dissecar parâmetros), Hash (SHA-1/256/384/512 via Web Crypto), JWT
  (descodifica header/payload com estado de expiração), Flexbox
  (gerador com pré-visualização viva) e Markdown (pré-visualização HTML
  sanitizada + código). Geradores puros em «lib/webdevTools.js».
- **Bibliotecas: 69 (14 offline + 55 CDN)** — React, React DOM, Vue,
  Axios, Day.js e Lodash agora EMBARCADOS (offline, copiáveis ao
  projeto); o catálogo CDN ganha RxJS, Immer, Moment, Handlebars, Zod,
  Quill, Cropper.js, Toastify JS, SweetAlert2 e Floating UI (URLs e
  tamanhos verificados com HTTP 200).
- **Testes** — 24 novos (split do sidebar 6, bridge de descargas 5,
  gestor de descargas +2, geradores webdev 11): 1030/1030 no total.

## [1.8.9] - 2026-11-01

### Fixed — downloads from the embedded site
- The site's download links (e.g. the APK on /download) died inside the
  Website panel's iframe. The site now detects it runs embedded,
  intercepts APK/release link clicks and postMessages the URL to the
  app; the Website panel hands it to the download manager (new
  «lib/siteDownloadBridge.js») with live progress notifications and —
  for APKs — launches the Android package installer right after. When
  both transports fail, the URL opens in the system browser (last
  resort) with a toast.

### Changed — native apps dock again; 6 new dev tools; 69 libraries
- Sidebar: native apps (files, plugins, notifications, search) dock
  inline in the sidebar again (classic Acode behavior); git, AI, libs,
  JS console, dev tools and the website keep opening as independent
  windows. A docked panel takes the menu's area (the menu returns when
  a tool opens in a window), tapping the active icon hides the sidebar,
  and the last native app restores its panel at boot without popping
  windows.
- Dev tools: 18 → 24 — six new utilities: Regex (match details with
  groups), URL (encode/decode/params), Hash (SHA-1/256/384/512 via Web
  Crypto), JWT (header/payload + expiry state), Flexbox (generator with
  live preview) and Markdown (sanitized HTML preview + code). Pure
  generators live in «lib/webdevTools.js».
- Libraries: 69 (14 offline + 55 CDN) — React, React DOM, Vue, Axios,
  Day.js and Lodash are now BUNDLED (offline, copyable to projects);
  the CDN catalog gains RxJS, Immer, Moment, Handlebars, Zod, Quill,
  Cropper.js, Toastify JS, SweetAlert2 and Floating UI (URLs and sizes
  verified with HTTP 200).
- Tests — 24 new (sidebar split 6, download bridge 5, download manager
  +2, webdev generators 11): 1030/1030 total.

## [1.8.8] - 2026-11-01

### Fixed
- **Conta GitHub no Git, de verdade** — a rota «Entrar com o GitHub
  (navegador)» morria na página «Integração GitHub não configurada» do
  site: a hospedagem nunca recebeu as variáveis
  «GITHUB_APP_CLIENT_ID/SECRET», e o app oferecia a rota quebrada como
  primeira opção. Agora o site expõe «/api/github/status» (só booleans,
  com CORS) e o app sonda o endpoint (cache de 10 min, advanced-http
  sem CORS + fallback fetch): a opção de navegador só aparece quando a
  integração existe; sem isso, o fluxo por código (device flow,
  verificado a funcionar com o client id embutido) vem primeiro e o PAT
  fica sempre disponível. A página de erro do site passa a apontar para
  o device flow/PAT enquanto as variáveis não estiverem definidas.

### Added
- **Menu do sidebar no espaço dos painéis** — com as janelas flutuantes,
  a área onde os painéis viviam não fica mais vazia: mostra os títulos
  das opções agrupados por categoria (Vistas, Ferramentas, Conta), com
  ícone, nome, badge ao vivo e affordance de abertura; tocar numa linha
  abre a janela flutuante do app (no telefone o sidebar recolhe para a
  janela ocupar o ecrã); o menu segue a língua do app e desmonta no modo
  acoplado.

### Changed
- **Minimizar janelas flutuantes** — novo botão minimizar (ordem
  minimizar/maximizar/fechar): a janela colapsa para a barra de título
  («header só com botões»); restaurar tocando no título, no botão
  (agora «expandir») ou no ícone do app na barra de atividades (que em
  vez de fechar, restaura); ativar outro app re-expande automaticamente;
  maximizar a partir de minimizado expande e o estado maximizado
  anterior é memorizado; a geometria salva não é corrompida enquanto
  minimizada.
- **Testes** — 15 novos (menu do sidebar 5, minimizar/restaurar 4,
  escolha honesta de sessão GitHub 6): 1006/1006 no total.

## [1.8.7] - 2026-10-31

### Added
- **Gestor de descargas dentro do app** — o «download dentro do app não
  funciona» fica resolvido: `lib/downloadManager.js` descarrega QUALQUER
  URL (zips, APKs, imagens) para a pasta Download do app com transporte
  nativo (advanced-http, streaming para o disco e progresso byte-a-byte)
  e fallback fetch; fila sequencial, notificações com progresso vivo e
  ação «Cancelar». Entradas: gestor de ficheiros › «Descarregar de URL»
  (no menu +) e Website › botão de descarga no cabeçalho; o iframe passa
  a permitir `allow-downloads`.
- **Catálogo de bibliotecas: 59 (8 offline + 51 CDN)** — React, Vue,
  Tailwind, Bulma, Pico, Lodash, D3, Three.js, GSAP, Swiper, Leaflet,
  ECharts, Mermaid, Highlight.js, KaTeX, MathJax, Supabase, Lucide e
  mais. Cada URL foi verificado (HTTP 200) na geração; entradas CDN têm
  badge próprio e oferecem a tag pronta a colar/insertar.
- **Terminal abre no projeto ativo** — sessões novas fazem `cd` para a
  pasta do ficheiro ativo (mapeamento file:// → caminhos ligados ao
  proot: /sdcard, /storage, /data); SAF/https ficam como estavam.
- **Publicar no GitHub a partir do Git** — novo botão «Publicar no
  GitHub» usa a conta conectada (PAT) para criar UM commit real via API
  git data (blobs → tree → commit → ref), cobrindo branch existente,
  branch ausente e repositório vazio.
- **Plugins Codex e Claude Code** — réplicas funcionais (offline) no
  marketplace (35 no total): geram AGENTS.md/CLAUDE.md na raiz do
  projeto, transformam a seleção em tarefas estruturadas, prompts de
  revisão/plan e mensagens de commit convencionais. O agente embutido
  ganha as skills /skill codex e /skill claude-code.
- **Sidebar: nomes e categorias** — nomes sob os ícones da barra de
  atividades e legendas em maiúsculas pequenas por grupo (Vistas,
  Ferramentas, Conta).

### Changed
- **Painéis do sidebar como janelas flutuantes** — ao tocar num ícone,
  o painel abre numa janela independente (arrastável pelo cabeçalho,
  redimensionável no canto, maximizável, fecho no botão ou tocando no
  ícone outra vez; posição/tamanho persistidos). Definição
  «sidebarFloatingWindows = 0» devolve o modo acoplado clássico; no
  arranque nenhum painel abre sozinho.

## [1.8.6] - 2026-10-31

### Corrigido
- **Ícone de livro (Bibliotecas) não abria nada** — a lista de
  bibliotecas offline renderizava durante o arranque, enquanto o
  contentor ainda estava FORA do DOM, e `render()` abortava cedo
  (`$panel?.isConnected === false`); o `onSelected` apenas rolava a
  vista, logo o painel ficava vazio para sempre. Exactamente o bug que
  a paleta das Dev Tools teve antes da v1.8.3: agora o `onSelected`
  renderiza em toda ativação e o teste de regressão percorre o caminho
  real (add → toque → pulseApp → setActiveApp → onSelected).

### Changed
- **Renomear pré-seleciona o nome sem extensão** (polish do Acode
  #3004) — o prompt de «Renomear» no gestor de ficheiros seleciona
  apenas o basename (`index` em `index.html`, `app.min` em
  `app.min.js`, tudo em `.gitignore`), por isso escrever substitui o
  nome e mantém a extensão. Novo helper puro `helpers.basenameRange()`
  e opção `selection: "basename"` no diálogo `prompt()`.

### Added
- **Roadmap atualizado com o upstream** — novidades do Acode
  verificadas na API a 31-10-2026 (v1.13.5 + nightlies): #2999
  multi-seleção/arrastar na árvore, #2966 tamanhos de dispositivo na
  pré-visualização, #2987 Mermaid em Markdown, #2988 canvas
  experimental, dores abertas (#2980, #3006/#3007, #2336, #2979) e
  PRs revertidos a não seguir (#2864, #2526, #2930/#2931).
- **Limpeza** — imagens de QA locais removidas; auditoria a
  ferramentas/páginas/assets não encontrou recursos mortos (todas as
  16 páginas alcançáveis, 18 ferramentas e 33 plugins funcionais).

## [1.8.5] - 2026-10-27

### Added
- **Barra lateral com rosto VS Code** — a barra de atividades agora
  organiza-se em grupos: vistas principais (Ficheiros, Busca, Plugins,
  IA, Git) em cima, ferramentas (Consola JS, Dev Tools, Bibliotecas,
  Website, Notificações) depois de um separador, e Conta / Definições /
  Sobre apanhados no fundo da barra (padrão do VS Code). Apps
  registadas por plugins continuam a chegar ao grupo principal.
- **Badges na barra de atividades** — o ícone do Git mostra o número de
  mudanças pendentes (atualiza a cada leitura de estado e limpa em
  erro) e o sino mostra o número de notificações por ler. A API nova
  `setBadge(id, valor)` no registry aceita número (pílula, teto «99+»),
  `true` (ponto) ou `null` (limpa).
- **Tooltip de toque longo** — manter o dedo num ícone da barra
  (meio segundo) mostra o nome do painel numa bolha estilo VS Code; o
  atributo nativo `title` nunca aparece no toque, e isto devolve a
  descoberta «o que faz este ícone?».

### Changed
- **Cabeçalhos das vistas ao estilo VS Code** — título alinhado à
  esquerda, maiúsculas pequenas com espaçamento de letras e linha
  divisória por baixo (Plugins e Notificações), em vez do título
  centrado antigo.

### Corrigido
- **Ícone dos side-buttons não renderizava** — typo JSX `<spam>` no
  componente de botões laterais impedia o glifo de aparecer; agora é
  `<span>`.

## [1.8.2] - 2026-09-21

### Added
- **Dev Tools: +2 ferramentas (18 no total)** — *Grid CSS* (colunas, linhas,
  gaps, modo auto-fill `minmax(140px, 1fr)`, com pré-visualização ao vivo da
  malha) e *Border radius* (ajuste dos quatro cantos com colapso automático
  para um valor quando iguais). Os mesmos geradores chegaram à página
  /tools do site (18 ferramentas, EN+ES).
- **Marketplace: +5 plugins (33 no total)** — *Regex Tester*
  (`Ctrl-Alt-V`; testa padrões com grupos e substitui usando `$1`),
  *HTML to JSX* (`Ctrl-Alt-X`; class→className, void tags, style como
  objeto, comentários `{/* */}`), *CSS Beautify* (expandir/minificar),
  *SQL Format* (palavras-chave em maiúsculas, cláusulas por linha,
  literais preservados) e *Text Wrap* (refluí texto em N colunas,
  padrão 80, preservando indentação).

### Corrigido
- Nada nesta versão — correções de regressão contínua nos testes
  (936 testes, 104 ficheiros).

## [1.8.4] - 2026-10-10

### Corrigido
- **Códigos QR das formas de apoio agora aparecem no app** — os QR
  (Ko-fi, Patreon, M-Pesa, e-Mola…) vivem na base de dados do site
  (`qr_image_url`) e já eram servidos pelo `/api/config`, mas o
  `normalizeMethod()` (lib/premium) reconstruía cada linha SEM o
  campo: a página Apoie nunca os recebia. O campo agora passa direto
  (mesmo nome da BD) e métodos só com QR (sem url nem conta) deixam
  de ser descartados. Testes: passthrough no `supportInfo` (Ko-fi +
  M-Pesa + e-Mola só-QR) e renderização do `img.support-method-qr`
  na página de apoio.
- **/admin do site agora explica a rejeição da BD antiga** — bases
  criadas antes dos canais novos ainda têm o CHECK constraint com 8
  métodos, e a mensagem crua do Postgres (check_violation) não
  ajudava. O endpoint de pagamentos traduz agora esse caso numa
  orientação clara: abrir /setup e clicar «Aplicar schema», que
  reaplica a lista completa (pix, kofi, patreon, liberapay,
  opencollective, crypto) sem perder dados.

## [1.8.3] - 2026-09-22

### Corrigido
- **"Ícone de tools não faz nada"** — o painel das Dev Tools nunca
  renderizava ao abrir: `renderPanel()` saía cedo enquanto o container
  estava fora da árvore de documento (no arranque) e o `onSelected()`
  só fazia scroll. Agora o painel renderiza em TODA ativação (padrão
  refresh-on-open do app Git) e as consultas do `setTool()`/
  `onLangChange()` usam a raiz do app (funcionam também na árvore
  destacada). Cobertura nova: teste comportamental que passa pelo
  módulo REAL de sidebarApps (add + clique delegado) e clica nas 18
  ferramentas.
- **Ferramentas Gradiente e Formulário quebravam** — `gradientCSS` e
  `formSnippet` eram usados em `refresh()` mas NÃO estavam na lista de
  imports de `lib/webdevTools`: ReferenceError logo que a ferramenta
  renderizava. Apanhados pelo teste novo que percorre as 18
  ferramentas e exige saída não vazia de cada uma.

## [1.8.2] - 2026-09-21

### Added
- **Dev Tools: +2 tools (18 total)** — *CSS Grid* (columns, rows, gaps,
  auto-fill `minmax(140px, 1fr)` mode, live grid preview) and *Border
  radius* (four-corner tuning, collapses to a single value when equal).
  The same generators landed on the site's /tools page (18 tools, EN+ES).
- **Marketplace: +5 plugins (33 total)** — *Regex Tester* (`Ctrl-Alt-V`;
  pattern testing with groups and `$1` replace), *HTML to JSX*
  (`Ctrl-Alt-X`; class→className, void tags, style objects, `{/* */}`
  comments), *CSS Beautify* (expand/minify), *SQL Format* (uppercase
  keywords, one clause per line, string literals preserved) and *Text
  Wrap* (reflow at N columns, default 80, indentation preserved).

### Fixed
- Nothing in this release — ongoing regression coverage (936 tests,
  104 files).

## [1.8.1] - 2026-09-21

### Added
- V1.8.1 — marketplace +5 plugins (CSS units, HTML entities, MD tables, RGB-hex, trim trailing), registry at 28

## [1.8.0] - 2026-09-21

### Corrigido — sessão GitHub (bad credentials)

- **PAT agora disponível em todos os fluxos:** o seletor de entrada
  ("Entrar com GitHub") na barra lateral nunca mostrava a opção de
  token pessoal — só navegador/device flow. Quem tentava "conectar
  com GitHub via PAT" não conseguia, e a conta/repositórios nunca
  apareciam. A opção **Token de acesso pessoal (PAT)** agora está
  sempre disponível no seletor, com ícone próprio
- **Normalização de token em toda a linha GitHub:** espaços, quebras
  de linha (copiar de mensageiros quebra o token em duas linhas),
  zero-width e BOM são removidos antes de guardar e antes de CADA
  pedido — um único caractere invisível bastava para o GitHub
  responder 401 "Bad credentials"
- **Mensagens de erro acionáveis:** 401 agora explica o problema
  ("Token inválido ou revogado — reconecte a conta ou cole um novo
  token") em vez de um genérico; erros do plugin nativo que vinham
  como objeto deixam de virar "[object Object]"
- **Botão "Atualizar perfil"** no cartão de conta da barra lateral
  (e no ecrã de configurações GitHub) para sessões "token definido —
  sem perfil": revalida o token, guarda o perfil e dá o feedback
  correto quando o token é inválido

### Adicionado — lista vertical de ferramentas + 7 utilitários de programador

- **Seletor vertical (dropdown expansível):** a faixa horizontal de
  abas do painel Dev Tools foi substituída por uma lista vertical
  expansível — o cabeçalho mostra a ferramenta ativa (título +
  descrição) e, ao tocar, abre a lista em que **cada ferramenta tem
  título e uma descrição curta**, como pedido. 16 ferramentas no total
- **Sete novos utilitários** para programadores e webdevs:
  **JSON** (formatar/minificar/validar com mensagem de erro),
  **Base64** (codificar/decodificar com suporte UTF-8 seguro),
  **IDs/UUID** (UUID v4 + ids curtos em lote, com botão gerar de
  novo), **Timestamp** (unix s/ms ↔ ISO 8601 ↔ data local, detecção
  automática), **Cor** (hex ↔ rgb() ↔ hsl()), **Lorem ipsum** (texto
  de preenchimento determinístico) e **Slug/URL** (slugify que remove
  acentos) — todos com preview/saída, copiar e inserir no cursor
- **Novo ícone svg "key"** no pacote de ícones (usado na opção PAT);
  pacote SVG exportado em sincronia

### Traduções

- 44 novas chaves de tradução (títulos e descrições das 16
  ferramentas, rótulos dos novos utilitários e mensagens da sessão
  GitHub) em en-us e pt-br

## [1.8.0] - 2026-09-21

### Fixed — GitHub session (bad credentials)

- **PAT available on every flow:** the sidebar "Sign in with GitHub"
  chooser never offered the personal access token option — only
  browser/device flow. Pasting a PAT was impossible from the sidebar,
  so the account/repositories never appeared. The **Personal access
  token (PAT)** option is now always available in the chooser, with
  its own key icon
- **Token normalisation across the whole GitHub layer:** spaces,
  line breaks (messengers wrap copied tokens), zero-width chars and
  BOM are stripped before saving and before EVERY request — a single
  invisible character was enough for GitHub to answer 401 "Bad
  credentials"
- **Actionable error messages:** 401 now explains the problem
  ("Invalid or revoked token — reconnect or paste a new token")
  instead of a generic one; native plugin errors arriving as objects
  no longer render as "[object Object]"
- **"Refresh profile" button** on the sidebar account card (and the
  GitHub settings page) for "token set — no profile" sessions:
  revalidates the token, saves the profile and reports properly when
  the token is invalid

### Added — vertical tool list + 7 programmer utilities

- **Vertical picker (expandable dropdown):** the horizontal tab strip
  of the Dev Tools panel was replaced by an expandable vertical list
  — the header shows the active tool (title + description) and
  tapping it opens the list where **every tool has a title and a
  short description**, as requested. 16 tools in total
- **Seven new utilities** for programmers and webdevs: **JSON**
  (format/minify/validate with error message), **Base64** (encode/
  decode, UTF-8 safe), **IDs/UUID** (bulk UUID v4 + short ids, with a
  regenerate button), **Timestamp** (unix s/ms ↔ ISO 8601 ↔ local
  date, auto detection), **Color** (hex ↔ rgb() ↔ hsl()),
  **Lorem ipsum** (deterministic filler text) and **Slug/URL**
  (accent-stripping slugify) — all with preview/output, copy and
  insert-at-cursor
- **New "key" svg icon** in the icon pack (used by the PAT option);
  SVG pack exported in sync

### Translations

- 44 new translation keys (titles and descriptions of the 16 tools,
  labels of the new utilities and GitHub session messages) in en-us
  and pt-br

## [1.7.9] - 2026-09-21

### Corrigido — falha de Path ao baixar modelos

- **Modelos locais (IA offline):** a primeira instalação de qualquer
  modelo (LLM/STT/TTS) falhava sempre com o erro "Path does not
  exist" do Cordova — o código criava a pasta do modelo DENTRO de
  `xcoder-models/` sem criar a própria pasta-raiz primeiro. Agora o
  gestor de downloads cria a cadeia completa de diretórios
  (`DATA_STORAGE/xcoder-models/<id>/onnx/…`) nível a nível, e o
  runtime de inferência partilha exatamente a mesma fonte de
  caminhos (`ensureModelDirPath`/`installedFileUrl`), eliminando a
  dessincronia entre download e execução. Teste de regressão: o stub
  de ficheiros ficou tão rígido quanto o Cordova (pai inexistente =
  erro) e um teste novo garante a criação da cadeia completa na
  primeira instalação

### Adicionado — mais ferramentas webdev (Dev Tools)

- **Cinco novos geradores** no app Dev Tools (agora 9 ferramentas):
  **CTA** (botão de call-to-action com cores, raio, paddings, tamanho
  de fonte e largura total), **Secção** (hero com título, subtítulo,
  botão e fundo sólido ou gradiente), **Formulário** (contact form
  com campos nome/e-mail sempre presentes e telefone/assunto/mensagem
  opcionais), **Tabela** (scaffold de dados com nº de colunas/linhas,
  listras e bordas) e **Esqueleto HTML** (documento HTML5 completo
  com charset, viewport, título e reset CSS — lang pt/en). Todos com
  pré-visualização ao vivo, HTML+CSS formatados, Copiar e Inserir

### Adicionado — bibliotecas locais para projetos (htmx e mais)

- **Novo app Bibliotecas na sidebar** (ícone de livro): 8 bibliotecas
  web embarcadas no APK (1,6 MB) — **htmx** 2.0.4, **Alpine.js**
  3.14.9, **jQuery** 3.7.1, **Bootstrap** 5.3.3 (css+js), **Bootstrap
  Icons** 1.11.3, **Boxicons** 2.1.4, **Font Awesome** 6.7.2 e
  **Chart.js** 4.4.7 — com suporte OFFLINE: "Copiar tag local"
  (aponta para `libs/<id>/…`), "Copiar tag CDN", "Inserir tag no
  cursor" e **"Copiar para o projeto"**, que escreve os ficheiros
  (fontes woff2 incluídas, com os caminhos relativos do css intactos)
  na pasta do ficheiro ativo. O build copia `src/res/libs` para
  `www/res/libs` verbatim (utils/config.js), preservando as urls de
  fontes das folhas de estilo

### Adicionado — 7 novos plugins no marketplace (23 no total)

- **Tag Wrapper** (Ctrl-Alt-R): envolve a seleção com qualquer tag
  HTML, atributos incluídos — inspirado no fluxo "wrap" dos editores
  de desktop e no catálogo do Acode
- **Quote Converter** (Ctrl-Alt-Q): troca aspas simples/duplas (ou
  remove as externas) na seleção/palavra, com escape automático —
  versão própria do plugin clássico do Acode
- **HTML Skeleton** (Ctrl-Alt-O): esqueleto HTML5 completo no
  documento atual — sucessor do "HTML Page Generator" do Acode
- **Sort JSON** (Ctrl-Alt-D): ordena chaves de objetos JSON
  recursivamente (A→Z / Z→A), mantendo arrays
- **URL Tools** (Ctrl-Alt-N): encode/decode com as quatro funções
  nativas de URI
- **Slugify** (Ctrl-Alt-L): slug URL-friendly (kebab-case, sem
  acentos) da seleção/palavra
- **Blank Lines** (Ctrl-Alt-A): limpeza de linhas vazias, espaços
  residuais e linhas quebradas
- Todos com ícones gradientes, zips e registry atualizados
  (source raw + fallback jsDelivr), smoke-tests no pacote (27
  verificações) e o registry offline do app (`plugin-registry.json`)
  já embarca os 23 plugins

### Testes

- tests/unit/modelDownloads.test.js: stub de fs rígido (pai tem de
  existir, como o Cordova) + regressão "cadeia completa na 1.ª
  instalação" (9 testes no ficheiro)
- tests/unit/webdevTools.test.js: +13 testes — CTA com escapes e
  modo bloco, secção gradiente/sólida com/sem botão, formulário com
  campos opcionais, tabela com listras/bordas e esqueleto HTML5
  (27 no ficheiro)
- tests/unit/localLibs.test.js (13): catálogo, integridade no disco
  (tamanho exato de cada ficheiro), tags locais/CDN, tamanhos
  formatados, planos de cópia e guardas de wiring (loader + cópia no
  build)
- Baseline: 898/898 testes (103 ficheiros), tsc limpo, biome limpo,
  typos 0, build de produção OK

### English

### Fixed — Path failure when downloading models

- **Local models (offline AI):** the first install of any model
  (LLM/STT/TTS) always failed with Cordova's "Path does not exist" —
  the manager created the model folder INSIDE `xcoder-models/` without
  creating the root folder itself. The download manager now walks the
  whole directory chain (`DATA_STORAGE/xcoder-models/<id>/onnx/…`)
  level by level and the inference runtime shares the exact same
  source of paths (`ensureModelDirPath`/`installedFileUrl`).

### Added — more webdev tools (Dev Tools)

- **Five new generators** in Dev Tools (now 9 tools): **CTA** button,
  **Section** (hero), **Form** (contact form), **Table** scaffold and
  **HTML Boilerplate** — all with live preview, copy and insert.

### Added — offline web libraries (htmx and friends)

- **New Libraries sidebar app**: 8 libraries bundled in the APK
  (1.6 MB) — htmx, Alpine.js, jQuery, Bootstrap, Bootstrap Icons,
  Boxicons, Font Awesome and Chart.js — with copy-to-project keeping
  the relative font paths intact, plus local/CDN tag copy and insert.

### Added — 7 new marketplace plugins (23 total)

- Tag Wrapper, Quote Converter, HTML Skeleton, Sort JSON, URL Tools,
  Slugify and Blank Lines — inspired by Acode's plugin catalog,
  rebuilt on the Xcoder API, with smoke tests and the bundled
  registry updated to 23 entries.

### Tests

- Regression for the directory chain (strict cordova-like stub),
  +13 webdev generator tests, 13 localLibs tests incl. on-disk
  integrity of every bundled file. Baseline: 898/898 tests (103
  files), clean tsc/biome/typos, production build OK.

## [1.7.8] - 2026-09-20

### Adicionado — atualização dentro do app + ferramentas de webdev

- **Atualização dentro do APP:** a notificação de nova versão (e a
  verificação manual em Sobre > Verificar atualizações) agora baixa o
  APK da release do GitHub **dentro do app** — diálogo com tamanho,
  download com progresso em percentagem e MB (cancelável), e abertura
  direta do instalador do Android via FileProvider do plugin System.
  Sem navegador: baixa e instala num só fluxo. Sem permissão de
  instalação, APK ausente ou falha de rede/instalador? O app recua
  para abrir a página da release no navegador. AndroidManifest declara
  agora REQUEST_INSTALL_PACKAGES
- **Ferramentas Dev (webdev):** novo app na sidebar (ícone de paleta)
  com quatro geradores de código prontos a colar: Sombra (box-shadow
  com offsets/blur/spread/cor/inset), Gradiente (linear/radial/conic
  com ângulo e paradas de cor), Cartão (fundo, texto, raio, padding,
  borda e sombra — gera CSS + HTML) e Placeholder (imagens SVG
  determinísticas com tamanho/cores/rótulo — pré-visualização, tag
  <img> com data URI e opção "Salvar SVG" junto do ficheiro ativo).
  Cada ferramenta tem pré-visualização ao vivo, saída formatada e
  botões Copiar e Inserir (no cursor do editor)

### Testes

- tests/unit/appUpdateDownload.test.js (12): escolha do APK (ignora
  .aab/.sha256, prefere XCoder-*.apk), formatação de bytes, sonda de
  ambiente e o fluxo completo (fallback navegador sem Android/sem APK,
  happy path download+instalação com progresso, cancelamento no
  diálogo, falha de rede e recusa do instalador)
- tests/unit/webdevTools.test.js (14): geradores puros — sombra com
  clamp e inset, gradientes linear/radial/conic com paradas ordenadas,
  cartão com borda condicional/escapes/preset inválido e placeholder
  SVG com rótulo e escape de marcação
- tests/unit/devtoolsWiring.test.js (4): guardas estruturais — registo
  na lista de loaders, ícone e titleKey, import correto de
  lib/webdevTools (não confundir com o devTools do Eruda) e paridade
  das chaves i18n em en-us + pt-br
- tests/unit/checkAppUpdate.test.js atualizado ao novo contrato (o
  payload passa a incluir `assets`)
- Baseline: 875/875 testes (102 ficheiros), tsc limpo, biome limpo,
  typos 0, build de produção OK, boot harness idêntico ao baseline
  (12 apps na sidebar — 11 anteriores + devtools)

### English

- **In-app update:** the new-version notification (and the manual
  check under About > Check for updates) now downloads the GitHub
  release APK **inside the app** — size-aware confirm dialog,
  cancelable download with percentage + MB progress, and the Android
  package installer opened directly through the System plugin's
  FileProvider. No browser detour: download and install in one flow.
  Falls back to opening the release page when install is impossible
  (no permission/APK/network/installer). AndroidManifest now declares
  REQUEST_INSTALL_PACKAGES
- **Dev Tools (webdev):** new sidebar app (palette icon) with four
  paste-ready generators: Shadow (box-shadow with offsets/blur/spread/
  color/inset), Gradient (linear/radial/conic with angle and color
  stops), Card (background, text, radius, padding, border, shadow —
  emits CSS + HTML) and Placeholder (deterministic SVG images with
  size/colors/label — live preview, <img> data-URI tag and a
  "Save SVG" action next to the active file). Each tool has a live
  preview, formatted output, plus Copy and Insert (at editor cursor)
  buttons
- Tests: 875/875 (102 files) — 30 new tests covering the update flow,
  the pure generators and the sidebar wiring

## [1.7.7] - 2026-09-19

### Adicionado — bots de IA e modelos locais (offline)

- **Bots de IA (personas prontas):** o chat ganhou uma terceira pill
  ("Bot") ao lado de Pensar/Buscar — um toque troca a persona do
  assistente mantendo as ferramentas e o contexto do workspace. Oito
  bots embutidos: Revisor de Código (severidade + diff mínimo),
  Arquiteto (plano antes de editar), Professor (analogias e passos),
  Tradutor (PT↔EN↔ES preservando código), Regex, Terminal (one-liners
  seguros), Redator Técnico (READMEs e Conventional Commits) e Analista
  SQL (query + plano + dialeto). O utilizador pode criar bots próprios
  (nome, emoji, descrição, instruções) em Definições > IA > Bots; o bot
  ativo entra no system prompt logo após o bloco de identidade e os
  bots do utilizador ficam guardados nas definições
- **Tela de Modelos locais (baixáveis):** nova página em Definições >
  IA > Modelos locais (e ação "Baixar modelos locais" no seletor de
  modelos) com três abas — Assistentes (LLM), Voz→Texto (STT) e
  Texto→Voz (TTS). Catálogo de 10 modelos reais verificados na Hugging
  Face, dos leves aos completos (todos ≥ 50MB): SmolLM2 135M (~120MB)
  e 360M (~275MB), Qwen2.5 0.5B (~490MB), Qwen2.5 Coder 0.5B (~562MB),
  Qwen2.5 1.5B (~1,23GB), Llama 3.2 1B (~1,25GB), Whisper Base (~81MB)
  e Small (~253MB), MMS TTS Português (~58MB) e SpeechT5 EN (~181MB)
- **Gestor de downloads com progresso:** cada cartão mostra tamanho e
  idiomas, baixa com barra de progresso e percentagem (transporte
  nativo cordova-plugin-advanced-http direto ao disco, sem estourar
  memória; fallback fetch no navegador), permite cancelar, retoma
  onde parou (compara bytes com o manifesto), apagar com confirmação e
  resumo de armazenamento usado. Modelos instalados ficam em
  `xcoder-models/<id>/` com manifesto `_manifest.json` como prova de
  instalação
- **Runtime local (transformers.js):** motor ONNX WASM carregado
  preguiçosamente de CDN com versão fixa (zero impacto no bundle, sem
  workers); os ficheiros dos modelos são servidos do disco por um
  cache personalizado — depois de baixar, chat/STT/TTS funcionam 100%
  offline. Novo provider "Local (no aparelho)" no catálogo (sem chave,
  streaming de tokens pelo mesmo pipeline do chat) e botão "Usar no
  chat" nos cartões de LLM instala o modelo como ativo

### English

- **AI Bots (ready-made personas):** new third "Bot" pill in the chat
  composer — one tap swaps the assistant persona while keeping tools
  and workspace context. Eight built-in bots (Reviewer, Architect,
  Teacher, Translator, Regex, Terminal, Tech Writer, SQL) plus
  user-created bots stored in settings; the active persona is merged
  into the system prompt right after the identity block
- **Local models screen:** new Models page (AI settings > Local
  models, and "Download local models" action in the model picker) with
  three tabs — LLM assistants, speech-to-text and text-to-speech.
  Catalog of 10 verified Hugging Face models from ~56MB to ~1.25GB
  (all ≥ 50MB): SmolLM2 135M/360M, Qwen2.5 0.5B, Qwen2.5 Coder 0.5B,
  Qwen2.5 1.5B, Llama 3.2 1B, Whisper Base/Small, MMS TTS Portuguese
  and SpeechT5
- **Download manager:** per-model progress bar and percentage (native
  advanced-http transport straight to disk, fetch fallback), cancel,
  byte-exact resume, delete with confirmation and storage summary;
  installs live under `xcoder-models/<id>/` with a `_manifest.json`
- **On-device runtime (transformers.js):** lazily imported pinned ESM
  build (no bundle impact, no workers); model files are served from
  disk through a custom cache — once installed, chat/STT/TTS run fully
  offline. New keyless "Local (on device)" provider with token
  streaming and a "Use in chat" action on LLM cards

## [1.7.6] - 2026-09-19

### Adicionado — substituição em lote grava em disco

- **"Substituir tudo" persiste no disco:** a substituição em lote do
  painel Buscar em ficheiros gravava os resultados apenas como abas não
  salvas (perdidas se o utilizador fechasse o app); agora cada ficheiro
  alterado é gravado diretamente no disco. Antes de gravar, um diálogo
  de confirmação mostra quantas ocorrências serão substituídas em
  quantos ficheiros; durante a gravação, um loader mostra o progresso
  ficheiro a ficheiro; ao terminar, um toast resume quantos ficheiros
  foram gravados e, se houver falhas (ex. ficheiro só de leitura, falha
  de permissão SAF), o painel lista a quantidade — a gravação dos
  restantes ficheiros não é interrompida
- **Abas abertas sincronizadas e marcadas como salvas:** depois de
  gravar, o conteúdo das abas já abertas é atualizado e o ficheiro é
  marcado como salvo (sem o estado falso "não salvo" que surgia ao
  despachar o texto para o editor); a codificação usada é a da aba
  aberta quando existente, senão a codificação padrão configurada
- **Novo interruptor "HD" no painel Buscar em ficheiros:** controla se
  a substituição grava em disco (padrão, ligado) ou mantém o
  comportamento antigo de abrir cada ficheiro alterado como aba não
  salva — a escolha fica guardada como as demais opções do painel
- **Paridade de grupos de captura no backend nativo:** o backend Java
  (pesquisa indexada em `file://`/`content://`) agora suporta
  referências como `$1` na substituição, igual ao backend JS; quando o
  texto de substituição contém `$`, ele é interpretado como modelo e,
  se inválido, cai automaticamente para substituição literal (sem
  quebrar a busca)
- **Ficheiros sem alteração não são mais reportados:** o worker JS e o
  backend nativo passam a omitir ficheiros onde a substituição não
  mudou nada (antes abriam abas desnecessárias com o mesmo conteúdo)
- **Re-busca automática:** ao terminar a substituição gravada, os
  resultados antigos são limpos e a busca é re-executada — o painel
  passa a mostrar "nenhum resultado", confirmando visualmente que a
  substituição foi aplicada em todos os ficheiros

### EN summary

Batch replace in "Search in files" now writes changes to disk
(confirmation with counts, per-file progress, failure summary,
automatic re-search), syncs open tabs as saved with correct encoding,
adds an "HD" toggle to keep the old open-as-unsaved-tabs behavior,
gains `$1` capture-group parity in the native Java backend (with
literal fallback), and skips files with no changes. +5 tests (814
total).

## [1.7.5] - 2026-09-17

### Adicionado — linter de sintaxe nativo + API de linters para plugins

- **Erros de sintaxe em qualquer linguagem:** o editor marca os erros
  usando a própria árvore de parse do CodeMirror 6 (nós `isError` do
  Lezer) — funciona para php, c/cpp, java, yaml, xml, e qualquer outra
  linguagem com parser, sem depender de LSP e sem embutir engines de
  lint (JSHint/CSSLint do plugin upstream somavam ~3 MB; aqui: zero
  bytes novos). Inclui erros de token ausente (nós de largura zero,
  ex. `const x = ;`)
- **Sem duplicar LSP:** em ficheiros cobertos por um servidor LSP
  (JS/TS, HTML, CSS, JSON, Python, Lua), o verificador embutido dá
  lugar aos diagnósticos do servidor — o mesmo erro nunca aparece duas
  vezes
- **API para plugins (`xcoder.require("linter")`):** plugins registram
  linters próprios (`register`/`unregister`/`onChange`) com escopo por
  plugin — descarregados automaticamente no uninstall ou em falha de
  carga, o mesmo modelo da API de fileIcons; filtro opcional por
  extensão de ficheiro
- **Painel de Problemas:** lista os diagnósticos do linter junto com
  os do LSP e as anotações legadas
- **Configuração:** interruptor "Verificação de erros de sintaxe" em
  Configurações do editor → Guias e indicadores (ligado por padrão)

### Removido

- Dependência `esprima` — declarada no package.json mas nunca
  importada; um pacote a menos no install

### Testes

- +14 testes (`linterRegistry.test.ts`): deteção de nós de erro
  (incluindo largura zero), registro/unregister/onChange, escopo por
  plugin (bind/getApi/unregisterByPlugin), filtro por extensão,
  cortesia ao LSP (skip em ficheiro coberto) e ao `syntaxLint` off,
  robustez com estados simples (809 no total, 94 ficheiros)

### EN summary

- **Native syntax linter + plugin linter API:** syntax errors flagged
  via the CodeMirror 6 parse tree (Lezer error nodes) for every
  language with a parser — zero new dependencies (upstream's Ace
  workers are ~3 MB); steps aside on LSP-covered files so errors are
  never duplicated; `xcoder.require("linter")` lets plugins register
  scoped linters (auto-unloaded on uninstall, fileIcons model);
  Problems panel integration and a "Syntax error checking" editor
  toggle. Unused `esprima` dependency removed; +14 tests (809 total,
  94 files)

## [1.7.4] - 2026-09-17

### Corrigido — links mortos do upstream

- **Crédito do Acode atualizado:** o link do projeto original na
  página Sobre (Reconhecimentos) e no README apontava para
  `github.com/deewarz/acodeapp` — endereço morto (404). O upstream
  vive hoje em `github.com/Acode-Foundation/Acode` (o dono antigo,
  `deadlyjack/acode`, migrou para a organização com redirecionamento
  permanente); os 3 links agora apontam para o endereço atual
- **Nada mais mudou:** só URLs (2 no README, 1 no JSX da página
  Sobre) — sem mudança de comportamento nem de dependências (o
  pacote npm `@deadlyjack/ajax` é uma dependência real e segue como
  está; os links de atribuição ao perfil do autor original na wiki
  continuam válidos — perfil pessoal não mudou)

### EN summary

- **Dead upstream links fixed:** the Acode credit in the About page
  and README pointed to `github.com/deewarz/acodeapp` (404); all
  three links now point to the current home
  `github.com/Acode-Foundation/Acode` (owner rename with permanent
  redirect). URLs only — no behavior, dependency or wiki attribution
  changes

## [1.7.3] - 2026-09-16

### Adicionado — API oficial de fileIcons + pacotes de ícones (Acode #2887)

- **API pública estável (`acode.require("fileIcons")`):** plugins
  registram pacotes de ícones com `register`, consultam ícones com
  `icon` e reagem a trocas com `onChange` — o mesmo sistema de temas
  estilo VS Code/Zed do upstream, portado quase 1:1 (1103 linhas de
  núcleo + 232 do pacote embutido). A API é ligada ao script do plugin
  que a pede (`bindPlugin`): a propriedade do pacote é automática e o
  des-registro acontece em falha de load, erro de init ou
  desinstalação
- **Pacote embutido continua o padrão:** as classes `file_type_*`
  existentes continuam funcionando sem nenhuma migração visual —
  temas que usam classes e temas com SVG (por URL de ficheiro ou
  pasta com `icons/`) são suportados; versão de schema para futuras
  migrações de pacotes
- **Nova opção "Pacote de ícones"** em Configurações do app →
  Interface, com a lista viva dos temas disponíveis (temas com assets
  indisponíveis aparecem marcados) e texto de valor tolerante; a
  escolha persiste em `iconTheme` e reconfigura ao vivo
- **Ícones de pastas vivos:** pastas agora refletem aberto/fechado
  (inclusive a raiz, com ícone próprio), na árvore de ficheiros, nas
  listas de pastas abertas e no reciclador da FileTree — que também
  corrige a reutilização de tiles para limpar a sub-árvore e os
  handlers de clique/contexto usarem os dados do tile em vez de
  closures obsoletas
- **Atualização global ao trocar de tema:** ícones já renderizados
  (árvore de ficheiros, listas, abas do editor, resultados de pesquisa
  com widgets CodeMirror, painel de referências, seletores e páginas
  de configuração) são atualizados via `refreshRenderedIcons`
  (`data-file-icon-*`), incluindo sidebars destacadas que ficavam
  fora do documento

### Testes

- +56 testes dos 5 ficheiros de teste do upstream (`fileIconTheme`,
  `fileIconAssets`, `fileIconOwnership`, `fileIconSidebar`,
  `fileTreeRecycling`): matching por nome/extensão/languageId,
  prioridade do tema ativo, fallback embutido, propriedade e
  des-registro por plugin, persistência da escolha, refresh de
  ícones renderizados e reciclagem da árvore (795 no total, 93
  ficheiros)

### EN summary

- **Official fileIcons API + icon packs (Acode #2887):** plugins
  register icon packs via `acode.require("fileIcons")`
  (`register`/`icon`/`onChange`) — the same VS Code/Zed-style theme
  system as upstream, ported nearly 1:1; builtin pack stays the
  default and keeps the existing `file_type_*` classes, SVG packs by
  URL/folder supported, ownership bound to the requesting plugin
  script with automatic unregistration. New "Icon pack" app setting
  with a live theme list; live folder icons (expanded/collapsed, root
  included) and global refresh of rendered icons on theme change
  (file tree, lists, editor tabs, CodeMirror search widgets,
  references panel, settings); +56 tests from upstream's 5 test files
  (795 total, 93 files)

## [1.7.2] - 2026-09-16

### Adicionado — quebra de linha suave com indentação (Acode #2886 + #2880)

- **Linhas quebradas com indentação:** com a quebra de linha ativa, a
  continuação de cada linha agora começa na indentação da linha
  original em vez de voltar à margem esquerda — um abaixo do outro,
  do jeito que o código é lido. Nova extensão CodeMirror 6
  (`indentedLineWrapping`): mede a largura visível, cacheia por linha,
  preserva paradas de tabulação (linhas com tab arredondam a indentação
  para cima) e limita a indentação a metade das colunas visíveis para
  painéis estreitos nunca ficarem sem conteúdo
- **Modos extras:** além de "Mesma indentação", dois níveis opcionais —
  "Indentar (+1 nível)" e "Indentação profunda (+2 níveis)" — somam
  tabulações inteiras sobre a indentação da linha
- **Quebras em pontuação (Acode #2880/#2886):** oportunidades de quebra
  estilo VS Code (`punctuationWrapping`) — fecha `)`/`]`/`}` junto do
  caractere anterior e quebra ANTES de `(`/`[`/`"`, não depois; inclui
  pontuação CJK (`、` `。` `」` etc.) com widgets `wbr` nativos, sem
  tocar no layout
- **Nova opção de settings:** "Indentação da quebra de linha" em
  Configurações do editor → Texto e layout (Nenhuma / Mesma / +1 / +2);
  trocar reconfigura o editor ao vivo (mesmo compartimento do "Quebra
  de texto"); strings novas em pt/en (fallback: inglês nos demais
  idiomas)

### Testes

- +6 testes (`indentedLineWrapping.test.ts`): indentação de espaços
  preservada e truncada no conteúdo, contagem de tabulações por coluna,
  arredondamento misto, tetos sem paradas fracionárias e os modos
  extra/none — incluindo a regra "níveis extras somam sobre a
  indentação da própria linha" (739 no total, 88 ficheiros)

### EN summary

- **Indented soft wrap (Acode #2886 + #2880):** wrapped lines continue
  at the original line's indentation instead of returning to the left
  margin; optional +1/+2 extra indent levels; VS Code-style punctuation
  break opportunities (closing brackets kept together, breaks before
  openings, CJK included); new "Word wrap indentation" editor setting
  (None / Same / +1 / +2) with live reconfiguration; +6 tests (739
  total, 88 files)

## [1.7.1] - 2026-09-15

### Corrigido — perfil: "Terminar sessão" e botão voltar

- **Sessão que ressuscitava:** uma renovação de token em voo quando o
  usuário tocava em "Terminar sessão" gravava de volta a sessão
  acabada de apagar — a conta voltava sozinha ao reabrir a página.
  `signOut()` agora invalida toda resposta de refresh/perfil pendente
  (contador de época em `lib/supabase.js`); testes provam que a
  ressurreição acontecia antes do conserto e não acontece mais
- **Botão voltar morto na página de perfil (e suporte):** as páginas
  empilhavam a entrada no actionStack com a chave `callback`, mas o
  `pop()` invoca `action` — o hardware back lançava
  "fun.action is not a function" e a página ficava presa. Chave
  corrigida nas duas páginas
- **Confirmação descartada pelo voltar:** o diálogo de confirmação
  nunca resolvia quando dispensado pelo botão voltar do hardware (a
  promessa ficava pendente para sempre); agora resolve como cancelado,
  com flag `settled` para OK/cancelar nunca serem sobrescritos
- **"Terminar sessão" blindado:** falha de rede no logout não trava
  mais o botão — a sessão local é limpa de qualquer forma e a página
  re-renderiza para Convidado

### Adicionado — "Meus repositórios" no Git (sidebar) e no chat de IA

- **Movido da página GitHub:** listar repositórios agora mora onde os
  repositórios são USADOS. A página GitHub (settings) fica com conta,
  token, URL remota e branch; a linha "Meus repositórios" saiu de lá
- **Git sidebar:** cartão "Repositório GitHub" novo (logo abaixo da
  conta) mostrando o repositório ativo, branch e URL remota — um toque
  lista os repositórios da conta e define o usado por push/clone;
  espelha em tempo real mudanças feitas no chat
- **IA com contexto de repositório:** quando um repositório está ativo
  e há sessão GitHub, o agente recebe o contexto no system prompt e
  ganha duas ferramentas: `github_read` (árvore de ficheiros, conteúdo
  de ficheiro com sha, qualquer endpoint GET — issues, PRs, branches) e
  `github_write` (commits via Contents API, criação de issues/PR —
  sempre com permissão do usuário). O token nunca sai do aparelho —
  as chamadas vão direto para api.github.com

### Adicionado — Acode upstream (últimos 15 dias triados)

- **#2851 portado:** `cordova.exec` é mapeado de forma assíncrona
  durante o boot — chamadas de plugin muito cedo podiam falhar com
  "bridge is not available" mesmo com cordova.js já avaliado; o
  pluginContext agora cai para `cordova.require("cordova/exec")`
  (disponível desde a avaliação) e o hardenBridge tolera ausência do
  bridge
- Triagem dos outros 34 commits: #2863 (menu de contexto de abas) já
  existe (close others/left/right); #2840 (recuperação de migração
  SFTP) e #2836 (webview destroy) já cobertos pelo nosso
  reescrita; #2888 (Content-Type em POST) não aplicável; #2886/#2880
  (indentação de word wrap) e #2887 (fileIcons API) anotados no
  roadmap para estudo com CM6

### Testes

- +18 testes novos, −1 superseded (716 → 733 em 87 ficheiros):
  profileSignOut (3 — confirm real + actionStack real + corrida de
  ressurreição), ghRepos (5), aiGithubTools (8), pluginContextExecRace
  (2); tsc limpo, biome limpo, typos 0, build production OK, boot
  harness idêntico ao baseline (11 apps, STARTED APP AND ITS SERVICES)

### EN summary

- **Profile fixed for good:** a token refresh racing "Sign out" could
  resurrect the just-cleared session (epoch guard added); the hardware
  back button threw on profile/support pages (actionStack `callback`
  vs `action` key); back-dismissed confirms hang forever (now resolve
  as cancelled); sign-out is failure-proof (local session always
  cleared)
- **Repositories moved where they are used:** the GitHub settings page
  keeps account/token/remote/branch; the Git sidebar gains a
  "Repositório GitHub" card (active repo + picker) and the AI agent
  gains the active repo as context plus `github_read`/`github_write`
  tools (tree, file contents with sha, Contents API commits, issues —
  write always user-approved; token never leaves the device)
- **Acode #2851 ported:** early plugin calls no longer fail during the
  Cordova boot race (internal `cordova/exec` loader fallback)
- +18 new tests, −1 superseded (733 green in 87 files), tsc/biome/typos clean, production
  build OK, boot harness identical to baseline

## [1.7.0] - 2026-09-11

### Adicionado — Sessões SSH v2 (roadmap v1.7.x item 3)

- **Identidade visual por host:** cada servidor salvo ganha uma cor
  estável derivada do próprio nome (determinística — o mesmo host
  aparece sempre com a mesma cor na lista de sessões SSH), com rótulo
  `user@host:porta` e o diretório inicial configurado visível na linha
  do servidor
- **Histórico de comandos por host:** os comandos digitados nos
  terminais SSH são gravados por servidor (cap 100, dedupe consecutivo,
  apenas no aparelho — nada vai para a rede); o diálogo lista do mais
  recente ao mais antigo, um toque copia o comando, e o botão limpa o
  histórico do host. Prompts de senha/frase-chave/código são detectados
  no buffer do terminal e NUNCA são gravados; Ctrl+C/D/U e ESC abandonam
  a linha em edição
- **Diretório inicial configurável:** ação nova em cada servidor grava
  o diretório onde o shell começa (vazio = padrão do servidor); o
  terminal respeita a precedência opção explícita > home configurado >
  caminho da URL > `/`; hosts apagados pelo navegador de arquivos são
  limpos automaticamente da lista
- Novo módulo puro `lib/sshSessions.js` (visual, histórico, home dir,
  resolução de diretório) + 16 testes

### Adicionado — Fontes v2 (roadmap v1.7.x item 4)

- **Preview ao vivo em cada linha** do gerenciador de fontes — cada
  fonte é renderizada nela mesma ("AaBbCc 123 — …" com pangrama
  traduzido) ANTES de aplicar; fontes remotas são pré-carregadas em
  background e cacheadas
- **Variação de peso no editor:** nova opção "Peso da fonte do editor"
  nas configurações (400 Normal → 900 Black) aplicada ao tema do
  CodeMirror com reconfiguração ao vivo; validação de peso no
  `fonts.setEditorFont` e default `editorFontWeight: 400`
- **Página de fontes internacionalizada** — 28 chaves novas (en +
  pt-br 100%), incluindo subtítulos, diálogos de aplicar/excluir e
  mensagens de erro

### Corrigido

- **Página de suporte normalizada:** o corpo da página não tinha as
  classes `main scroll` (o mesmo defeito latente que matava a página de
  perfil antes da v1.6.4 — `$page.body` voltava `null`) e o caminho de
  erro de abertura da conta usava `logger` SEM import (ReferenceError
  silenciosa no catch); código morto `maskAccount` removido
- **Aviso do proot "can't sanitize binding" eliminado na origem** (porte
  do upstream Acode #2878): o `init-sandbox.sh` testava os descritores
  via `/proc/self` DENTRO de command substitution — o readlink via o
  /dev/null do próprio filho em vez do stderr real do sandbox — e
  acabava sempre ligando o binding do fd de pipe; agora o probe usa o
  pid do shell (`$$`), compara o alvo cru do magic link (mesma semântica
  do realpath(3) do proot) e só liga stdin/stdout/stderr quando
  resolvem para caminho real

### Adicionado — repositório

- **Workflow `congrats-pr.yml`:** quando um PR da comunidade é mesclado
  (autor ≠ dono, sem bots), o bot deixa um obrigado bilíngue no PR —
  alternativa gratuita e sem dependências ao bot de Discord do upstream
  (#2855)
- **Atalho de teclado novo:** `Ctrl-Shift-W` abre a aba Welcome (porte
  do Acode #2773)

### Site (xcoder-web)

- **i18n final:** editor do blog admin traduzido (17 strings), tiers e
  textos do /sponsor cobertos em inglês, placeholders dinâmicos de chat
  e download convertidos para tokens (`{room}`, `{v}`), +47 traduções
  novas no dicionário EN

### Testes

- +22 testes (716 no total, 83 ficheiros): sshSessions (16) e fontsV2
  (6); baseline 716/716 verde, tsc limpo, biome limpo, build production
  OK, boot harness OK ("STARTED APP AND ITS SERVICES", todos os chunks
  carregados)

### EN summary

- **SSH sessions v2:** stable per-host colors, per-host command history
  (local-only, password-prompt safe, cap 100) and a configurable home
  directory per server (explicit option > stored home > URL path > /)
- **Fonts v2:** live preview of every font in the manager list, editor
  font weight (400–900) with live CodeMirror reconfigure, and a fully
  localized fonts page (28 new keys)
- **Fixed:** support page normalized (missing `main scroll` classes +
  missing `logger` import in error path); proot "can't sanitize
  binding" fd warnings fixed at the source (ported Acode #2878)
- **Repo:** congrats workflow for merged community PRs; Ctrl-Shift-W
  opens Welcome (Acode #2773)
- **Site:** last i18n gaps closed (admin blog editor, sponsor tiers,
  dynamic placeholders) — +47 EN translations
- Tests: 716/716 green (83 files)

## [1.6.4] - 2026-09-11

### Corrigido — conta (página de perfil)

- **"Entrar" e "Criar conta" voltaram a funcionar de verdade** — faltava
  o conserto central: o setter `body` do WCPage SUBSTITUI o contêiner
  interno `.main` da página pelo elemento atribuído, e o getter `body`
  só encontra elementos `.main`/`main` — o div da página de perfil não
  era nenhum dos dois, então `$page.body` voltava `null` depois da
  atribuição e cada toque em "Entrar"/"Criar conta" morria num
  `TypeError` silencioso (promise rejeitada sem tratamento). A sessão
  até chegava a ser criada no papel, mas a página nunca conseguia ler os
  campos — e ficava presa em "Convidado" para sempre. O corpo agora
  guarda a referência local `$body` (usada pelas 7 leituras do ficheiro)
  e carrega as classes padrão `main scroll`, mesmo padrão da página
  Sobre, restaurando também o dimensionamento/rolagem canônicos
- As versões 1.6.1/1.6.2 consertaram a validade da sessão
  (`ensureFreshSession`), a persistência do PAT e a ponte site → app —
  mas o clique morto permanecia; é por isso que o perfil continuava sem
  conta mesmo após o login

### EN summary

- **Sign-in buttons on the account page work again.** The WCPage `body`
  setter replaces the page's internal `.main` container with the
  assigned element, and the `body` getter only resolves elements
  matching `.main`/`main` — the profile div was neither, so `$page.body`
  returned null afterwards and every tap on "Entrar"/"Criar conta"
  died in a silent TypeError (async click handler, unhandled rejection).
  The page body now keeps a local `$body` reference (all 7 reads) and
  carries the standard `main scroll` classes (About-page pattern), which
  also restores the canonical sizing/scrolling. v1.6.1/v1.6.2 had fixed
  session freshness, PAT persistence and the site→app handoff — the dead
  click remained, which is why the profile still showed "Convidado".

## [1.6.3] - 2026-09-10

### Adicionado — Console REPL v2 + wiki bilíngue

- **Console REPL v2 (roadmap v1.7.x item 3)**: o console JS da barra
  lateral ganhou três superpoderes. **Histórico persistente** — os
  comandos executados sobrevivem ao reinício do app (localStorage com
  dedupe de repetições e cap de 50). **Snippets salvos** — dois botões
  novos na toolbar (salvar/listar): nomeie, carregue e exclua snippets
  direto do console. **Imports do workspace** — snippets podem importar
  módulos do projeto com `import {x} from "./lib/mod.js"` (bem como
  `import()` dinâmico e reexports): os arquivos relativos são resolvidos
  a partir da pasta do arquivo aberto, convertidos em Blob URLs e
  executados no sandbox — resolução transitiva com guardas de ciclo e
  cap de 64 módulos; módulos ausentes aparecem como erro no console
  ANTES de executar
- **Wiki 100% bilíngue**: as 16 páginas da wiki (14 de conteúdo +
  `_Sidebar` + `_Footer`) agora trazem secção 🇧🇷 + 🇺🇸 no mesmo
  ficheiro, no mesmo formato de README/ROADMAP/docs; `publish-wiki.mjs`
  extrai apenas a secção ativa na publicação (`WIKI_LANG=pt|en`, padrão
  pt) e o novo `wiki/checkWikiBilingual.mjs` valida a política no CI

### EN summary

- **JS Console v2**: persistent history, saved snippets and workspace
  imports (`./relative` specifiers are inlined as Blob URLs into the
  sandboxed worker, transitively, with cycle/cap guards).
- **Bilingual wiki**: all 16 wiki pages now carry 🇧🇷 + 🇺🇸 sections in a
  single file; `publish-wiki.mjs` extracts the active section when
  publishing (`WIKI_LANG=pt|en`) and CI enforces the policy.

### Testes

- +35 testes (652 → 687): histórico (dedupe/cap/corrupção), snippets
  (upsert/remove/cap), imports (cláusulas, rewriting de snippet e de
  módulo, resolução transitiva, ciclos, cap, especificadores externos) e
  guardas de wiring do app

## [1.6.2] - 2026-09-10

### Corrigido — GitHub que não aparecia + ícones + conta

- **PAT persistido de verdade (causa raiz de "conectei via PAT e os repos
  não aparecem")**: o kit de settings NÃO grava valores de prompt — só
  atualiza a linha e chama o callback; o comentário "the settings kit
  already persisted the prompt value" em `ghSettings.js` estava errado e o
  token colado era descartado em silêncio. Agora a página persiste
  `ghToken`/`gitRemoteUrl`/`ghBranch` explicitamente (`settings.update`),
  busca o perfil logo após salvar um token e encerra a sessão GitHub
  quando o token é limpo. Guardas em `v162Fixes.test.js`
- **Ícones das opções Fontes e Sessões SSH**: os nomes `svg:server` e
  `svg:type` não existiam no pack (`src/utils/svgIcons.js`) e o fallback
  (`icon svg:<nome>`) não corresponde a nenhum glifo da fonte de ícones —
  nada renderizava. Adicionados `server`, `type`, `copy`, `trash-2`,
  `check` e `qr-code` (Lucide) + regenerados os vetores de
  `src/res/icons/svg/` (61). `dialogs/select.js` agora também desenha
  ícones `svg:` como vetores — picker de repositórios, chooser de login e
  ações de commit incluídos; ícones do chooser corrigidos
  (`external-link`, `qr-code`)
- **Página de conta: fim do "Convidado eterno"**: novo botão "Continuar
  com a conta do site" (abre `/auth/app-handoff`, que entrega a sessão já
  existente do site para o app via `xcoder://auth/oauth`); a página
  re-renderiza no evento `authchange` (sessão chegando pelo intent);
  sessão expirada é renovada em background (`ensureFreshSession`);
  **erros de login aparecem dentro do formulário** (`data-form-error`) —
  falhas nunca mais parecem "o botão não faz nada"

### Adicionado

- **Settings reagrupadas por categoria**: Core → Aparência (Tema, Fontes)
  → Código e ferramentas (Formatter, LSP, IA, Plugins, marketplace URL) →
  Conexões (GitHub, Sessões SSH) → Dados e backup → Sobre o XCoder; novas
  strings `settings-category-*` (en + pt-br)
- **Site: `/auth/app-handoff`** (xcoder-web) — ponte de sessão
  site → app: usuário logado no site tem a sessão entregue ao app
  automaticamente; sem sessão, mostra o formulário compartilhado e entrega
  após o login
- **Workflow `pr-review.yml`** (app + site): bot de review GRATUITO do
  próprio repo — comentário fixo bilíngue no PR com resumo do diff por
  área, sugestões por regras (src sem testes, package.json sem lockfile,
  docs sem nota bilíngue) e checklist do revisor (substitui reviewers
  pagos tipo Greptile; comentário único atualizado a cada push)
- Actions atualizadas: checkout v7, setup-node v7, setup-java v6,
  github-script v9, create-pull-request v8, stale v11

### Documentação

- **MDs bilíngues**: README (fundido com README.en.md, apagado),
  CONTRIBUTING, CODE_OF_CONDUCT (texto canônico do Contributor Covenant
  restaurado nas seções corrompidas), ROADMAP, docs/{ADS,ICONS,README,
  github-oauth-app} — secção 🇧🇷 + 🇺🇸 no mesmo ficheiro, com âncoras;
  wiki/README.md documenta a política (páginas da wiki seguem pt por ora —
  conversão no roadmap v1.7.x); `_typos.toml` exclui os MDs bilíngues

### Testes

- +8 testes (640 → 652): varredura de completude do pack de ícones, render
  `svg:` no select, guardas de persistência do PAT, wiring do handoff e
  ordem das categorias

<a id="english"></a>

## [1.8.39] - 2026-11-26

### Added
- **Site Analyzer** (new sidebar tool, telescope glyph) — finds what a
  site is built with: frameworks (Next.js, React, Vue, Angular, Astro,
  SvelteKit, Nuxt…), languages (PHP, Python, Java, C#, Ruby, Node.js…),
  servers & CDNs (Cloudflare, Vercel, nginx, Apache, CloudFront…), CMS &
  commerce (WordPress, Shopify, Wix, WooCommerce…), analytics, fonts,
  captchas, widgets — **110+ detection signatures**, every match shown
  WITH its **evidence** (header line or HTML snippet). Details tab with
  page meta + response headers; a "Rendered version" pass loads the page
  in an internal WebView and analyzes the final DOM (handles SPAs and
  blocked requests); full copyable report. The native preview menu gained
  **"Analyze"** (SEARCH glyph in the preview icon.ttf) which hands the
  URL over — and the new `httpFetchDetailed` returns headers + status
  without rejecting 4xx/5xx responses (a 403 interstitial still
  identifies the stack guarding the site).
- **Learn** (new sidebar tool, mortar-board glyph) — a curated catalog of
  **43 top sites** to study and consult any programming language or web
  tool (MDN, W3Schools, freeCodeCamp, javascript.info, roadmap.sh, Pro
  Git, SQLBolt, LearnGitBranching, Codewars/LeetCode/Exercism
  challenges…), grouped in 11 categories with search and filters. Every
  site opens in the **floating internal WebView** (iframe inside the
  app's floating window, with Back/Reload/External toolbar) — and when a
  site blocks embedding (X-Frame-Options / CSP frame-ancestors detected
  on the headers by an HTTP probe), it automatically falls back to the
  **native internal WebView** (fullscreen activity); an "Open in internal
  WebView" button stays one tap away.

### Internationalization
- **68 new keys × 31 languages** — every app language at 100% (0 missing,
  0 empty). "Framework" kept as the technical term where the generic
  translation would mislead (Rahmenwerke/Рамки/Cadres → Frameworks).

### Tests
- 1368/1368 total — 12 new tests for the detection engine (header/HTML
  signatures, language derivation, evidence cap, embedding policy,
  report builder).

## [1.8.36] - 2026-11-25

### Preview SEO & web-tool fixes

- **SEO audit in the preview** — the native preview menu gained **"SEO"**:
  it opens, inside the page itself, a detailed report with **scores**
  (overall 0–100 plus per-category: Meta & tags, Content, Social,
  Technical, Performance). Every check shows status (✓ / ! / ✕), the
  measured value and a fix tip: title, description, canonical, robots/
  noindex, lang, charset, h1/h2, text volume, images missing alt, empty
  links, Open Graph, Twitter Card, HTTPS, viewport, favicon, JSON-LD,
  HTML weight, blocking scripts, TTFB/load time and resource requests.
  - **Copy** (plain-text report), **Refresh** and close buttons; nothing
    leaves the page — the preview is never abandoned.
- **"Inspect" and "Scrape" removed from the preview menu** (user
  request): the tools remain in the sidebar, and tapping them no longer
  bounces you back to the editor.
- **Inspector finally works** — two root causes fixed: native side now
  builds the WebView headless for invisible fullscreen sessions (commands
  no longer fail with "WebView is not ready"), and on page load the DOM
  tree is fetched immediately (with a hydration retry for late-painting
  SPAs) — no more eternal spinner.
- **Scraper: no more "encrypted" source** — minified captures are
  **auto-formatted** with Prettier; the button toggles
  "Beautify ↔ Raw" and the original bytes stay available. Raw fetch
  failures fall back to the rendered page automatically; empty responses
  are surfaced instead of a blank screen. The Analysis tab gained an SEO
  audit card with the same scores.
- **Overflowing sidebar rail now scrolls** — `touch-action: pan-y` plus a
  slide-gesture exemption for vertical drags inside the icon rail.
- **Copy problems** — the Problems page gained a copy-all header action
  and a per-problem copy icon.

## [1.8.35] - 2026-11-24

### Inspection & scraping on the preview screen

- **The native preview menu gained "Inspect" and "Scrape"** — one tap
  hands the current URL to the editor: the Inspector (Elements/Console/
  Network) opens with the page loaded, or the Scraper fetches the
  **rendered** source (post-JavaScript) with assets, secrets and
  endpoints. The preview stays in the back stack.
  - Works for any previewed URL, including the embedded server's
    `http://localhost` (the server stays alive when the tool opens).
  - The hand-off survives restoration: queued until files reopen.
- **New native icon glyphs** — `CODE` (`< >`) and `GLOBE`.
- The console-only preview mode hides the new items.


## [1.8.34] - 2026-11-24

### Highlights from the official Acode, ported to XCoder

- **Drag & drop in the Explorer** — long-press a file (or a whole
  multi-selection) and drop it on a folder to move it; closed folders
  spring open on hover, the list auto-scrolls at the edges, the drag card
  shows an item-count badge, and folders cannot be dropped into
  themselves. Touch and mouse, with haptics and settle animations.
  Cross-provider moves transfer via copy + delete when a plain rename is
  unavailable.
- **`color-mix()` guarded with `@supports`** — every redesign declaration
  using `color-mix()` compiles into an `@supports` block with a plain
  fallback first, so old WebViews keep colors instead of falling back to
  transparent.
- **Immersive fullscreen + orientation API** — real Android immersive mode
  with Back delivery for the fullscreen owner
  (`xcoder.require("fullscreen")`) and temporary orientation lock
  (`xcoder.require("orientation").lock("landscape")`), injected into
  CordovaLib by a prepare hook.
- **Documents shared from other apps** — SEND / SEND_MULTIPLE intent
  filter (pdf, docx, xlsx, pptx, ods, csv, tsv); the native plugin
  collects every uri (EXTRA_STREAM + ClipData), persists grants when
  possible, and XCoder opens the batch (last file gets focus).
- **Default device size for the in-app preview** — "Set as Default" /
  "Clear Default" menu items in Devices mode; presets are re-fitted to the
  current screen on restore and the preview reopens without double reloads.
- **Markdown with GFM** syntax in the editor mode.
- **Search option hints** — long-press tooltips (title + description,
  shadow-root aware) on the aA / a-z / .* / IDX / HD toggles, with
  title/aria-label accessibility attributes.
- **`file://` links in LSP docs open in the editor** (with `#L12:5`
  fragments) instead of crashing into the system browser; the native
  `openInBrowser` refuses `file:` and survives missing activities.
- **Native replace follows JS substitution rules** ($1…$99, $<name>, $&,
  `` $` ``, $', $$) including named groups.
- Ported fixes: replace-all with an empty replacement; scrollbar keyboard
  reopen + thumb measurement; folders rendered twice while loading; CRLF
  paste cursor; reliable fold-all on large files.


## [1.8.33] - 2026-11-24

### Full VS Code redesign (beyond icons)

- **`vscode-ui.scss` chrome layer** — the whole shell tuned to the VS Code
  desktop design language: crisp geometry (2–6px radii replacing the
  rounded 6–18px scale), flat elevation (hairlines over big shadows),
  exact chrome metrics (35px tabs, 48px activity bar, 32px inputs),
  9px scrollbars that reveal on hover, active tabs melting into the
  editor surface with a top accent line, unsaved dot instead of an
  asterisk, hairline-bordered context menus and dialogs. Themes still own
  the COLORS — everything works in light and dark.
- **No more double gear in the AI chat** — the model picker (tune) and AI
  settings both rendered a gear; the model picker now uses the VS Code
  "sparkle" glyph (✨), clearly distinct from Settings.

### Inspector — PC-grade inspection tools (URL included)

- **New Inspector app in the activity bar** — opens ANY site in a native
  webview with a capture script injected BEFORE the page's own scripts
  (document start + end, on every navigation), Chrome DevTools style:
  - **Elements** — navigable DOM tree (per-level expand/collapse),
    attributes, computed styles, box model, node HTML (copy/insert into
    the editor), CSS selector search and **on-page element highlight**.
  - **Console** — page console.log/warn/error, uncaught errors and
    unhandled rejections, plus a field to **run JavaScript** in the page.
  - **Network** — fetch/XHR log with method, URL, status, timing and
    size, filterable by type (XHR/JSON, JS, CSS, images, fonts).
  - Dedicated URL bar (as requested), reload, fullscreen page view and
    session close.

### Scraper + reverse engineering

- **New Scraper app** — downloads the source of any site two ways:
  **raw** through the native HTTP client (no CORS, browser User-Agent) or
  **rendered** in a hidden webview (DOM after JavaScript runs — handles
  JS-shell sites). Source is previewed and can be **saved to the
  project**, **opened in the editor**, copied or **beautified** (Prettier
  for HTML/CSS/JS/JSON).
- **Assets** — extracts images (src + srcset + CSS url()), scripts,
  stylesheets, fonts and media with absolute URLs; download one by one,
  selected items or **all images** at once into the app's
  Download/<site>/ folder.
- **Reverse engineering analysis** — page metadata (title, description,
  generator, Open Graph, canonical), **secret detection** in code (AWS,
  Google, OpenAI keys; GitHub/Slack/GitLab tokens; JWTs; private keys;
  generic api_key/secret assignments — masked, with line and context)
  and **API endpoints** (`/api/...`, /graphql, /v1…) plus absolute URLs.

### Language servers — filterable manager with sizes

- **Rebuilt page** ("Settings › Language servers"): text search,
  **All/Installed/Not installed filters**, **language filter**, sorting by
  name/language/status/**size** and a refresh action; each row shows the
  real install status (checked in the runtime shell, with version), the
  languages and **both sizes**: the **estimated download before
  installing** (npm registry, PyPI and crates.io APIs) and the **on-disk
  size after installing** (`du -sk` over each installer's real paths —
  npm global prefix, pip site-packages, apk database, binaries). Custom
  server creation stays in the header "+" action.

### Platform

- **Native webview plugin gains `setInjectScript`** — register a script
  that Android re-injects at the start AND end of every navigation (the
  Inspector capture foundation; public API for apps/plugins).

## [1.8.32] - 2026-11-23

### VS Code look — real icons across the whole app

- **Full bundled vscode-icons file icon pack** — all 843 official icons
  (MIT) ship inside the app: the file browser, editor tabs, quick open
  and dialogs now show VS Code's colored file icons (blue TypeScript,
  yellow JavaScript, orange Rust, special folders like `src/`/`.github/`
  …), matched by file name, extension and language. Enabled by default;
  the old pack remains available under Settings › Icon pack.
- **Codicons for the entire UI** — the official @vscode/codicons font
  (570 glyphs) replaces the Material UI glyphs: menus, dialogs, settings
  and the activity bar (Explorer, Search, Source Control, Extensions,
  AI, Terminal…) now use the very icons VS Code uses.
- **VS Code Dark+ editor theme by default** — new users get
  `vscodeDark`/`vscodeLight` and a one-time migration replaces the old
  `one_dark`/`noctisLilac` defaults, matching the Dark Modern app theme.

### More robust AI chat

- **VS Code-style code blocks** — a header with the language name and a
  copy button on every block; tapping the body still opens code actions.
- **Explicit «Regenerate» button on error bubbles** — on top of the
  long-press gesture, errors now offer a direct retry.

### Fixes

- **About opens again** — the OSS libraries list referenced a global
  that was never defined (ReferenceError) and crashed the page; it now
  imports `res/oss-libraries.json` directly.
- **No visible &lt;span&gt; tags in library sizes** — the libraries list
  (local/CDN) literally rendered «&lt;span&gt;43KB&lt;/span&gt;»; the
  size now renders as an element.
- **File icons in editor tabs** — the tab shadow root now adopts the
  active icon theme stylesheet (shared via `adoptedStyleSheets`), so
  icons render in tabs too.

## [1.8.31] - 2026-11-23

### Git — clone fixed for good

- **End of «HTTP Error: undefined undefined»** — isomorphic-git reads
  `statusCode`/`statusMessage` and `headers['content-type']` (Node
  style), but the native HTTP client answered with `status`/`statusText`
  and headers without direct property access: EVERY response — even a
  200! — was rejected as an error. The client now returns both shapes
  plus plain lowercase headers (with `.get()` helpers), so clone, push,
  pull and fetch work again in the Git panel and the bot.

### About / Changelog

- **Current-version changelog always correct** — the "current version"
  tab reads the CHANGELOG.md bundled with the build first (the running
  version's section) instead of the GitHub release commit summary that
  repeated the same short info; the full bilingual notes now show
  exactly like in the repository.
- **Every open-source library in About** — "Open-source libraries" now
  covers all 80 production dependencies (name, version, license and
  homepage), generated from package.json; tap an entry to open the
  project page.
- **"Version xx.xx" with a space** — the label and the version number
  are no longer glued together at the top of About.
- **Links no longer overflow the screen** — long URLs wrap inside their
  row in About and the changelog (overflow-wrap + word-break).

### Web

- The site now publishes the **full CHANGELOG.md** on the /changelog
  page (besides the release summaries) and received announcements for
  versions 1.8.28–1.8.30.


## [1.8.30] - 2026-11-23

### Plugins — bridge with the Acode marketplace

- **XCoder now lists, installs and runs Acode plugins** — the in-app
  marketplace merges the native registry with the official Acode store
  (`acode.app/api`): 350 packages show up in the same list, with an
  "Acode" badge, a new source filter (XCoder / Acode), unified search and
  pagination. Downloads go straight to the official endpoint
  (`/api/plugin/download/<id>`) — no middleman server. Paid plugins
  (Acode IAP) and packages built for another editor core are hidden
  automatically.
- **Runtime compatibility (`window.acode` bridge)** — XCoder exposes the
  same API under the global Acode plugins expect: `acode.require()`,
  `acode.setPluginInit/setPluginUnmount`, `acode.execCommand`,
  formatters, editor themes, terminal and every other module behave
  identically. `.acode` plugins run unmodified next to `.xcoder` ones —
  including when an Acode plugin requests dependencies
  (`acode.installPlugin` resolves through the merged registry).
- **Simultaneous .xcoder and .acode support** — `.xcoder`,
  `.xcoder-plugin`, `.acode` and `.acode-plugin` files are installable
  from the file browser (tapping offers installation; the actions menu
  gains "Install as plugin"), from any URL via "Add source", and through
  deep links: the app now also answers `acode://plugin/install/<id>`
  (besides `xcoder://`), accepting the underscore-style ids of the Acode
  ecosystem.
- **Plugin details like the Acode store** — for bridged plugins the app
  fetches the markdown readme, changelogs, contributors and metadata
  from the store (cached), so descriptions render complete exactly like
  in Acode. The `min_version_code` guard is preserved.
- **Hardened installer** — legacy manifests without an `id` get a stable
  one derived from name/file name; plugin downloads gained a `fetch`
  fallback for desktop builds/webviews without the native HTTP plugin.


## 🇺🇸 English

Every notable change to **XCoder** is documented here. Historical entries
are written in Brazilian Portuguese; from v1.6.2 onward each release also
carries a short English summary right below the Portuguese one.

## [1.8.8] - 2026-11-01

### Fixed — GitHub account in Git, for real
- The «Connect with GitHub (browser)» route dead-ended on the site's
  "Integração GitHub não configurada" page: the hosting never received
  the «GITHUB_APP_CLIENT_ID/SECRET» env vars, yet the app offered the
  broken route first. The site now exposes «/api/github/status»
  (booleans only, CORS-enabled) and the app probes it (10 min cache,
  CORS-free advanced-http + fetch fallback): the browser option only
  shows up when the integration exists; otherwise the device flow
  (verified working with the built-in client id) comes first and the
  PAT route is always available. The site's error page now points to
  the device flow / PAT until the vars are set.

### Added — sidebar menu in the freed panel area
- With floating windows, the area where panels used to dock is no
  longer empty: it shows the option titles grouped by category (Views,
  Tools, Account) with icon, name, live badge and an open affordance;
  tapping a row opens the app's floating window (on phones the sidebar
  steps aside so the window takes the screen); the menu follows the app
  language and unmounts in docked mode.

### Changed — minimize floating windows
- New minimize button (minimize/maximize/close order): the window
  collapses to its title bar ("header with buttons only"); restore via
  the title, the button (now "expand") or the app icon on the activity
  bar (which restores instead of closing); activating another app
  re-expands automatically; maximizing from minimized expands and the
  previous maximized state is remembered; saved geometry is not
  corrupted while minimized.
- Tests — 15 new (sidebar menu 5, minimize/restore 4, honest GitHub
  sign-in chooser 6): 1006/1006 total.

## [1.8.7] - 2026-10-31

### Added
- **In-app download manager** — "downloads inside the app don't work"
  is fixed: `lib/downloadManager.js` downloads ANY url (zips, APKs,
  images) into the app Download folder with a native transport
  (advanced-http, disk streaming, byte-accurate progress) and a fetch
  fallback; sequential queue, live progress notifications and a Cancel
  action. Entry points: file browser › «Download from URL» (+ menu) and
  the Website app header button; the embedded iframe now allows
  `allow-downloads`.
- **Library catalog: 59 entries (8 offline + 51 CDN)** — React, Vue,
  Tailwind, Bulma, Pico, Lodash, D3, Three.js, GSAP, Swiper, Leaflet,
  ECharts, Mermaid, Highlight.js, KaTeX, MathJax, Supabase, Lucide and
  more. Every URL was verified (HTTP 200) at generation time; CDN
  entries carry their own badge and offer ready-to-paste tags.
- **Terminal opens in the active project** — fresh sessions `cd` into
  the active file's folder (file:// → proot-bound paths: /sdcard,
  /storage, /data); SAF/https targets are skipped.
- **Publish to GitHub from the Git panel** — a new «Publish to GitHub»
  button uses the connected account (PAT) to create ONE real commit via
  the git data API (blobs → tree → commit → ref), covering existing
  branches, missing branches and empty repositories.
- **Codex and Claude Code plugins** — working offline replicas on the
  marketplace (35 total): they generate AGENTS.md/CLAUDE.md at the
  project root, turn selections into structured tasks, review/plan
  prompts and conventional commit messages. The built-in agent gains
  the /skill codex and /skill claude-code playbooks.
- **Sidebar: names and categories** — icon names under the activity bar
  glyphs and small-caps captions per group (Views, Tools, Account).

### Changed
- **Sidebar panels as floating windows** — tapping an icon opens the
  panel in an independent window (draggable header, resizable corner,
  maximize, close via button or by tapping the icon again; position and
  size persisted). Setting «sidebarFloatingWindows = 0» restores the
  classic docked mode; no panel opens by itself at boot.

## [1.8.6] - 2026-10-31

### Fixed
- **Book icon (Libraries) opened nothing** — the offline libraries
  list rendered at boot while its container was still DETACHED and
  `render()` early-returned (`$panel?.isConnected === false`);
  `onSelected` only scrolled, so the panel stayed empty forever. Same
  bug the Dev Tools palette had before v1.8.3 — now `onSelected`
  renders on every activation, with a regression test walking the real
  path (add → tap → pulseApp → setActiveApp → onSelected).

### Changed
- **Rename pre-selects the basename** (Acode #3004 polish) — the file
  manager rename prompt selects only the name (`index` in
  `index.html`, everything in `.gitignore`), so typing replaces the
  name and keeps the extension. New pure helper
  `helpers.basenameRange()` and a `selection: "basename"` option on
  the `prompt()` dialog.

### Added
- **Roadmap refreshed with upstream** — Acode news API-verified on
  2026-10-31 (v1.13.5 + nightlies): #2999 file-tree multi-select/drag,
  #2966 preview device sizes, #2987 Mermaid in Markdown, #2988
  experimental canvas, open pain points (#2980, #3006/#3007, #2336,
  #2979) and reverted PRs not to follow (#2864, #2526, #2930/#2931).

## [1.8.5] - 2026-10-27

### Added — VS Code-style activity bar

- **Grouped activity bar**: primary views (Files, Search, Plugins, AI,
  Git) on top, tools (JS Console, Dev Tools, Libraries, Website,
  Notifications) behind a separator, and Account / Settings / About
  pinned to the bottom of the rail — the VS Code layout. Plugin-added
  apps keep landing in the primary group.
- **Activity bar badges**: the Git icon shows the number of pending
  changes (refreshed on every status read, cleared on error) and the
  bell shows unread notifications. New registry API `setBadge(id,
  value)` accepts a number (pill, capped at «99+»), `true` (dot) or
  `null` (clear).
- **Long-press tooltip**: holding a rail icon for half a second shows
  the panel name in a VS Code-style bubble — the native `title`
  attribute never appears on touch.

### Changed

- **VS Code-style view headers**: left-aligned small-caps title with
  letter spacing and a hairline divider (Plugins, Notifications)
  instead of the old centered title.

### Fixed

- **Side-button icons never rendered**: JSX typo `<spam>` in the
  side-button component prevented the glyph from showing; now `<span>`.

## [1.8.4] - 2026-10-10

### Fixed — support QR codes + clearer admin errors

- **Payment-method QR codes now show in the app**: Ko-fi/Patreon/
  M-Pesa/e-Mola QR images live in the site database (`qr_image_url`)
  and were already served by `/api/config`, but `normalizeMethod()`
  (lib/premium) rebuilt every row WITHOUT the field, so the support
  page never received them. The field now passes through (same DB
  name) and QR-only methods (no url, no account) are no longer
  dropped. Tests: supportInfo passthrough + support-page rendering.
- **Site /admin translates the old-database rejection** into a clear
  hint: open /setup › «Aplicar schema» to re-apply the full
  channel list (pix, kofi, patreon, liberapay, opencollective,
  crypto) — no data is lost.

## [1.8.3] - 2026-09-22

### Fixed — Dev Tools sidebar app dead on tap

- **"The tools icon does nothing"**: the Dev Tools panel never rendered
  on activation. `renderPanel()` early-returned while the container was
  detached from the document (init time) and `onSelected()` only
  scrolled — the first tap on the palette icon showed an empty panel.
  The panel now renders on EVERY activation (the Git app's
  refresh-on-open pattern) and `setTool()`/`onLangChange()` query the
  app root, which also works on the detached tree. New behavioral test
  drives the REAL sidebarApps module (add + delegated click) and taps
  all 18 tools.
- **Gradient and Form tools crashed** — `gradientCSS` and `formSnippet`
  were used in `refresh()` but missing from the `lib/webdevTools`
  import list: ReferenceError as soon as the tool rendered. Caught by
  the new test, which requires non-empty output from every tool.

## [1.6.1] - 2026-09-10

### Added — GitHub App web flow (um toque no navegador)

- **"Conectar com GitHub (navegador)"** como primeira opção do chooser
  (`src/lib/ghWebFlow.js`): o app abre o navegador em
  `github.com/login/oauth/authorize`, o site oficial troca o código pelo
  token NO SERVIDOR (o client secret vive só na env da Vercel — nunca no
  app/repo público) e devolve a sessão por `xcoder://github/session#…`;
  o app valida o `state` anti-CSRF, salva a sessão e atualiza o card da
  conta na hora (via `settings.on`, já reativo). Device Flow e PAT
  seguem disponíveis como alternativas
- Handler de retorno `xcoder://github/session` registrado no boot
  (`registerGhIntentHandler`), com tolerância a falha do perfil
  (fallback nos parâmetros `login`/`avatar` anexados pelo callback)

### Fixed — conta conectada ainda invisível em alguns casos

- O `refresh()` do app lateral de git fazia **early-return quando o
  status do repositório local falhava** e o cartão de conta nunca
  renderizava — agora a conta e os comandos GitHub renderizam
  independentes do estado do git local
- **Login da conta do app à prova de webview**: o cliente Supabase do
  app (`src/lib/supabase.js`) ganhou camada HTTP nativa
  (cordova-plugin-advanced-http, sem CORS) para TODAS as requisições
  (entrar, criar conta, perfil, refresh, settings) — o login e-mail +
  senha na página de conta funciona mesmo quando o `fetch` do webview
  falha, com as mensagens de erro reais do servidor

### Site (xcoder-web)

- **`/api/github/callback`**: troca code→token server-side
  (`GITHUB_APP_CLIENT_ID`/`GITHUB_APP_CLIENT_SECRET`), página de
  fallback com "copiar link de retorno" e retorno automático por
  `xcoder://github/session`
- **`/api/github/webhook`**: receiver com validação HMAC
  (`X-Hub-Signature-256`), `ping`→`pong` e registro dos eventos
- O formulário de conta nunca mais falha em silêncio — backend não
  configurado e erros comuns do Supabase agora mostram mensagens pt-br
- Guia `docs/github-oauth-app.md` atualizado: web flow, envs da Vercel,
  webhook URL + secret, bot user `<slug>[bot]`, rotação do secret

### Tests
- +10 testes (630 → 640): web flow (disponibilidade, authorize URL sem
  `scope`, anti-CSRF, salvamento de sessão) e política do sign-in
  (ordem web → device, secret ausente do código-fonte, handler no boot,
  conta renderiza mesmo sem git local)

## [1.6.0] - 2026-09-10

### Roadmap v1.6.x — concluído

- **Sessões SSH** (item 1): nova página de configurações lista os
  servidores SFTP salvos e abre o terminal SSH com um toque; credenciais
  permanecem no perfil nativo SFTP (nada sensível nas configurações) e o
  botão "Nova conexão SFTP" abre o navegador de arquivos no menu certo
- **Console JS** (item 2): novo app da sidebar — REPL real num Web Worker
  em sandbox (sem DOM, sem Cordova): valor da última expressão, console
  capturado (log/warn/error), histórico ↑/↓, Ctrl+Enter executa, saída
  limitada a 200 linhas; worker novo `build/replWorker.js` (rspack +
  webpack)
- **Gerenciador de fontes** (item 3): instale fontes por URL
  (.ttf/.otf/.woff2 — baixadas para `DATA/fonts` e cacheadas), aplique ao
  **editor** e à **interface** separadamente, veja e remova as instaladas;
  usa a infra `lib/fonts.js` que já existia (a UI era a peça faltante)
- **Onboarding do terminal** (item 4): na primeira abertura de terminal,
  um diálogo explica Alpine × FailSafe e oferece "Reinstalar ambiente";
  mostrado uma vez (flag `terminalOnboardingDone` nas configurações)

### Fixed
- **Device Flow salvava sessão VAZIA** (o relato "conectou o GitHub mas o
  app não mostra a conta nem lista repositórios"): o resultado de
  `pollForToken()` era destruturado como `{token, user}` quando na verdade
  é a string do token — o app gravava `ghToken` vazio e o card da conta
  voltava para "Entrar"; agora o token é consumido como string, o perfil
  é buscado em separado (falha tolerada) e `saveGhSession()` rejeita
  sessões sem token
- **Perfil via plugin nativo** (CORS-free) com `fetch` como fallback —
  mesma estratégia do `ghGet` das configurações
- **Card da conta na sidebar Git atualiza na hora** quando a sessão muda
  (entrar/sair pelas configurações reflete imediatamente)
- Site: **página da conta persistia deslogada** — o gate e o header
  re-leem a sessão ao voltar de aba congelada (visibilitychange/pageshow);
  o formulário inline do gate força re-leitura ao entrar; `/auth/callback`
  não troca o código PKCE duas vezes (o segundo exchange falhava com
  "Falha na autenticação" mesmo com sessão válida)

### Tests
- +19 testes (611 → 630): regressão do Device Flow (fluxo completo com
  fetch simulado, sessão salva com token+perfil), runtime do REPL
  (valor da última expressão, console, erros, serialização) e guards de
  wiring das 4 features

## [1.5.4] - 2026-09-07

### GitHub App oficial
- **Chaves oficiais integradas**: o Client ID do GitHub App do mantenedor
  (`Ov23li…`) agora vem embutido no app (`config.GH_OAUTH_CLIENT_ID`) —
  "Entrar com um código" (Device Flow) sai de fábrica, sem PAT e sem
  criação de clientes próprios
- **Device Flow entende GitHub Apps**: client ids `Ov23li…`/`Iv1.` não
  enviam o parâmetro `scope` (as permissões do token do usuário vêm das
  configurações do app no GitHub); OAuth Apps clássicos continuam
  enviando os escopos de sempre
- Guia `docs/github-oauth-app.md` atualizado com o app real: ativar
  **Enable Device Flow**, permissões recomendadas (Contents/Pull
  requests/Workflows: read & write), papel do **client secret** (guardado
  pelo mantenedor, fora do repo — o Device Flow não usa), **webhook**
  (pode ficar Inactive) e **bot user id** (automático, `<slug>[bot]`)

### Model picker com logos (roadmap v1.6.x item 5)
- **Novo seletor de modelos próprio** (o select nativo era texto-only):
  lista com **logo real de cada marca**, badge **grátis/pago**, o modelo
  atual marcado com ✓ e **busca instantânea** — digite para filtrar;
  grupos sem resultados desaparecem
- A busca ao vivo (⟳) também usa o novo picker: os modelos vindos da API
  do provedor (até 300) agora são filtráveis por texto
- Os atalhos "Buscar modelos disponíveis" e "Digitar id manualmente"
  viraram ações do rodapé; provedores sem chave continuam visíveis mas
  desabilitados (nunca dá erro de endpoint por escolha inválida)
- Novo componente `components/modelPicker` no padrão dos dialogs
  (actionStack/máscara/tema) com helpers puros testáveis

### Tests
- +18 testes (device flow sem `scope` para GitHub Apps, filtro e logos
  do picker, wiring do chat, placeholders de tradução) — 611 no total

## [1.5.3] - 2026-09-07

### Changed
- **Botões ← e → removidos do header do editor** — a navegação por
  histórico de abas continua pelos atalhos Alt-←/Alt-→ e pelos comandos
  na paleta; o histórico persistente entre sessões não foi afetado

### Fixed
- **Suportes de IA (texto, imagem, vídeo, agentes) agora ficam em linha
  PRÓPRIA, por baixo do modelo** — complementa o rework da faixa da
  v1.5.2: o nome do modelo (e o logo) ficam na linha de cima; as pílulas
  de suporte descem para a linha de baixo, que rola lateralmente quando
  falta espaço — nada é mais escondido nem ao lado nem embaixo

### GitHub — sem "clientes próprios" (sign-in refeito)
- **Ninguém precisa mais criar OAuth App próprio**: a tela do GitHub
  (configurações + app lateral de git) passa a oferecer **PAT primeiro**
  (token de acesso pessoal, validado contra o perfil) e o **Device Flow
  oficial** com o client id embutido no app (`config.GH_OAUTH_CLIENT_ID`
  em `src/lib/config.js` — vazio até as chaves oficiais serem entregues;
  instalações legadas com client id salvo continuam funcionando)
- Fluxo compartilhado extraído para `src/lib/ghSignIn.js` (escolha do
  método → PAT ou device flow → sessão salva); a linha "OAuth App client
  id" saiu da página de configurações
- **Novo guia `docs/github-oauth-app.md`** (pt-br): passo a passo do
  OAuth App oficial, onde entra o client id e explicação de por que
  **webhook** e **bot user id** não se aplicam ao fluxo atual (e quando
  aplicariam)

### Fixed — modelos
- **Busca de modelos sem o prefixo "models/"**: catálogos do Google
  reportam ids como `models/gemini-2.5-flash`; o app normaliza para
  `gemini-2.5-flash` na listagem (`listModels`) e na leitura de modelos
  salvos (`resolveModel`). Ids que apenas CONTÊM `models/` no meio
  (ex.: Fireworks `accounts/fireworks/models/...`) e namespacing de
  vendor (ex.: OpenRouter `google/gemini-2.5-pro`) permanecem intactos

### CI
- **Dependabot**: bumps de `github-actions` agrupados num único PR
  (menos inundação) + nota de que FECHAR um PR do Dependabot suprime
  aquela atualização até a versão-alvo mudar (motivo do silêncio desde
  31/08 — merge em vez de fechar, ou deixe o auto-merge agir)

### Tests
- +12 testes (581 → 593): `aiModelId` (normalização de ids — unidade,
  listModels com fetch stub e guards) e `ghSignInPolicy` (sem clientes
  próprios no código, PAT antes do device flow, client id oficial
  embutido, ambos os pontos de entrada no fluxo compartilhado);
  `tabHistoryNav` atualizado para garantir que os botões NÃO voltam ao
  header e que os comandos continuam registrados
- i18n: chaves novas pt-br/en-us para o seletor de método, prompt de PAT
  e aviso de client id ausente; chaves mortas removidas; pt-br 100%

## [1.5.2] - 2026-09-07

### Changed — chat de IA
- **Faixa do chat invertida e melhorada**: o NOME DO MODELO vem primeiro
  (negrito, cor primária) e o logo do provedor vem depois; a faixa rola
  na horizontal (sem barra visível) quando o nome é longo — as pílulas
  de suporte (texto/imagem/vídeo/agentes) nunca mais ficam escondidas
- **Logos reais dos provedores** (16 marcas): OpenAI, Google Gemini,
  Anthropic, DuckDuckGo, Hugging Face, Cloudflare, NVIDIA, Perplexity,
  OpenRouter, GitHub Models, Mistral, DeepSeek, Z.ai, Groq, Azure OpenAI
  (multicoloridos preservados) — na faixa do chat e nos cartões da página
  de Provedores; marcas monocromáticas seguem a cor do tema

### Fixed — compositor e chat
- **Pílulas "Pensar" e "Buscar" agora desligam de verdade**: as chaves
  `aiShowThinking`/`aiWebTools` não existiam nos defaults do settings e
  `settings.update()` descartava silenciosamente chaves desconhecidas —
  o estado voltava a "ativo" e o agente ignorava o toggle; o checkbox
  "Busca na web" da página de IA também não tinha handler e agora persiste
- **Copiar mensagem volta a funcionar** (falhava sobretudo em mensagens
  da IA): nova cascata `writeClipboard` — plugin nativo cordova-clipboard →
  Clipboard API → fallback `execCommand` com textarea oculta (a Clipboard
  API do WebView rejeita com NotAllowedError em vários aparelhos)

### Fixed — editor
- Botões ←/→ do histórico de abas: continuam visíveis quando "mortos"
  (esmaecidos em vez de `disabled` com `pointer-events:none`) e um toque
  neles mostra toast "Sem mais abas atrás/adiante no histórico" — os
  atalhos Alt-←/Alt-→ também dão feedback

### Changed — erros de IA/provedores traduzidos
- `explainError` + `friendlyError` agora passam por `window.strings` com
  placeholders `{name}`/`{model}`/`{provider}`/`{status}` interpolados
  (antes o utilizador via "{name}" literal em strings pt e texto cru em
  inglês nos casos sem tradução)
- Novas branches localizadas: rede sem conexão, pedido cancelado, erro
  genérico do provedor, "No API key configured", máximo de passos, erros
  de ferramentas/subagentes e o diálogo de permissão do agente
- `PROVIDER_NAMES` completo (16 provedores faltantes; "gemini" → "google")
- Toast de modelos usa `explainError` (erros HTTP explicados em pt)

### Fixed — terminal (Alpine de volta sem desinstalar)
- **Auto-cura do modo FailSafe**: o servidor AXS guarda um marcador de
  modo (`axs-mode`); se estiver a correr em modo diferente do ajuste atual
  (ex.: shell Android de uma sessão antiga com FailSafe ligado), o terminal
  reinicia-o — o Alpine proot volta sem "Uninstall"
- Banner no terminal quando o modo FailSafe está ativo, explicando porquê
  e como desligar
- Extração do rootfs verificada (`bin/busybox`): falha do `tar` não mente
  mais com marcador `.extracted` saudável — o erro manda reinstalar

### Added
- **Guia de indentação ativa** (roadmap v1.5.x item 2, opt-in em
  Configurações › Editor › Guias): destaca as guias do bloco que contém a
  linha atual, estilo VSCode — varredura limitada de ancestrais, linhas
  em branco resolvidas, indentações desalinhadas ignoradas
- **Anúncio automático de release** (item 4): workflow `release-announce`
  publica o anúncio no fórum do site quando uma release estável sai
  (`/api/announcements/release` no site, segredo partilhado + conta bot,
  idempotente por versão; pre-releases não anunciam)

### Tests
- +29 testes (553 → 582): `v152QuickFixes` (21 — faixa, logos, clipboard,
  toggles, botões do histórico, erros localizados, cura do terminal) e
  `activeIndentGuide` (8 — algoritmo puro de blocos ancestrais)
- Validado com o harness de boot em bundle de produção (10/10 apps)

### Site (xcoder-web)
- **Perfil com sessão corrigido**: `useDashUser` subscreve
  `onAuthStateChange` — entrar pela própria página /user (ou noutro separa-
  dor) agora atualiza o gate; logout também limpa
- **Site 100% bilíngue na última milha** (item 1): /user/*, submissão de
  plugins, tópico do fórum, corpo dos posts do blog e das docs (variantes
  EN em content/{docs,blog}/en/, troca no cliente com SSG)

## [1.5.1] - 2026-09-07

### Fixed
- **Boot crash "Sidebar is not defined" — o app inteiro morria ao iniciar**
  (v1.4.19 → v1.5.0). Causa raiz: `src/sidebarApps/ai/index.js` usava
  `Sidebar.on("show", ...)` no `initApp` SEM o import top-level de
  `components/sidebar`; o identificador livre só explodia em RUNTIME, quando
  `loadApps()` registrava o 4º app (ai) — tsc não pega (checkJs:false) e o
  biome não tem regra de variável não-declarada. A rejeição abortava TODA a
  cadeia depois de `await sidebarApps.loadApps()` no main.js: apps git/
  website/notificações/conta/configurações/sobre nunca registravam (sidebar
  só com pasta+busca+plugins), `editorManager.onupdate` ficava sem ligar
  (header sem lápis/terminal/paleta/arquivos abertos), quicktools invisíveis,
  terminal morto, pastas/arquivos nunca restaurados e sem aba de boas-vindas
- **Blindagem do boot**: `loadApps()` agora isola o registro de cada app
  (try/catch por app) — um app quebrado é logado + toast e o boot continua;
  nunca mais um único módulo ruim congela o editor inteiro
- **Guard no `themes.apply()`**: tema salvo que pertence a plugin ainda não
  registrado (ou desinstalado) não gera mais rejeição flutuante
  "reading 'primaryColor'" a cada boot; `add()` reaplica quando registrar

### Tests
- +12 testes (541 → 553): `sidebarAppImports` — varredura source-level que
  garante que TODO uso do identificador livre `Sidebar` tem import válido
  (top-level ou local antes do uso), avaliação ao vivo dos 10 descritores de
  apps do sidebar e guard estrutural do try/catch por app no `loadApps()`
- Validado end-to-end com harness de boot (bundle de produção em DOM
  simulado com cordova/memfs stubados): 10/10 apps registrados, aba de
  boas-vindas aberta, "Started app and its services" no log


## [1.5.0] - 2026-09-06

### Added
- V1.4.24 — sidebar globals (fix 'sidebar is not defined') + persistent tab history

### Fixed
- Expose window.sidebar / $sidebar / sidebarApps — user code no longer throws 'sidebar is not defined'


## [1.4.24] - 2026-09-07

### Fixed
- **"sidebar is not defined"** — o elemento da sidebar era uma const local
  dentro do main.js, então qualquer código de usuário (console no contexto
  da página, plugins, scripts) que referenciasse `sidebar` ou `$sidebar`
  explodia com ReferenceError. Agora o app expõe `window.sidebar` (API
  estática: show/hide/toggle/on/off/el), `window.$sidebar` (elemento vivo)
  e `window.sidebarApps` — mesma convenção do `editorManager`

### Added
- **Histórico de abas persistente** (roadmap v1.5.x item 3) — a navegação
  voltar/avançar sobrevive ao reinício do app: o `saveState` grava o
  histórico como ids em `localStorage.tabHistory` e o boot o restaura
  ANTES do primeiro save-state; ids cujos arquivos não existem mais são
  ignorados e o cursor recai no registro mais recente sobrevivente

### Tests
- +12 testes (529 → 541): sidebarGlobalApi (5) e tabHistoryPersist (7)


## [1.4.23] - 2026-09-06

### Fixed
- Typos step — exclude generated icon/registry files and pt-br content, whitelist legitimate Portuguese words

### Documentation
- V1.5.x item 5 done — preview build mirrored in xcoder-web; CodeQL gated while private; renumber v1.6+ list


## [1.4.22] - 2026-09-06

### Added
- **`acode` CLI in the terminal** 💡 (Acode v1.11.8 parity): `acode open <file>` (and `acode <file>`, `acode --version`, `acode --help`) opens files/folders in the editor through the same OSC 7777 bridge the `xcoder` CLI uses. Both scripts now ship as version v2 with a version marker, so installs that already extracted the old CLI are upgraded automatically on the next terminal start. Covered by functional tests that extract the shipped heredocs and run them with real bash
- **Tab history navigation** 💡 (Acode v1.12.7 parity): browser-style back/forward through recently used tabs — new header buttons (`arrow_back`/`arrow_forward`, disabled at both ends of the history) and default shortcuts `Alt-←`/`Alt-→`. The keybindings back-fill in `commandRegistry.js` now adopts a newly shipped default when the stored binding still has `key: null`, so existing installs get the new shortcuts without resetting their customizations
- **Preview build on demand** (preview-build.yml): labeling a pull request `build` triggers a debug-APK build (unsigned, installable for testing) uploaded as a run artifact, with a sticky bilingual comment on the PR; rebuilds automatically on new pushes while the label is on, concurrency-canceled per PR

### Improved
- **Indent guides are now ON by default** (VSCode-style, roadmap item 💡 Acode v1.11.5); the configurable scroll-past-end already existed — no code change needed there
- **Website fully bilingual pt/en** (xcoder-web): every internal page converted to the dictionary i18n — download, sponsor (+checkout), marketplace, about, changelog, blog, docs index, forum, chat, stats, setup wizard, user, admin and 404; data-fetching pages keep their server components and render through new client view components. 348 translated strings, zero keys missing
- Terminal CLI open/close toasts are now translated ("Pasta aberta: …" / "Falha ao abrir: …") instead of hardcoded English

### Fixed
- Flaky `supportAndProfile` test: the heavy `pages/profile/profile` import chain could exceed the 5s default timeout when 65+ test files run in parallel — the import is hoisted to file level (mocks still apply) and the first render got an explicit 20s timeout (Vitest 4 signature)

## [1.4.21] - 2026-09-06

### Fixed
- Plugins sidebar could not scroll: the JS-injected max-height fought the flexbox layout and the infinite-scroll handler crashed on every scroll event — pure flexbox now, handler fixed, search results scroll inside the panel
- "Continuar com Google/GitHub" appeared even with the providers off: the app now defaults to HIDE when the project settings are unreachable, renders the buttons only after the check (no flash) and shows the real Google/GitHub brand marks
- Pollinations hardening on top of the gen-API migration: a stale/expired key that still answers "403: invalid API key requested" is ignored automatically (anonymous retry) and the error explains how to remove/renew it
- Native cookie-jar crashes ("cannot read properties of null (reading 'hostOnly')"): the advanced-http cookie store is now null-safe and the AI client self-heals (clearCookies + retry); duck.ai keeps its new protocol headers

### Added
- Quick pills in the chat composer: "Pensar" (reasoning display) and "Buscar" (web search) — persisted settings; web search also unlocks web_search/read_url in chat mode (toolToggle.js, shared rule with the agent)
- While the model thinks, the chat shows only "Pensando..." — the full reasoning stays collapsed in "Processo de pensamento" after the answer
- Provider logos: the chat strip shows the brand glyph + selected model (name in the tooltip); logos in the model picker too; custom providers use 🤖
- Auto-scroll to the latest message whenever the chat is opened (robust double-rAF + sidebar "show" hook)

### Improved
- i18n: LSP install/update notifications and toasts translated, plugins panel dialogs translated, plus all new chat strings (pt-br 100%)
- Release automation: auto-release.yml tags and publishes the signed release when a push to main bumps the version; self-contained weekly deps bot (deps-update.yml) independent of Dependabot settings; auto-merge extended to Dependabot/deps-bot PRs

## [1.4.20] - 2026-09-06

### Fixed
- **Account icon (3rd report — root cause found):** `pages/profile/profile.js` called `$page.show()`, a method that does not exist on WCPage, so the account page threw a TypeError on every tap and never opened. Pages become visible via `app.append()` (About/Plugins pattern) — plus a happy-dom regression test that renders the real page so this can never silently break again
- **"Apoie o projeto" did nothing:** every failure inside the support dialog was swallowed (`.catch(() => {})`). The support surface is now a proper FULL PAGE (`pages/support`) — no modal — and `openSupportPage()` logs + toasts any failure visibly. The support page shows the FULL PayPal e-mail (no masking) and re-renders after sign in/sign up/redeem
- proot terminal: `can't sanitize binding "/proc/self/fd/{0,1,2}"` warnings during install — stdio bindings are now only added when the fds resolve to a real path (pipes skip them; the guest still reaches fds through the bound /proc and /dev)
- DuckDuckGo AI 503 (x-vqd-4 missing): the adapter now speaks the current duck.ai protocol — `x-vqd-hash-1` + `x-fe-signals` + `x-fe-version` headers, browser client-hints and the essential cookies (`5`, `dcm`, `dcs`), accepting the session from either `x-vqd-4` or `x-vqd-hash-1`; clearer 418/429 messages
- legacy `keyboardEvent.js` TDZ crash on environments where `initKeyboardEvent` is absent

### Changed
- Chat composer redesigned (Claude/DeepSeek style): the textarea gets the FULL width and attach/send buttons sit on a separate fixed row BELOW it — more typing space, no reflow when attachments appear
- User messages now have an avatar (mirrored person icon); assistant messages keep the bot avatar
- Long-press (or right-click) any chat message for actions: Copiar, Regenerar, Detalhar, Resumir, Continuar and Inserir no editor (assistant messages get all; user messages get copy/insert). Regenerate rewinds the conversation to the source question and runs it again
- Dev menu: version-number tap requirement reduced from 7 to 2 taps (1.5 s window)
- GitHub settings page: sign in/logout buttons are now compact pills instead of full-width bars
- vitest now transforms JSX modules through the production html-tag-js loader (tests can render real pages/dialogs)

### Docs
- `readme.pt-br.md` → **README.md** (Portuguese is the standard), English version → `README.en.md`, `license.txt` → **LICENSE**; both READMEs rewritten to the current reality (keyless AI, image generation, chat actions, embedded website, plugins marketplace, free-for-all features)
- New `ROADMAP.md` (Acode upstream sweep: split panes, SSH terminal, REPL, `acode` CLI, font manager, rewarded ads…)
- Illustrative UI mockups added to `docs/screenshots/` (editor-ai, terminal, chat-ia)
- CI now runs `lang:check` (pt-br 100%) and spell check (typos)

### Site (xcoder-web)
- Sponsor tiers lowered: Apoiador 2 USD/mês, Patrocinador 5 USD/mês, Parceiro 10 USD/mês
- Language menu (🌐) on the site header: pt-BR is the original; other languages fall back to instant Google Translate — exactly as requested (fallback for languages the site does not ship)

## [1.4.19] - 2026-09-05

### Added
- Proper Support PAGE (no more modal): premium status, payment methods from the project database (URL/account/QR), sponsor link and the unlock code live in a real page reachable from Settings, Profile, and the agent daily-limit notice
- Account creation is now fully independent: sign in/sign up (e-mail + Google/GitHub OAuth) live exclusively in the Profile page — the support page links to it instead of embedding login forms
- User avatars in the AI chat: user messages show a person avatar (right side) and the assistant keeps its accent bot avatar (left) — Claude/DeepSeek-style
- Marketplace submissions carry the login token (site): the author's e-mail is attached via `Authorization: Bearer`, CORS now allows it, and /user/plugins gained an EDIT form (version/contact/description) for pending submissions

### Changed
- AI chat composer redesigned (Claude/DeepSeek/GPT-inspired): the message field is a rounded card with the send button IN FRONT of it (bottom-right inside), attach (+) and the Chat/Agent switch moved BELOW the field, header/provider/artifacts stay ABOVE
- GitHub settings page now follows the app theme strictly: flat card surface + status chips blended with the theme text color (readable on all 30 themes, light included)
- Built-in AI (Pollinations) migrated to the new gen.pollinations.ai API: keyed requests go straight to the new API (the legacy text API answers 402 "deprecated" to authenticated users), keyless requests stay on the legacy endpoint and AUTOMATICALLY fall back to the new API (non-streaming, single-delta) when it returns 402/404/deprecation — the "AI request failed: 500 402 Payment required" error is gone; fail-fast skips useless retries on deprecation
- 402/deprecation errors now explain the migration in plain pt-br instead of "saldo insuficiente"

### Fixed
- Sidebar icons can no longer die silently: `pulseApp` wraps launch/pulse/activate in a guard that logs and toasts on any synchronous error ("Ícone de conta não funciona")
- Profile page render is fully guarded: a synchronous error inside the page body shows a visible toast instead of a blank screen
## [1.4.18] - 2026-09-05

### Added
- DuckDuckGo AI (experimental, keyless): GPT-4o-mini, Claude Haiku, Llama 3.3 70B and Mistral via duck.ai — dedicated adapter with x-vqd-4 handshake, system-prompt merging and one free retry; auto-fallback to the plain request path (no streaming)
- AI image generation in chat: `/image <descrição>` uses the keyless Pollinations image API (verified live), saves the JPG next to the active file (or workspace root) and posts an inline preview bubble; accepts size hints (`768x512`, `w=`/`h=`) and `--turbo`
- Embedded website: new "Website" sidebar app (globe icon) — an in-app webview of the official site with back/reload/open-in-browser; docs, marketplace, sponsor and account stay inside the app
- 9 new marketplace plugins (inspired by open-source Acode plugins, rewritten for the Xcoder API): Toggle Comment (language-aware, Ctrl-/), JSON Tools (pretty/minify/escape/validate), UUID Generator, Emoji Picker, Color Insert (hex/rgb/hsl), Markdown TOC, Indent Switch, Remove Duplicates, Hash Generator (SHA-1/256/384/512) — marketplace and offline bundle now hold 16 plugins

### Changed
- Premium is now ONLY about ads and AI limits: every theme is free (neon/sunset/obsidian included) and every feature is unlocked; Premium still removes ads and raises the AI caps (25 agent runs/day → unlimited, 4096 → 8192 tokens, autonomy "auto")
- Support dialog copy updated accordingly (pt-br first)

## [1.4.17] - 2026-09-05

### Added
- Full Acode CHANGELOG sweep (all 43 versions) — the only missing improvement was PR 2258: CodeMirror's Android EditContext input path now stays OFF by default (`useEditContext: false`), fixing scroll jumps when tapping empty lines; opt-in setting + live recreation included

### Fixed
- Account icon felt dead: the Profile launcher chain now imports the page chunk directly and any failure shows a visible toast + log entry ("Ícone de conta não funciona")

### Improved
- Built-in AI (Pollinations) hardening: automatic retry with backoff on 429/5xx for keyless requests, `referrer` etiquette field, and an actionable 429 message that points to free Groq/Cerebras keys for better quality
- Stale package-lock version aligned with package.json

## [1.4.16] - 2026-09-05

### Added
- /sponsor links, provider-gated OAuth sign-in, Acode ports (v1.4.16)

## [1.4.15] - 2026-09-05

### Added
- OAuth (Google/GitHub), profile page, skills system, AI polish, v1.4.14
- Token/autonomy gates + e-mail grant lookup
- Per-provider model picker, SweetAlert2, mandatory notifications, word-wrap everywhere

### Fixed
- V1.4.14 baseline, Built-in providers, PayPal e-mail, Dependabot daily

### Maintenance
- Config.xml author = Carsai Mozambique (carsaimz stays the GitHub handle)
- Updating the version


## [1.4.14] - 2026-09-03

### Added
- Live streaming, markdown answers, parallel subagents, UX fixes
- Payment methods from the database, Supabase account + cloud premium sync

## [1.4.13] - 2026-09-03

### Added
- Keyless AI (Pollinations default), premium/support system, ads decision, GitHub hero, hardened 401 diagnostics, site links, icon updates

### Fixed
- Base32 alphabet had 31 chars — index 31 resolved to undefined inside codes


## [1.4.12] - 2026-09-03

### Added
- Site notifications, house ads, Supabase hooks, Firebase -> analytics+crashlytics
- Dedicated GitHub settings — account, token, repositories, branch

### Fixed
- Purge old icon leftovers — orphan about wordmark, fastlane icon, preview favicon
- Native JSON serializer (400/401 root cause), strict connection test, key-shape diagnostics, artifacts panel, attachments


## [1.4.11] - 2026-09-03

### Added
- Provider enable/disable, per-provider models with type labels, capability strip, self-reading agent


## [1.4.10] - 2026-09-02

### Fixed
- Single menu icons, on-screen context menus, tappable info buttons, no row chevrons


## [1.4.9] - 2026-09-02

### Fixed
- Native Firebase off by default — v1.4.8 failed to boot on devices


## [1.4.8] - 2026-09-02

### Added
- New artwork icon + logo, drop backup UI, roll back to v1.4.7
- Native Firebase wired, icon pack tier 3, changelog fix

### Fixed
- Resolve google-services plugin via cordova-android 15 native flag
- Sidebar tap reliability, wider panels, header terminal/palette, icon glyph aliases, AI/git scroll, icon-lib autocomplete


## [1.4.7] - 2026-09-02

### Added
- Settings navigation joins the SVG pack (Lucide tier 2)
- Backfill 1.4.0-1.4.6, auto-update on release, site API source
- Provider page refinements — search, footer actions, docs link, key/test states
- Bundled SVG icon pack on the sidebar rail + official site URL
- Provider cards page, chat header/footer rework, site APIs, Firebase cleanup

## [Unreleased]

### Added
- **Provider management page**: one flexible card per AI provider — status chip (Connected/Offline/Testing), per-provider API key, base URL, max tokens slider (256–8192) and autonomy level (Baixa/Média/Alta), connection test with spinner and a link to get the API key; searchable list.
- **AI chat quick header**: compact 24dp actions (model picker, new chat, history, settings) and a footer switch to toggle between **Chat** and **Agente** modes.
- **Site integration**: the app now consumes the community site APIs (`/api/config`, `/api/feedback`) with anonymous `X-Device-ID` headers; the official site URL is `https://xcoderapp.vercel.app`.
- **SVG icon pack**: Lucide-style vector icons on the sidebar rail, sharper at any density and independent of the icon font.
- **Native Firebase**: `google-services.json` (project `carsai-mozambique-d5983`, app `com.carsaimz.xcoder`) ships with the repository — Analytics, Crashlytics, Remote Config and FCM initialize automatically in release builds; F-Droid flavours and self-hosters without the file build without any Firebase dependency.
- **Icon pack tier 3**: the main editor menu, file menu and About page now render Lucide SVG vectors via a runtime icon enhancer (22 new glyphs; pack grown to 54 icons).

### Changed
- **Firebase minimized**: only Analytics, Crashlytics, Remote Config and FCM remain; the in-app Backup/Backend UI was removed and preferences moved to SharedPreferences/DataStore.

### Fixed
- **Changelog generator**: re-running `update-changelog.mjs` for the same version no longer inserts a duplicate section — the existing section is replaced (Keep a Changelog format preserved).

## [1.4.6] - 2026-09-02

### Added
- **Community wiki sources**: 15 PT-BR pages (installation, first steps, interface, shortcuts, AI, Git, themes, plugins, build, FAQ, contributing…) ready to publish on GitHub.
- **Documentation hub** linking the site, wiki and repositories.

## [1.4.5] - 2026-09-02

### Added
- **Command palette polish**: fuzzy search (subsequence matching with word-boundary bonuses) and 117 localized command names in pt-br.
- **About page credits**: section thanking open-source libraries, contributors and the community.
- **Hidden developer menu**: 7 taps on the version number open dev actions (clear cache, restart, devtools, copy build info, console).

### Fixed
- **Startup crash** `Cannot read properties of undefined (reading 'bind')` — the Cordova bridge is now resolved lazily; plugins fail gracefully instead of breaking the boot.

### Improved
- Motion and feedback: material ripple on taps, page transition animations and optional haptics (all respecting `prefers-reduced-motion`).

## [1.4.4] - 2026-09-01

### Changed
- Release/maintenance sync — no app changes in this cycle.

## [1.4.3] - 2026-09-01

### Added
- **Settings control kit** shared by every settings screen: 30%/70% label-control grid, touchable "?" info buttons, segmented autonomy control (Baixo/Médio/Alto), primary full-width buttons with spinner, and slider + numeric input controls.
- **Provider badges**: Grátis / Free tier / Premium chips on the provider row and chat header (replacing the truncated "Free — …" text).

### Fixed
- AI and Git panels returned to the sidebar apps (no longer opened as editor tabs), with external calls re-opening and focusing them properly.

## [1.4.2] - 2026-09-01

### Added
- **Own plugin marketplace**: remote registry (`carsaimz/xcoder-plugins`) with jsDelivr → raw fallback, stale-while-revalidate caching, custom marketplace URLs in settings and 7 built-in plugins (word-count, case-toggle, sort-lines, insert-date, lorem-ipsum, base64-tool, line-tools).
- Installing by plugin id now resolves through the registry with dependency support and automatic fallback source retry.

## [1.4.1] - 2026-09-01

### Added
- 6 new editor themes.

### Changed
- **New Xcoder brand**: icon with the X layered over the < > chevrons everywhere (app, header, about).
- Xcoder panel design refresh across settings screens.

### Fixed
- Language switch now applies instantly (no reload needed).
- Changelog loading failed on fresh installs.

## [1.4.0] - 2026-09-01

### Added
- **AI chat & Git as editor tabs** with tab renaming and quick tools.
- **GitHub device-flow sign-in**: sign in from the app (also works on devices without a browser handshake), enabling Git operations over HTTPS.
- Manual update check on the About page; Portuguese-first language detection on first run.

### Fixed
- axs and proot downloads now point to the real upstream repositories.

### Changed
- Completed all 30 locale files and polished pt-br; replaced Dependabot with Renovate and added Stale + CodeRabbit configs.
- CI/security: CodeQL, Dependency Review and OSSF Scorecard workflows; bilingual EN/PT-BR README with badges.

## [1.3.0] - 2026-09-01

### Added
- **AI code actions on selection**: from the file tab menu or main menu, run *AI: explain / fix / refactor / add comments / ask about selection* on the current selection (or whole file). Fix/refactor/comments route through the full agent, so it can actually patch the file with its editing tools under the configured permission mode.
- **Code block actions in the AI chat**: tap any code block returned by the model to *copy*, *insert at cursor*, *replace selection* or *save it to a workspace file*.
- **`open <file>` command in the virtual shell** (also available to the agent): opens a workspace file directly in the editor.
- **AI chat command**: open the assistant instantly via the main menu (`ai-chat`).

### Improved
- AI selection prompts now carry the file name, start line and a truncation notice, giving the model precise context.
- Sidebar registry exposes `setActiveApp`, letting commands jump straight to the AI section.
- 16 new localized strings across all 40+ locales (full parity, pt-br translated).

## [1.0.0] - 2026-08-31

### Highlights
- **XCoder 1.0** — a fast, offline-first code editor and web IDE for Android.
- Built-in **AI assistant** with agents & subagents: read/create/delete files, analyze and patch code, run JavaScript in an isolated worker, run shell commands (terminal/proot when available), and perform Git operations.
- **AI provider manager** with three preset groups: free providers, paid providers with a free tier, and premium paid providers. Any OpenAI-compatible endpoint (custom base URL + key + model) is supported.
- 100% offline core: editor, file system, terminal (proot/Alpine), LSP, themes — no account, no ads, no telemetry.

### Editor
- CodeMirror 6 core with 100+ language modes, LSP integration (TypeScript, Python, HTML/CSS/JSON, Tailwind and more), autocompletion, code folding, multi-selection and quick tools.
- Themes: One Dark, Dracula, GitHub Dark/Light, Nord, Ayu, Catppuccin, Gruvbox, Tokyo Night, Solarized, VS Code Dark and many more — all unlocked.

### Files & terminal
- Local storage, SD card, SFTP and FTP backends; multi-root workspaces.
- Real Linux terminal via proot (Alpine) and background executors.
- Local live-server preview (HTML/CSS/JS) and in-app console.

### Removed (compared to upstream base)
- Ad framework (AdMob), ad-reward system and consent flows.
- In-app purchases, PRO gating and paid locks.
- Account login and cloud auth.
- Remote plugin marketplace (server-dependent): install plugins from a local `.zip` file or a direct URL instead.
- Remote font downloads and promotion/sponsor feeds.

### Misc
- Multi-language UI (40+ locales).
- Backup & restore of settings and files, fully local.
