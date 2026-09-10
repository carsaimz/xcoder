# Temas / Themes

[🇧🇷 Português](#português) | [🇺🇸 English](#english)

---

<a id="português"></a>

## 🇧🇷 Português

O XCoder vem com **30 temas** prontos, cobrindo preferências claras, escuras e coloridas. Entre os próprios do projeto estão **Xcoder** (a paleta da marca), **Aurora**, **Nord**, **Matcha**, **Mocha** e **Sakura** — além dos clássicos herdados do Acode.

## Trocando o tema

Três caminhos, o mesmo resultado:

- **Configurações (Ctrl-,) › Tema** — lista completa com preview.
- **Paleta de comandos** (`Ctrl-Shift-P`) → digite "tema" → *Change theme*.
- **Menu de edição** (`F4`) → seletor rápido de tema.

A troca é aplicada na hora, sem reiniciar. Tema do editor e tema da interface acompanham um ao outro.

## Tema claro e escuro

Além da escolha manual, há a opção de **seguir o sistema**: o app detecta o modo escuro do Android e ajusta a interface e o editor. Combine com o papel de parede/brilho do aparelho para conforto visual noturno.

## Criando o seu tema

Temas são código — e, portanto, contribuíveis. O ponto de partida é `src/theme/preInstalled.js`, onde cada tema declara as cores do editor (fundo, texto, palavras-chave, strings, números...) e as variáveis da interface (`--active-color`, `--button-*`...). O fluxo recomendado:

1. Copie um tema existente como base (o **Xcoder** é o exemplo mais completo).
2. Ajuste a paleta — ferramentas como *Coolors* ajudam a montar uma escala harmônica.
3. Teste no editor com código de exemplo em 2–3 linguagens (realce varia muito entre elas).
4. Abra um **pull request** com o novo tema — temas da comunidade entram na lista oficial (veja [[Contribuindo]]).

> Um guia dedicado a temas, com a tabela completa de variáveis, está planejado. Enquanto isso, o arquivo `preInstalled.js` é a fonte da verdade e os comentários nele explicam cada grupo de cores.

## Temas de plugins

Plugins também podem registrar temas próprios via API (`xcoder.require` e eventos de configuração) — veja [[Plugins]]. É o caminho ideal para temas "empacotados" que você quer distribuir sem tocar no núcleo do app.

---

<a id="english"></a>

## 🇺🇸 English

XCoder comes with **30 ready-made themes**, covering light, dark and colorful preferences. Among the project's own are **Xcoder** (the brand palette), **Aurora**, **Nord**, **Matcha**, **Mocha** and **Sakura** — plus the classics inherited from Acode.

## Switching the theme

Three paths, same result:

- **Settings (Ctrl-,) › Theme** — full list with preview.
- **Command palette** (`Ctrl-Shift-P`) → type "theme" → *Change theme*.
- **Edit menu** (`F4`) → quick theme picker.

The switch applies instantly, with no restart. Editor theme and UI theme follow each other.

## Light and dark theme

Beyond the manual choice, there is a **follow system** option: the app detects Android's dark mode and adjusts the interface and the editor. Combine it with the device's wallpaper/brightness for comfortable night reading.

## Creating your own theme

Themes are code — and therefore contributable. The starting point is `src/theme/preInstalled.js`, where each theme declares the editor colors (background, text, keywords, strings, numbers...) and the UI variables (`--active-color`, `--button-*`...). The recommended flow:

1. Copy an existing theme as a base (**Xcoder** is the most complete example).
2. Adjust the palette — tools like *Coolors* help you build a harmonic scale.
3. Test it in the editor with sample code in 2–3 languages (highlighting varies a lot between them).
4. Open a **pull request** with the new theme — community themes join the official list (see [[Contribuindo|Contributing]]).

> A dedicated theme guide, with the full variable table, is planned. Meanwhile, `preInstalled.js` is the source of truth and its comments explain each color group.

## Plugin themes

Plugins can also register their own themes via the API (`xcoder.require` and settings events) — see [[Plugins]]. It is the ideal path for "bundled" themes you want to distribute without touching the app core.
