# Glossário (PT)

Termos usados na documentação do XCoder e suas traduções/referências em português.

| Termo (EN) | Tradução / equivalente | Descrição |
| --- | --- | --- |
| workspace | espaço de trabalho | Conjunto de raízes montadas no explorador de ficheiros |
| backend (fs) | backend (sistema de ficheiros) | Implementação de `FileSystemBackend` (browser, memória, WebDAV, Cordova) |
| scheme | esquema | Prefixo do URL de um caminho (`file://`, `mem://`, `webdav://`) |
| virtual shell | terminal virtual | Shell emulada que corre sobre o sistema de ficheiros do app |
| git state machine | máquina de estados git | Modelo de repositório (commits, staged, branches) persistido por raiz |
| command palette | paleta de comandos | Pesquisa fuzzy de comandos (`Ctrl+K`) |
| quick open | abertura rápida | Pesquisa fuzzy de ficheiros (`Ctrl+P`) |
| agent | agente | Assistente autónomo com ferramentas (fs, git, exec) |
| subagent | subagente | Agente delegado com conjunto de ferramentas restrito (`coder`, `analyzer`, `ops`) |
| tool call | chamada de ferramenta | Ação pedida pelo modelo ao agente |
| permission prompt | pedido de permissão | Confirmação antes de ações perigosas (escrita, git, exec) |
| provider | provedor | Serviço de IA configurável (Groq, OpenAI, Anthropic, Gemini…) |
| preset | predefinição | Entrada do catálogo de provedores com URL, modelos e grupo |
| free tier | nível gratuito | Utilização sem custos (limitada) de APIs pagas |
| conventional commit | commit convencional | Formato `tipo(escopo): mensagem` que alimenta o changelog |
| release | versão/publicação | Tag `vX.Y.Z` + release no GitHub com APK/AAB |
| pre-release | pré-publicação | Build contínua de desenvolvimento (`dev-build`) com APK debug |
| keystore | keystore | Ficheiro de assinatura Android (fornecido via secrets) |
| AAB | AAB | Android App Bundle (formato de upload para a Play Store) |
| locale | idioma/região | Dicionário de tradução (`pt`, `pt-BR`, `zh-TW`…) |
| plugin | plugin | Pacote zip com `plugin.json` + `main.js` executado contra a fachada `xcoder` |
| facade | fachada | Objeto `xcoder.require('módulo')` exposto a plugins e ao console |
| Pyodide | Pyodide | Runtime Python (WASM) carregado sob demanda para `exec.run` |
| Pyodide lazy load | carregamento tardio | Descarregado apenas na primeira utilização de Python |
