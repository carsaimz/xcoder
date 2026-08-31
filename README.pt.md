# XCoder

**Um editor de código e IDE mobile-first para web e Android — construído sobre CodeMirror 6.**

O XCoder é um fork comunitário do [Acode](https://github.com/Acode-Foundation/acode),
reescrito em TypeScript estrito com toolchain moderna (Rspack + Vitest) e expandido com um
sistema de agente de IA, um terminal virtual com git e uma plataforma de plugins.

[![CI](https://github.com/carsaimz/xcoder/actions/workflows/ci.yml/badge.svg)](https://github.com/carsaimz/xcoder/actions/workflows/ci.yml)
[![Release](https://github.com/carsaimz/xcoder/actions/workflows/release.yml/badge.svg)](https://github.com/carsaimz/xcoder/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Locales](https://img.shields.io/badge/idiomas-43-green)

---

## ✨ Destaques

- **📝 Editor CodeMirror 6** — mais de 100 linguagens carregadas sob demanda, 3 temas
  (dark / light / ocean), fechamento de chaves, autocomplete, busca e substituição, dobra de código.
- **📁 Espaço de trabalho multi-raiz** — backends plugáveis: armazenamento do navegador
  (IndexedDB), memória, WebDAV e armazenamento do dispositivo via Cordova no Android.
- **⌨️ Terminal virtual** — mais de 25 comandos (`ls`, `cat`, `grep`, `wc`, `cp`…), pipes e
  redirecionamento de saída, `node -e`, `python` (Pyodide), mocks de npm/apk e uma
  **máquina de estados git completa** (init / add / commit / log / diff / branch / checkout /
  merge / remote / push / pull / clone) persistida por repositório.
- **🤖 Agente de IA** — um agente autônomo capaz de ler, escrever e editar seus arquivos,
  executar comandos git e rodar bash/JS/Python localmente. Subagentes (`coder`, `analyzer`,
  `ops`) podem ser acionados para subtarefas focadas. Toda ação perigosa pede permissão.
- **🔌 Traga sua própria IA** — 17 predefinições de provedores em 3 grupos (*gratuitos*,
  *pagos com nível gratuito*, *premium empresariais*) falando os dialetos OpenAI, Anthropic e
  Gemini, além de qualquer endpoint compatível com OpenAI.
- **🧩 Plugins** — instale pacotes `.zip` criados com `npm run gen:plugin`; plugins recebem a
  mesma fachada `xcoder.require()` do núcleo (commands, fs, editor, agents, ai, …).
- **🌍 43 idiomas** — dicionários completos em inglês, português e espanhol, além de stubs
  gerados para mais 40 idiomas (`npm run gen:locales`).
- **⚡ Paleta de comandos & Quick Open** — `Ctrl+K` comandos, `Ctrl+P` busca difusa de arquivos.
- **📐 Formatação sob demanda** — Prettier (carregado sob demanda) para JS/TS/JSON/CSS/HTML/Markdown/YAML.

## 🚀 Início rápido (web)

```bash
git clone https://github.com/carsaimz/xcoder.git
cd xcoder
npm install
npm run dev          # servidor de desenvolvimento em http://localhost:8080
```

Build de produção:

```bash
npm test             # typecheck + 88 testes unitários
npm run build        # gera www/ (bundle.js + chunks sob demanda)
npm run serve        # servidor estático para www/
```

Abra o app e experimente:

| Ação | Como |
| --- | --- |
| Paleta de comandos | `Ctrl+K` ou o botão ⌕ da barra |
| Abrir arquivo rápido | `Ctrl+P` |
| Terminal | botão `>_` da barra, depois `help` |
| Agente de IA | botão do robô (configure um provedor: Definições → Provedores de IA) |
| Formatar documento | comando `editor.format` na paleta |

## 🤖 Agente de IA em 30 segundos

1. **Definições → Provedores de IA → Adicionar provedor** e escolha uma predefinição:
   - *Gratuitos*: Groq, Cerebras, OpenRouter (modelos `:free`), Hugging Face, GitHub Models, Ollama (local)
   - *Pagos com nível gratuito*: OpenAI, Anthropic, Gemini, Mistral, DeepSeek, Together, Cohere
   - *Premium*: Azure OpenAI, AWS Bedrock, Google Vertex, IBM watsonx
2. Cole a **chave de API** (Ollama não precisa) e clique em **Testar ligação**.
3. Abra o painel do **Agente de IA** e descreva uma tarefa:

> *“criar utils/date.ts com um helper formatDate e depois commitar”*

O agente planeja, chama ferramentas (`fs.read`, `fs.write`, `code.edit`, `git.commit`,
`exec.run`…), pede permissão antes de cada escrita e reporta o resultado. O subagente somente
leitura (`analyzer`) e o executor de comandos (`ops`) estão a um toque de distância.

Detalhes completos: [docs/agents.md](docs/agents.md) · Contrato da API: [docs/api-reference.md](docs/api-reference.md)

## 📱 Builds Android (CI)

| Build | Gatilho | Saída |
| --- | --- | --- |
| APK debug | cada push em `main` | [pre-release `dev-build`](https://github.com/carsaimz/xcoder/releases/tag/dev-build) contínuo |
| APK + AAB assinados | tag `v*` (ou *Release* manual) | anexados ao release versionado no GitHub |

A assinatura usa secrets do repositório — veja [docs/build.md](docs/build.md):

| Secret | Descrição |
| --- | --- |
| `KEYSTORE_BASE64` | base64 do arquivo `.keystore` |
| `KEYSTORE_PASSWORD` | senha do keystore |
| `KEY_ALIAS` | alias da chave |
| `KEY_PASSWORD` | senha da chave |

Sem os secrets, o pipeline publica artefatos **não assinados**.

## 🛠 Desenvolvimento

```bash
npm run typecheck    # tsc --noEmit (estrito)
npm test             # vitest run
npm run gen:locales  # regera os stubs de idiomas (43 locales)
npm run gen:plugin   # scaffolding de novo plugin
```

### Conventional commits

O repositório segue [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(agent): add ops subagent
fix(path): keep scheme when resolving absolute fragments
chore(release): v1.2.0
```

O workflow de release agrupa os commits (`feat` → *Features*, `fix` → *Bug fixes*, …) nas
notas de release e mantém o `CHANGELOG.md` atualizado.

## 🤝 Contribuindo

Contribuições são bem-vindas! Veja [CONTRIBUTING.md](CONTRIBUTING.md) — em especial as seções
sobre conventional commits, tradução de idiomas e criação de plugins.

## 📄 Licença

MIT — veja [LICENSE](LICENSE). O XCoder é um fork do
[Acode](https://github.com/Acode-Foundation/acode); o copyright original está preservado no
arquivo de licença.
