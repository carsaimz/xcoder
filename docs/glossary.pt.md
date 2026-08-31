# Glossário PT — termos técnicos do XCoder

> Documentação técnica em inglês (padrão do repositório). Este glossário
> mapeia os termos usados nas `docs/` para português, para facilitar a
> contribuição de falantes de PT.

| Termo (EN) | Tradução / equivalente PT | Significado no contexto do XCoder |
|---|---|---|
| backend | motor / implementação | Implementação concreta do sistema de ficheiros (`memory`, `browser`, `cordova`, `webdav`) registada por *scheme*. |
| binding (keybinding) | atalho de teclado | Combinação de teclas associada a um comando (`bindKey`). |
| bridge | ponte | Camada Cordova que liga o JavaScript ao Android nativo. |
| bundler | empacotador | Ferramenta que compila os módulos num único ficheiro (Rspack). |
| cache file | ficheiro de cache | JSON persistente dedicado a cada plugin (`cache.cacheFile`). |
| capabilities | capacidades | Conjunto de operações suportadas por um backend ou servidor LSP. |
| command palette | paleta de comandos | Lista pesquisável de comandos (`Ctrl+Shift+P`). |
| compartment | compartimento | Mecanismo do CodeMirror 6 para reconfigurar extensões em runtime. |
| dirty (editor) | modificado / não guardado | Documento com alterações ainda não gravadas. |
| diagnostics | diagnósticos | Erros/avisos publicados por um servidor LSP (`publishDiagnostics`). |
| entry point | ponto de entrada | Ficheiro inicial de execução (`main.ts` do app, `main.js` do plugin). |
| facade | fachada | Módulo `src/api/*` que expõe uma API estável sobre o núcleo. |
| fold (code folding) | dobrar código | Ocultar blocos de código no editor. |
| highlight style | estilo de realce | Cores de sintaxe aplicadas pelas tags Lezer. |
| hook | gancho | Função registada para ser chamada num momento do ciclo de vida (`setPluginInit`). |
| hover | dica flutuante | Informação ao passar/repousar o cursor sobre um símbolo. |
| i18n (internationalization) | internacionalização | Sistema de traduções (`src/lang/*.json`). |
| LSP (Language Server Protocol) | Protocolo de Servidor de Linguagem | Protocolo que liga o editor a servidores de análise de código. |
| manifest | manifesto | Metadados de um plugin (`plugin.json`) ou do app. |
| multi-root workspace | espaço de trabalho multi-raiz | Várias pastas montadas em simultâneo (`.xcoder-workspace`). |
| notification | notificação | Mensagem JSON-RPC sem resposta, ou *toast* de UI. |
| plugin host | anfitrião de plugins | Subsistema que carrega e gere o ciclo de vida dos plugins. |
| prompt | pedido de entrada | Caixa de diálogo com campo de texto. |
| Proot | Proot | Ferramenta que executa um userland Linux (Alpine) sem root no Android. |
| registry | registo | Mapa global de serviços (`xcoder.require`) ou de backends. |
| release | versão / publicação | Build assinada destinada à distribuição. |
| scheme | esquema | Prefixo do URL de ficheiros (`file://`, `browser://`…). |
| session | sessão | Estado de uma ligação LSP, ou conjunto de abas restaurado no arranque. |
| snippet | fragmento de código | Modelo de código expandido pelo autocomplete. |
| split (panel) | painel dividido | Divisão do editor em vistas verticais/horizontais (roteiro futuro). |
| squash | comprimir (commits) | Agregar commits antes de integrar um PR. |
| status bar | barra de estado | Linha inferior com branch, cursor, linguagem e tema. |
| stub | esqueleto / implementação provisória | Módulo com interface pronta mas comportamento mínimo documentado. |
| toast | notificação flutuante | Aviso temporário no canto do ecrã. |
| tree view | vista em árvore | Explorador de ficheiros hierárquico da barra lateral. |
| userland | espaço de utilizador | Ambiente Linux sem privilégios de administrador. |
| webhook / watcher | observador | Mecanismo que reage a alterações no sistema de ficheiros (planeado). |
| workspace | espaço de trabalho | Conjunto de pastas abertas no explorador. |
