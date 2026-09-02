# Plugins

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
