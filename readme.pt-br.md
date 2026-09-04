<div align="center">

<!-- TODO: trocar pelo novo ícone do app quando estiver pronto (atualmente res/logo.png) -->
<img src="https://raw.githubusercontent.com/carsaimz/xcoder/main/res/logo.png" alt="Logo do XCoder" width="140"/>

# XCoder

**Editor de código rápido, offline-first e IDE web para Android**

🤖 Agente de IA integrado • 🐧 Terminal Linux real • 🧠 Suporte a LSP • 🚫 Sem anúncios • 🔒 Sem conta

[🇺🇸 English](readme.md) | [🇧🇷 Português (Brasil)](readme.pt-br.md)

### Status de build

[![CI](https://github.com/carsaimz/xcoder/actions/workflows/ci.yml/badge.svg)](https://github.com/carsaimz/xcoder/actions/workflows/ci.yml)
[![Debug APK](https://github.com/carsaimz/xcoder/actions/workflows/debug.yml/badge.svg)](https://github.com/carsaimz/xcoder/actions/workflows/debug.yml)
[![Release](https://github.com/carsaimz/xcoder/actions/workflows/release.yml/badge.svg)](https://github.com/carsaimz/xcoder/actions/workflows/release.yml)
[![CodeQL](https://github.com/carsaimz/xcoder/actions/workflows/codeql.yml/badge.svg)](https://github.com/carsaimz/xcoder/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/carsaimz/xcoder/badge)](https://api.scorecard.dev/projects/github.com/carsaimz/xcoder)

### Repositório

[![Última release](https://img.shields.io/github/v/release/carsaimz/xcoder?include_prereleases&sort=semver&display_name=tag&logo=github)](https://github.com/carsaimz/xcoder/releases)
[![Licença](https://img.shields.io/github/license/carsaimz/xcoder?logo=open-source-initiative)](license.txt)
[![Estrelas](https://img.shields.io/github/stars/carsaimz/xcoder?style=social)](https://github.com/carsaimz/xcoder/stargazers)
[![Forks](https://img.shields.io/github/forks/carsaimz/xcoder?style=social)](https://github.com/carsaimz/xcoder/network/members)
[![Contribuidores](https://img.shields.io/github/contributors/carsaimz/xcoder?logo=people)](https://github.com/carsaimz/xcoder/graphs/contributors)

[![Issues](https://img.shields.io/github/issues/carsaimz/xcoder?logo=github)](https://github.com/carsaimz/xcoder/issues)
[![Pull requests](https://img.shields.io/github/issues-pr/carsaimz/xcoder?logo=github)](https://github.com/carsaimz/xcoder/pulls)
[![Último commit](https://img.shields.io/github/last-commit/carsaimz/xcoder/main?logo=git&logoColor=white)](https://github.com/carsaimz/xcoder/commits/main)
[![Atividade de commits](https://img.shields.io/github/commit-activity/m/carsaimz/xcoder?logo=git&logoColor=white)](https://github.com/carsaimz/xcoder/graphs/commit-activity)
[![Linguagens](https://img.shields.io/github/languages/count/carsaimz/xcoder?logo=codacy)](https://github.com/carsaimz/xcoder/search?l=javascript)
[![Tamanho do repo](https://img.shields.io/github/repo-size/carsaimz/xcoder?logo=databricks)](https://github.com/carsaimz/xcoder)

</div>

---

O XCoder é um editor de código mobile-first para Android focado em privacidade
e uso offline. Ele entrega uma experiência completa de edição — realce de
sintaxe para mais de 100 linguagens, integrações LSP, gerenciamento de arquivos
compatível com Git, um terminal Alpine Linux (proot) e um servidor local de
pré-visualização — **sem** exigir conta, exibir anúncios ou enviar telemetria.

## ✨ Destaques

- 🤖 **Assistente de IA com agentes e subagentes** — traga sua própria chave. O
  agente pode ler e analisar seu projeto, criar/editar/excluir arquivos,
  executar JavaScript em um sandbox isolado, usar um shell virtual (com VCS de
  snapshots local) e criar subagentes somente leitura para tarefas de pesquisa.
  Você aprova cada ação sensível.
- 🔌 **Gerenciador de provedores de IA** — presets em três grupos:
  - *Grátis*: Groq, OpenRouter (modelos gratuitos), Cerebras, Hugging Face, Cloudflare Workers AI
  - *Pagos com nível gratuito*: Google Gemini, OpenAI, Mistral, DeepSeek, Together, Cohere, GitHub Models, Fireworks
  - *Premium*: Anthropic, xAI, Perplexity, Azure OpenAI, NVIDIA NIM, OpenRouter
  - Ou aponte para **qualquer endpoint compatível com OpenAI** (Ollama, LM Studio, vLLM, LiteLLM).
- ✍️ **Editor**: núcleo CodeMirror 6, mais de 100 linguagens, autocompletar,
  dobramento, múltiplos cursores, ferramentas rápidas, mais de 20 temas de
  editor, fontes personalizáveis.
- 🧠 **LSP**: TypeScript, JavaScript, Python, HTML, CSS, JSON, Tailwind e mais
  — diagnósticos, autocompletar, hover, ir para definição, renomear, formatar.
- 🐧 **Terminal**: shell Alpine Linux real via proot com executores em segundo
  plano e um gerenciador de pacotes estilo Termux.
- 📂 **Arquivos**: armazenamento local, cartão SD, backends SFTP e FTP,
  workspaces multi-raiz, busca e substituição poderosas entre arquivos.
- 🌐 **Pré-visualização ao vivo**: servidor HTTP integrado + preview no
  navegador do app e console.
- ☁️ **Sincronização em nuvem opcional**: backend no GitHub ou Firebase para
  backup de configurações e conversas de IA.
- 🔄 **Verificador de atualizações**: consulta opcional aos GitHub Releases
  (perguntado na primeira execução; também disponível em *Sobre → Verificar
  atualizações*).
- 🔌 **Plugins**: instale plugins da comunidade por URL ou arquivos locais,
  com um template de desenvolvimento.
- 🔒 **Núcleo 100% offline**: sem conta, sem anúncios, sem compras no app, sem
  rastreamento.
- 🌍 **30 idiomas de interface** — segue o idioma do dispositivo (Português
  como padrão de fallback).

## 📲 Download

Baixe o **APK/AAB** assinado mais recente na
[página de Releases](https://github.com/carsaimz/xcoder/releases). Builds beta
(`-beta.*` / `-rc.*`) são publicados como pre-releases.

Builds de depuração (`v1.x.x-debug`) são gerados automaticamente a cada push —
abra o
[workflow Debug APK](https://github.com/carsaimz/xcoder/actions/workflows/debug.yml),
escolha a execução mais recente e baixe o artefato.

<!-- TODO: adicionar capturas de tela reais do app quando forem capturadas -->

## 📸 Capturas de tela

| Editor + IA | Terminal | Git |
| :---: | :---: | :---: |
| ![Editor](docs/screenshots/editor.png) | ![Terminal](docs/screenshots/terminal.png) | ![Git](docs/screenshots/git.png) |

> As capturas ficam em [`docs/screenshots/`](docs/screenshots) — PRs com
> capturas novas são bem-vindos!

## 🛠️ Build

Requisitos: Node 18+, Java 17, Android SDK (API 36).

```bash
npm install          # instala as dependências
npm run setup        # adiciona plataforma android + plugins
npm run build        # APK de debug
npm run build p      # APK de release
npm run build p bundle  # AAB de release
```

Apenas o bundle web (útil para desenvolvimento PWA):

```bash
npx rspack --mode development
```

Rodar a suíte de testes:

```bash
npm test
```

## 🤖 Início rápido com o agente de IA

1. Abra uma pasta de projeto.
2. Toque na aba **IA** na barra lateral.
3. Abra *Configurações → Assistente de IA*, escolha um provedor (ex.:
   **Groq** — grátis), cole sua chave de API e escolha um modelo.
4. Pergunte qualquer coisa: "explique este projeto", "adicione um toggle de
   dark mode", "encontre todos os usos de X e refatore".

O agente pergunta antes de modificar qualquer coisa, a menos que você aumente
o nível de autonomia dele.

## 🌍 Idiomas e traduções

O XCoder vem com 30 idiomas de interface. Na primeira execução ele segue o
**idioma do dispositivo** quando há tradução disponível, usando **Português
(Brasil)** como padrão. Você pode trocar quando quiser em *Configurações →
App → Idioma*.

Traduções novas ou melhoradas são bem-vindas: edite o arquivo
`src/lang/<locale>.json` correspondente (use `en-us.json` como referência de
chaves) e abra um pull request.

## 📁 Estrutura do projeto

```
src/                 código-fonte do app (editor, fs, terminal, LSP, IA)
  lib/ai/            agente de IA, tools, cliente de provedores, shell virtual
  cm/                integração CodeMirror 6
  lang/              traduções da interface (30 locales)
  plugins/           plugins Cordova vendored (terminal, server, sftp, ...)
utils/               scripts de build/desenvolvimento
res/                 ícones e recursos Android
.github/             CI, automação de releases e configuração de bots
```

## 🔒 Privacidade

O XCoder **não** tem telemetria. As únicas requisições de rede são as que você
faz: chamadas a provedores de IA que você configura, servidores FTP/SFTP que
você adiciona, zips de plugins que você instala por URL e a verificação
opcional de atualizações nos GitHub Releases do projeto (pode ser
desativada nas configurações).

## 🤝 Contribuindo

Issues, pull requests e traduções são bem-vindas! Leia o
[CONTRIBUTING.md](CONTRIBUTING.md) para começar. O projeto mantém o CI verde
(typecheck, testes, build) — por favor rode `npm test` antes de fazer push.

## 📈 Estatísticas do repositório

[![Contribuidores](https://contrib.rocks/image?repo=carsaimz/xcoder)](https://github.com/carsaimz/xcoder/graphs/contributors)

[![Gráfico de estrelas](https://api.star-history.com/svg?repos=carsaimz/xcoder&type=Date)](https://star-history.com/#carsaimz/xcoder&Date)

## 🙏 Agradecimentos

O XCoder se apoia em gigantes:

- **[Acode](https://github.com/deewarz/acodeapp)** (© Foxdebug / Ajit Kumar) —
  o incrível editor do qual este projeto é fork.
- **Bibliotecas open-source** — CodeMirror 6, xterm.js, markdown-it, KaTeX,
  Mermaid, DOMPurify, Emmet, motion, html-tag-js, JSZip e todas as
  dependências do [`package.json`](package.json).
- **[Contribuintes](https://github.com/carsaimz/xcoder/graphs/contributors)** —
  todos que contribuem com código, documentação e traduções.
- **Comunidade** — testadores, tradutores e quem reporta erros. Obrigado!

## 📄 Licença

[MIT](license.txt) — baseado no excelente trabalho open-source do projeto
Acode (© Foxdebug / Ajit Kumar).

XCoder é desenvolvido e mantido por **Carsai Mozambique**
([@carsaimz](https://github.com/carsaimz)).

<div align="center">

[🇺🇸 English](readme.md) | [🇧🇷 Português (Brasil)](readme.pt-br.md)

</div>
