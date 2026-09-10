# Sistema de Ícones — Convenção Híbrida
# Icon System — Hybrid Convention

[🇧🇷 Português](#português) | [🇺🇸 English](#english)

---

<a id="português"></a>

## 🇧🇷 Português

A UI do Xcoder mistura conjuntos de ícones curados, cada um com um papel
claro. Isso mantém a interface expressiva sem virar ruído, e afasta a
identidade visual do azul padrão do Acode rumo à paleta da marca:
**índigo profundo + acento laranja**.

## Os quatro níveis

| Nível                | Conjunto         | Uso                                                              | Exemplos                             |
| -------------------- | ---------------- | ---------------------------------------------------------------- | ------------------------------------ |
| Sidebar / atividades | **Lucide**       | Ícones de traço fino e outline moderno para navegação e painéis  | files, search, git-branch, brain, puzzle |
| Ações primárias      | **Material (Filled)** | Glifos preenchidos para as ações que importam (salvar, rodar, enviar) | send, play_arrow, add, check |
| Status / indicadores | **FontAwesome 6 (solid)** | Chips de estado, badges e indicadores de conexão        | circle, plug, wifi, triangle-exclamation |
| Navegação / abas     | **Bootstrap Icons** | Barras de abas, steppers e orientação                          | house, journal-code, grid            |

## Como isso mapeia no código

O app é um projeto WebView (Cordova), então a fonte de ícones em runtime é
a fonte empacotada em `src/res/icons/` (`icons.ttf` + `style.css`, classes
como `icon edit`). A convenção define **qual glifo escolher** para UI nova:

1. Ícones novos de sidebar/painéis → adicione o glifo outline estilo Lucide
   à fonte (o pipeline em `scripts/xcoder_icon.py` renderiza contornos SVG
   em `icons.ttf`).
2. Botões de ação (enviar, salvar, testar, novo chat) → glifos preenchidos
   estilo Material que já existem na fonte (`send`, `play_arrow`, `add`,
   `check`, `tune`).
3. Chips de status (Conectado / Offline / badges) → glifos sólidos ou os
   componentes de pílula coloridos (`.ai-pchip`, badges de provedor) — a
   cor carrega o estado: verde `#4CAF50`, âmbar `#FFC107`, vermelho
   `#F44336`, laranja `#FF8A3D` para acentos da marca.
4. Abas/navegação reutilizam os glifos de navegação existentes; abas
   outline estilo Bootstrap são questão de estilo (espessura de traço), não
   de fonte nova.

No **lado web** (`xcoder-web`), o Lucide entra como `lucide-react` e é a
fonte única da navegação do site — o nível 1 desta convenção.

## O pack de ícones SVG (níveis 1 + 2, entregues)

A navegação é sustentada por um pack real e versionado — não é mais
convenção no papel:

- **Módulo de runtime**: `src/utils/svgIcons.js` — 61 ícones estilo Lucide
  (24×24, traço `currentColor`, largura 1.75) como SVG inline, com
  `svgIcon(name)` / `hasIcon(name)`.
- **Ficheiros do pack**: `src/res/icons/svg/*.svg` — vetores autônomos
  regenerados do módulo com `node scripts/export_svg_pack.cjs` (a fonte de
  verdade é o módulo).
- **Integração**: ícones de `SidebarApp` registrados como `svg:<nome>`
  renderizam o vetor inline (`.icon.xc-svgicon`); o kit de settings aceita
  o mesmo prefixo `svg:<nome>` em qualquer `item.icon`
  (`components/settingsPage.js`), e o dialog `select` também desenha esses
  vetores (`dialogs/select.js`). Quando o nome não está no pack, cai
  silenciosamente para a fonte de ícones, então plugins que usam nomes da
  fonte continuam funcionando.

## Regras de paleta

- Superfícies/texto primários: guiados pelo tema (tema padrão **Xcoder**:
  ameixa profunda `rgb(35,33,51)` + violeta `rgb(133,108,250)`).
- Botões/CTAs: acento laranja `rgb(255,138,61)` → `rgb(224,104,34)` ao
  pressionar.
- Status: chips verde/âmbar/vermelho como acima; nunca use o azul antigo do
  Acode como acento em UI nova.

---

<a id="english"></a>

## 🇺🇸 English

The Xcoder UI mixes curated icon sets, each with a clear role. This keeps the
interface expressive without becoming noisy, and moves the visual identity
away from the default Acode blue towards the brand palette: **deep indigo +
orange accent**.

## The four tiers

| Tier                  | Set              | Usage                                                            | Examples                             |
| --------------------- | ---------------- | ---------------------------------------------------------------- | ------------------------------------ |
| Sidebar / activities  | **Lucide**       | Thin-stroke, modern outline icons for navigation and panels       | files, search, git branch, brain, puzzle |
| Primary actions       | **Material (Filled)** | Filled glyphs for the actions that matter (save, run, send, mode toggle) | send, play_arrow, add, check |
| Status / indicators   | **FontAwesome 6 (solid)** | State chips, badges and connection indicators              | circle, plug, wifi, triangle-exclamation |
| Navigation / tabs     | **Bootstrap Icons** | Tab bars, steppers and wayfinding                               | house, journal-code, grid            |

## How this maps to the codebase

The app is a WebView (Cordova) project, so the runtime icon source is the
bundled icon font in `src/res/icons/` (`icons.ttf` + `style.css`, class names
like `icon edit`). The convention governs **which glyph we pick** for new UI:

1. New sidebar/panel icons → add the Lucide-style outline glyph to the font
   (the build pipeline in `scripts/xcoder_icon.py` renders SVG contours into
   `icons.ttf`).
2. Action buttons (send, save, test, new chat) → filled Material-style glyphs
   that already exist in the font (`send`, `play_arrow`, `add`, `check`,
   `tune`).
3. Status chips (Connected / Offline / badges) → solid glyphs or the colored
   pill components (`.ai-pchip`, provider badges) — color carries the state:
   `#4CAF50` green, `#FFC107` amber, `#F44336` red, orange `#FF8A3D` for
   brand accents.
4. Tabs/navigation reuse the existing navigation glyphs; Bootstrap-style
   outline tabs are a styling concern (stroke width), not a new font.

On the **web side** (`xcoder-web`), Lucide ships as `lucide-react` and is the
single source for site navigation — matching tier 1 of this convention.

## The SVG icon pack (tier 1 + 2, shipped)

The navigation tiers are backed by a real, versioned pack — no longer a
convention on paper:

- **Runtime module**: `src/utils/svgIcons.js` — 61 Lucide-flavored icons
  (24×24, stroke `currentColor`, width 1.75) as inline SVG, with
  `svgIcon(name)` / `hasIcon(name)`.
- **Pack files**: `src/res/icons/svg/*.svg` — standalone vectors regenerated
  from the module with `node scripts/export_svg_pack.cjs` (source of truth =
  the module).
- **Integration**: `SidebarApp` icons registered as `svg:<name>` render the
  inline vector (`.icon.xc-svgicon`); the settings kit accepts the same
  `svg:<name>` prefix on any `item.icon` (`components/settingsPage.js`),
  falling back silently to the icon font glyph when the name is not
  registered, so plugins using font names keep working.

Current registrations:

- Sidebar rail: files→`svg:files`, search→`svg:search`, plugins→`svg:puzzle`,
  AI→`svg:brain`, Git→`svg:git-branch`, notifications→`svg:bell`,
  settings→`svg:settings`.
- Main settings (tier 2 — navigation, grouped Core → Appearance → Code &
  tools → Connections → Data → About): app→`svg:sliders-horizontal`,
  editor→`svg:file-code`, terminal→`svg:square-terminal`,
  preview→`svg:globe`, theme→`svg:palette`, fonts→`svg:type`,
  formatter→`svg:braces`, language servers→`svg:zap`, AI→`svg:bot`,
  plugins→`svg:puzzle`, GitHub→`svg:github`, SSH→`svg:server`,
  settings.json→`svg:file-cog`, reset→`svg:rotate-ccw`,
  support→`svg:heart`, about→`svg:info`, changelog→`svg:history`.

Tier 3 — menus and static pages (shipped): the icon enhancer
(`utils/iconEnhancer.js`) upgrades rendered font glyphs to the SVG pack at
runtime. Wired into:

- `components/contextmenu/index.js` — every context menu, which covers the
  main editor menu (`views/menu.hbs`) and the file menu
  (`views/file-menu.hbs`): new file→`file-plus`, save→`save`,
  open folder→`folder`, close→`x`, history→`history`, search→`search`,
  AI chat→`message-square`, insight→`lightbulb`, actions→`sparkles`,
  code→`code`, terminal→`terminal`, apps→`layout-grid`,
  settings→`settings`, help→`circle-help`, exit→`log-out`,
  share→`share-2`, in browser→`external-link`, rename→`pencil`,
  home→`house`, pin/pin-off, jump tabs→`chevrons-left/right`,
  compare→`arrow-right-left`, encoding→`corner-up-left`,
  theme→`palette`, and more.
- `pages/about/about.js` — update→`refresh-cw`, offline→`smartphone`,
  GitHub→`github`, issues→`circle-alert`, license→`history`,
  contributors→`user`, community→`heart`. Brand glyphs (`xcoder`,
  `javascript`) intentionally stay on the icon font.

Extra glyphs ready for future UI: download, book-open, bug, shield,
git-pull-request, refresh-cw, external-link, save, play, message-square,
sparkles, folder, plus, x, file-plus, lightbulb, code, layout-grid,
circle-help, log-out, share-2, pencil, house, pin, pin-off,
chevrons-left/right, arrow-right-left, corner-up-left, github, user,
heart, smartphone, circle-alert.

Path data © Lucide Contributors, ISC license.

## Palette rules

- Primary surfaces/text: theme driven (default theme **Xcoder**: deep plum
  `rgb(35,33,51)` + violet `rgb(133,108,250)`).
- Buttons/CTAs: orange accent `rgb(255,138,61)` → `rgb(224,104,34)` on press.
- Status: green/amber/red chips as above; never use the old Acode blue as an
  accent in new UI.
