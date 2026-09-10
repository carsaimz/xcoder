# Plugins

[🇧🇷 Português](#português) | [🇺🇸 English](#english)

---

<a id="português"></a>

## 🇧🇷 Português

O XCoder tem um **marketplace próprio de plugins**, com registro oficial remoto, instalação por um toque e uma API global (`window.xcoder`) para criar as suas próprias extensões.

## Instalando plugins

1. Abra **Configurações › Plugins** (`Ctrl-Shift-X`) ou o app **Plugins** na barra lateral.
2. Na aba **Explorar**, veja o catálogo — os **7 plugins oficiais** já vêm no registro:
   **word-count** (contagem de palavras, `Ctrl-Alt-W`), **case-toggle** (8 estilos de caixa, `Ctrl-Alt-C`), **sort-lines** (7 modos de ordenação, `Ctrl-Alt-S`), **insert-date** (9 formatos de data, `Ctrl-Alt-T`), **lorem-ipsum** (gerador de parágrafos), **base64-tool** (Base64/URL-safe/percent com Unicode) e **line-tools** (duplicar/mover linhas, `Ctrl-Shift-D`).
3. Toque em **Instalar**. O download tenta o endereço primário e, se falhar, cai automaticamente para o espelho (jsDelivr).
4. Ative/desative com o interruptor do card — desativar não desinstala.

Os plugins instalados e seus dados ficam no armazenamento local do app. Remover é tão simples quanto o botão de lixeira no card.

## Marketplace personalizado

Em **Configurações › Marketplace URL** você aponta para **qualquer registro JSON compatível** — o seu próprio fork do [xcoder-plugins](https://github.com/carsaimz/xcoder-plugins), um registro privado da empresa ou um espelho. Formatos aceitos: URL de arquivo JSON no mesmo esquema do registro oficial. A configuração remota via backend (veja [[Integracao-App]]) também pode definir esse endereço para toda uma comunidade.

## Desenvolvendo um plugin

Um plugin é um **ZIP** com quatro arquivos na raiz:

```
meu-plugin.zip
├── plugin.json   ← manifest: id, name, version, author, description
├── main.js       ← código, carregado quando o plugin ativa
├── icon.png      ← ícone 128×128
└── readme.md     ← documentação curta
```

No `main.js`, a API global `window.xcoder` é o ponto de entrada:

```js
xcoder.setPluginInit("meu-plugin", (onLoad) => {
  const toast = xcoder.require("toast");
  const cmd = xcoder.require("commands");

  cmd.addCommand({
    name: "Ola mundo",
    description: "Mostra uma saudação",
    action: () => toast.show("Olá, mundo!"),
  });

  // retorno de limpeza (opcional) chamado no unmount
  return () => cmd.removeCommand("Ola mundo");
});
xcoder.setPluginUnmount?.("meu-plugin", () => { /* teardown extra */ });
```

Facades disponíveis via `xcoder.require(...)`: `toast`, `select`, `prompt`, `fs`, `commands`, entre outras (a referência completa fica em `src/api/` do repositório). Comandos registrados aparecem na **paleta** (`Ctrl-Shift-P`) e podem ter atalhos próprios.

## Publicando no marketplace oficial

1. Teste o ZIP localmente (**Instalar de arquivo** na página de plugins).
2. Abra uma **issue** ou **pull request** em [carsaimz/xcoder-plugins](https://github.com/carsaimz/xcoder-plugins) — o README do repo traz o guia de submissão e o formato exato da entrada do `plugins.json` (descrição EN+PT, changelog, ícone, fonte).
3. Após revisão, o plugin entra no registro oficial e passa a aparecer para todos os usuários.

**Requisitos básicos**: sem código ofuscado, sem telemetria não declarada, permissões mínimas, README explicando o que o plugin faz. Plugins que tocam em tokens/credenciais passam por revisão mais cuidadosa.

---

<a id="english"></a>

## 🇺🇸 English

XCoder has **its own plugin marketplace**, with a remote official registry, one-tap installation and a global API (`window.xcoder`) to build your own extensions.

## Installing plugins

1. Open **Settings › Plugins** (`Ctrl-Shift-X`) or the **Plugins** app in the sidebar.
2. On the **Explore** tab, browse the catalog — the **7 official plugins** ship in the registry:
   **word-count** (word counter, `Ctrl-Alt-W`), **case-toggle** (8 case styles, `Ctrl-Alt-C`), **sort-lines** (7 sort modes, `Ctrl-Alt-S`), **insert-date** (9 date formats, `Ctrl-Alt-T`), **lorem-ipsum** (paragraph generator), **base64-tool** (Base64/URL-safe/percent with Unicode) and **line-tools** (duplicate/move lines, `Ctrl-Shift-D`).
3. Tap **Install**. The download tries the primary URL first and, on failure, automatically falls back to the mirror (jsDelivr).
4. Enable/disable with the card switch — disabling does not uninstall.

Installed plugins and their data live in the app's local storage. Removing is as simple as the trash button on the card.

## Custom marketplace

Under **Settings › Marketplace URL** you point to **any compatible JSON registry** — your own fork of [xcoder-plugins](https://github.com/carsaimz/xcoder-plugins), a private company registry or a mirror. Accepted format: JSON file URL using the same schema as the official registry. Remote config via the backend (see [[Integracao-App|Integration API]]) can also set that address for an entire community.

## Developing a plugin

A plugin is a **ZIP** with four files at the root:

```
my-plugin.zip
├── plugin.json   ← manifest: id, name, version, author, description
├── main.js       ← code, loaded when the plugin activates
├── icon.png      ← 128×128 icon
└── readme.md     ← short documentation
```

In `main.js`, the global API `window.xcoder` is the entry point:

```js
xcoder.setPluginInit("my-plugin", (onLoad) => {
  const toast = xcoder.require("toast");
  const cmd = xcoder.require("commands");

  cmd.addCommand({
    name: "Hello world",
    description: "Shows a greeting",
    action: () => toast.show("Hello, world!"),
  });

  // cleanup return (optional) called on unmount
  return () => cmd.removeCommand("Hello world");
});
xcoder.setPluginUnmount?.("my-plugin", () => { /* extra teardown */ });
```

Facades available via `xcoder.require(...)`: `toast`, `select`, `prompt`, `fs`, `commands`, among others (the full reference lives in `src/api/` of the repository). Registered commands show up in the **palette** (`Ctrl-Shift-P`) and can have their own shortcuts.

## Publishing to the official marketplace

1. Test the ZIP locally (**Install from file** on the plugins page).
2. Open an **issue** or **pull request** on [carsaimz/xcoder-plugins](https://github.com/carsaimz/xcoder-plugins) — the repo README has the submission guide and the exact `plugins.json` entry format (EN+PT description, changelog, icon, source).
3. After review, the plugin joins the official registry and shows up for all users.

**Basic requirements**: no obfuscated code, no undeclared telemetry, minimal permissions, a README explaining what the plugin does. Plugins that touch tokens/credentials go through closer review.
