<div align="center">

# XCoder

**Editor de código e IDE mobile-first para Android — com motor CodeMirror 6 e extensível por plugins.**

*Projeto original · arquitetura e API próprias (`xcoder.*`)*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Engine](https://img.shields.io/badge/editor-CodeMirror%206-7c5cff)](https://codemirror.net/)
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20Web-3fb950)](./docs/build.md)
[![Build](https://img.shields.io/badge/bundler-Rspack%202-0969da)](https://rspack.dev/)
[![Tests](https://img.shields.io/badge/tests-Vitest%204-success)](./tests)
[![Locales](https://img.shields.io/badge/locales-43%20estruturados-f0883e)](./docs/i18n.md)

[Funcionalidades](#-funcionalidades) · [Início rápido](#-início-rápido) · [Arquitetura](#-arquitetura) · [Plugins](#-plugins) · [Documentação](#-documentação) · [Roteiro](#-roteiro)

**🇬🇧 [English README](./README.md)**

</div>

---

## Porquê o XCoder?

Edite código a sério no telemóvel: um editor com a experiência do VS Code, uma
camada de sistema de ficheiros real (armazenamento do dispositivo, do browser
e WebDAV), um terminal integrado com shell virtual, inteligência via LSP e um
sistema de plugins desenhado para toda a experiência — não colado à pressa.

O XCoder foi escrito de raiz para Android, com uma API independente e
totalmente documentada, para que os plugins se mantenham limpos e evoluam
sem constraints de legado.

## ✨ Funcionalidades

**Editor** — motor CodeMirror 6
Realce de sintaxe para **23 linguagens** (21 pacotes `@codemirror/lang-*` +
variantes TypeScript/SCSS) · multi-cursor · pesquisa e substituição com regex ·
dobramento de código · bracket matching e auto-close · snippets · paleta de
comandos fuzzy · abertura rápida (`Ctrl+P`).

**Ficheiros** — abstração por URL (`esquema://caminho`)
Armazenamento do dispositivo via Cordova · armazenamento do browser
(IndexedDB) · remoto **WebDAV** · FS em memória · workspaces multi-raiz
(`.xcoder-workspace`) · pesquisa recursiva por nome e conteúdo · interfaces
SFTP/FTP definidas (ponte nativa no roteiro).

**Terminal** — xterm.js + shell virtual (xsh)
Shell de estilo POSIX sobre a abstração de FS: `ls cd cat echo mkdir touch rm
mv cp grep wc head find open …` · **git** com estado real
(init/add/commit/log/branch/checkout/diff) · **npm** mock ligado ao
`package.json` · catálogo **apk** · `node -e` · histórico, conclusão por Tab ·
gestor de userland Proot/Alpine para Android (Linux real, sem root).

**LSP** — cliente do Language Server Protocol
JSON-RPC 2.0 sobre WebSocket ou Web Worker · completion, hover, definição,
referências, diagnósticos · servidores por linguagem configurados nas
definições · pontes CodeMirror para autocomplete, tooltips e squiggles.

**Plugins** — anfitrião de extensões de primeira classe
`xcoder.setPluginInit(id, init)` / `xcoder.setPluginUnmount(id, unmount)` ·
página UI por plugin (`$page`) · cache persistente por plugin · instalação por
ZIP ou diretório · envie comandos, temas, linguagens, backends de FS, comandos
de shell e servidores LSP.

**E ainda** — 3 temas (Dark+ / Light / Solarized) · estrutura i18n com 43
locales (pt/en/es completos) · gaveta de definições · restauro de sessão ·
auto-save · UI responsiva para telemóvel.

## 🚀 Início rápido

### Correr no browser (sem Android)

```bash
git clone https://github.com/xcoder-app/xcoder.git
cd xcoder
pnpm install
pnpm run build:dev
npx serve www            # → http://localhost:3000
```

Recebe o IDE completo: abrir ficheiros, editar, `Ctrl+S`, `` Ctrl+` `` para o
terminal, `Ctrl+Shift+P` para comandos.

### Compilar para Android

```bash
cordova platform add android
pnpm run build:prod
cordova build android
# → platforms/android/app/build/outputs/apk/debug/app-debug.apk
```

Pré-requisitos completos, assinatura de release e resolução de problemas:
**[docs/build.md](./docs/build.md)**.

## 🏗 Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                  Aplicação XCoder                           │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Camada UI   │  Núcleo do   │  Terminal    │  Cliente LSP   │
│  (HTML/CSS,  │  editor      │  (xterm.js + │  (JSON-RPC 2.0 │
│  componentes)│  (CM 6)      │   shell xsh) │   WS / Worker) │
├──────────────┴──────────────┴──────────────┴────────────────┤
│              API pública — window.xcoder                    │
│     require() · setPluginInit() · setPluginUnmount()        │
├──────────────┬──────────────┬───────────────────────────────┤
│  Sistema de  │  Comandos    │  Eventos · Definições · Cache │
│  plugins     │              │                               │
├──────────────┴──────────────┴───────────────────────────────┤
│    Abstração do sistema de ficheiros (registo de motores)   │
│   memory:// · browser:// · file:// · webdav://  (+sftp/ftp) │
├─────────────────────────────────────────────────────────────┤
│             Camada de ponte Apache Cordova                  │
└─────────────────────────────────────────────────────────────┘
```

Regras das camadas: tudo acima da abstração de FS fala em **URLs de
ficheiros**, nunca em `cordova.*`; a superfície pública é apenas o que as
fachadas `src/api/` exportam; o núcleo nunca importa UI. Análise profunda:
**[docs/architecture.md](./docs/architecture.md)** (EN).

**Stack**: TypeScript 5.9 (estrito) · Rspack 2 (loader SWC) · CodeMirror 6 +
Lezer · xterm.js 6 · Cordova 13 · Vitest 4 · Biome.

## 🔌 Plugins

```js
// main.js — script clássico, sem bundler
function init(baseUrl, $page, cache) {
  const commands = xcoder.require('commands');
  const editorManager = xcoder.require('editorManager');
  const toast = xcoder.require('toast');

  commands.addCommand({
    name: 'meu-plugin.wordcount',
    description: 'Conta palavras do ficheiro ativo',
    bindKey: { win: 'Ctrl-Alt-W', mac: 'Command-Alt-W' },
    exec: () => {
      const ed = editorManager.activeEditor;
      if (!ed) return toast.warning('Nenhum ficheiro aberto');
      const words = (ed.view.state.doc.toString().match(/\S+/g) || []).length;
      $page.innerHTML = `<h2>${ed.title}</h2><p>Palavras: <b>${words}</b></p>`;
      $page.show();
    }
  });
}

function unmount() {
  xcoder.require('commands').removeCommand('meu-plugin.wordcount');
}

xcoder.setPluginInit('meu-plugin', init);
xcoder.setPluginUnmount('meu-plugin', unmount);
```

Crie, empacote e valide com:

```bash
pnpm run plugin -- new "Meu Plugin"
pnpm run plugin -- pack ./meu-plugin
```

Guia: **[docs/plugin-development.md](./docs/plugin-development.md)** (EN) ·
referência: **[docs/api-reference.md](./docs/api-reference.md)** (EN) ·
tipagem: [`src/types/xcoder.d.ts`](./src/types/xcoder.d.ts) ·
[glossário PT](./docs/glossary.pt.md).

## 🧪 Desenvolvimento

```bash
pnpm run typecheck     # tsc estrito
pnpm run test          # 34 testes vitest (shell, git mock, comandos, i18n…)
pnpm run lint          # biome
pnpm run lang -- stats # cobertura de traduções
```

Guia de contribuição: **[CONTRIBUTING.md](./CONTRIBUTING.md)** (EN).

## 🗺 Roteiro

- [x] Editor core, backends de FS, shell virtual, mocks git/npm/apk
- [x] Anfitrião de plugins + template + CLI
- [x] Cliente LSP (completion, hover, definição, referências, diagnósticos)
- [x] Estrutura i18n (43 locales)
- [ ] Backends SFTP/FTP (ponte nativa de sockets)
- [ ] Userland Proot real no Android (`cordova-plugin-xcoder-proot`)
- [ ] Painéis de editor divididos (split)
- [ ] Navegador de marketplace de plugins na app
- [ ] Agentes de IA via terminal (Claude Code / Codex / OpenCode)

## 📚 Documentação

| Documento | Conteúdo |
|---|---|
| [docs/architecture.md](./docs/architecture.md) | Camadas, módulos, arranque, regras de design (EN) |
| [docs/api-reference.md](./docs/api-reference.md) | Todos os módulos `xcoder.require()` + eventos (EN) |
| [docs/plugin-development.md](./docs/plugin-development.md) | Ciclo de vida, manifesto, empacotamento (EN) |
| [docs/build.md](./docs/build.md) | Build, Android, assinatura de releases (EN) |
| [docs/i18n.md](./docs/i18n.md) | Sistema de locales + CLI (EN) |
| [docs/glossary.pt.md](./docs/glossary.pt.md) | **Glossário PT** dos termos técnicos |
| [CHANGELOG.md](./CHANGELOG.md) | Histórico de versões (EN) |

## Licença

[MIT](./LICENSE) — © XCoder Contributors.

Construído sobre os ombros de [CodeMirror 6](https://codemirror.net/),
[xterm.js](https://xtermjs.org/), [Rspack](https://rspack.dev/),
[Vitest](https://vitest.dev/) e [Apache Cordova](https://cordova.apache.org/).
