# Atalhos de teclado / Keyboard shortcuts

[🇧🇷 Português](#português) | [🇺🇸 English](#english)

---

<a id="português"></a>

## 🇧🇷 Português

O XCoder suporta teclado físico e Bluetooth. Abaixo estão os atalhos registrados no app (os modificadores seguem o padrão `Ctrl-Tecla`). Todos podem ser consultados e ajustados em **Configurações › Atalhos**.

> No celular sem teclado, tudo aqui também é acessível pela **paleta de comandos** (`Ctrl-Shift-P`) e pelos menus.

## Arquivos e abas

| Atalho | Ação |
|---|---|
| `Ctrl-N` | Criar novo arquivo |
| `Ctrl-O` | Abrir arquivo |
| `Ctrl-Shift-O` | Abrir pasta |
| `Ctrl-S` | Salvar arquivo atual |
| `Ctrl-Shift-S` | Salvar como |
| `Ctrl-P` | Busca rápida de arquivo |
| `Ctrl-Tab` | Próxima aba |
| `Ctrl-Shift-Tab` | Aba anterior |
| `Ctrl-Q` | Fechar aba atual |
| `Ctrl-Shift-Q` | Fechar todas as abas |
| `F2` | Renomear arquivo atual |

## Painéis e interface

| Atalho | Ação |
|---|---|
| `Ctrl-\` | Dividir painel à direita |
| `Ctrl-Shift-\` | Dividir painel para baixo |
| `Ctrl-Alt-\` | Mover aba para novo painel |
| `Ctrl-Alt-W` | Fechar painel ativo |
| `Ctrl-Alt-←` `→` `↑` `↓` | Focar painel vizinho |
| `Ctrl-B` | Alternar barra lateral |
| `` Ctrl-` `` | Abrir/fechar terminal |
| `Ctrl-,` | Menu de configurações |
| `F3` | Alternar menu principal |
| `F4` | Alternar menu de edição |
| `F11` | Alternar tela cheia |
| `Ctrl-Shift-P` | **Paleta de comandos** |
| `Ctrl-Shift-E` | Explorador de arquivos |
| `Ctrl-Shift-X` | Página de plugins |
| `Ctrl-1` | Focar o editor |

## Edição

| Atalho | Ação |
|---|---|
| `Ctrl-Z` / `Ctrl-Shift-Z` | Desfazer / Refazer |
| `Ctrl-A` | Selecionar tudo |
| `Ctrl-D` | Selecionar palavra atual |
| `Ctrl-C` / `Ctrl-X` / `Ctrl-V` | Copiar / Cortar / Colar |
| `Ctrl-F` | Buscar |
| `Ctrl-R` | Substituir |
| `Ctrl-G` | Ir para a linha |
| `Ctrl-Shift-M` | Mostrar problemas |
| `Ctrl-/` | Comentar linha |
| `Ctrl-Shift-/` | Comentar bloco |
| `Tab` / `Shift-Tab` | Indentar / Desindentar |
| `Alt-Up` / `Alt-Down` | Mover linha para cima/baixo |
| `Alt-Shift-Up` / `Alt-Shift-Down` | Copiar linha para cima/baixo |
| `Ctrl-Shift-D` | Duplicar seleção |
| `Shift-Home` / `Shift-End` | Selecionar até o início/fim da linha |
| `Ctrl-Shift-[` / `Ctrl-Shift-]` | Dobrar / Desdobrar código |
| `Ctrl-Alt-[` / `Ctrl-Alt-]` | Dobrar tudo / Desdobrar tudo |
| `Ctrl-Alt-F` | Formatar código |

## Linguagem, execução e LSP

| Atalho | Ação |
|---|---|
| `Ctrl-M` | Mudar modo (linguagem) do arquivo |
| `F5` | Executar arquivo atual |
| `Ctrl-+` / `Ctrl--` | Aumentar / diminuir fonte |
| `Alt-Shift-F` | Formatar documento (Language Server) |
| `Ctrl-Shift-Space` | Ajuda de assinatura |
| `F12` | Ir para definição |
| `Shift-F12` | Encontrar referências |
| `F8` / `Shift-F8` | Diagnóstico seguinte / anterior |

## Personalizando

Em **Configurações › Atalhos** você pode reatribuir teclas; conflitos são sinalizados pelo app antes de salvar. Atalhos de plugins aparecem automaticamente na mesma página — os plugins oficiais, por exemplo, registram `Ctrl-Alt-W` (word count), `Ctrl-Alt-C` (case toggle), `Ctrl-Alt-S` (sort lines), `Ctrl-Alt-T` (inserir data) e `Ctrl-Shift-D` (duplicar linha, quando o plugin line-tools está ativo).

O arquivo-fonte com a tabela completa fica em `src/lib/keyBindings.js` — contribuições de novos atalhos são bem-vindas (veja [[Contribuindo]]).

---

<a id="english"></a>

## 🇺🇸 English

XCoder supports physical and Bluetooth keyboards. Below are the shortcuts registered in the app (modifiers follow the `Ctrl-Key` pattern). All of them can be browsed and reassigned in **Settings › Shortcuts**.

> On a phone without a keyboard, everything here is also reachable through the **command palette** (`Ctrl-Shift-P`) and the menus.

## Files and tabs

| Shortcut | Action |
|---|---|
| `Ctrl-N` | Create new file |
| `Ctrl-O` | Open file |
| `Ctrl-Shift-O` | Open folder |
| `Ctrl-S` | Save current file |
| `Ctrl-Shift-S` | Save as |
| `Ctrl-P` | Quick file search |
| `Ctrl-Tab` | Next tab |
| `Ctrl-Shift-Tab` | Previous tab |
| `Ctrl-Q` | Close current tab |
| `Ctrl-Shift-Q` | Close all tabs |
| `F2` | Rename current file |

## Panels and interface

| Shortcut | Action |
|---|---|
| `Ctrl-\` | Split panel to the right |
| `Ctrl-Shift-\` | Split panel downward |
| `Ctrl-Alt-\` | Move tab to a new panel |
| `Ctrl-Alt-W` | Close active panel |
| `Ctrl-Alt-←` `→` `↑` `↓` | Focus neighboring panel |
| `Ctrl-B` | Toggle sidebar |
| `` Ctrl-` `` | Open/close terminal |
| `Ctrl-,` | Settings menu |
| `F3` | Toggle main menu |
| `F4` | Toggle edit menu |
| `F11` | Toggle fullscreen |
| `Ctrl-Shift-P` | **Command palette** |
| `Ctrl-Shift-E` | File explorer |
| `Ctrl-Shift-X` | Plugins page |
| `Ctrl-1` | Focus the editor |

## Editing

| Shortcut | Action |
|---|---|
| `Ctrl-Z` / `Ctrl-Shift-Z` | Undo / Redo |
| `Ctrl-A` | Select all |
| `Ctrl-D` | Select current word |
| `Ctrl-C` / `Ctrl-X` / `Ctrl-V` | Copy / Cut / Paste |
| `Ctrl-F` | Find |
| `Ctrl-R` | Replace |
| `Ctrl-G` | Go to line |
| `Ctrl-Shift-M` | Show problems |
| `Ctrl-/` | Toggle line comment |
| `Ctrl-Shift-/` | Toggle block comment |
| `Tab` / `Shift-Tab` | Indent / Unindent |
| `Alt-Up` / `Alt-Down` | Move line up/down |
| `Alt-Shift-Up` / `Alt-Shift-Down` | Copy line up/down |
| `Ctrl-Shift-D` | Duplicate selection |
| `Shift-Home` / `Shift-End` | Select to start/end of line |
| `Ctrl-Shift-[` / `Ctrl-Shift-]` | Fold / Unfold code |
| `Ctrl-Alt-[` / `Ctrl-Alt-]` | Fold all / Unfold all |
| `Ctrl-Alt-F` | Format code |

## Language, run and LSP

| Shortcut | Action |
|---|---|
| `Ctrl-M` | Change file mode (language) |
| `F5` | Run current file |
| `Ctrl-+` / `Ctrl--` | Increase / decrease font size |
| `Alt-Shift-F` | Format document (Language Server) |
| `Ctrl-Shift-Space` | Signature help |
| `F12` | Go to definition |
| `Shift-F12` | Find references |
| `F8` / `Shift-F8` | Next / previous diagnostic |

## Customizing

In **Settings › Shortcuts** you can reassign keys; conflicts are flagged by the app before saving. Plugin shortcuts appear automatically on the same page — the official plugins, for instance, register `Ctrl-Alt-W` (word count), `Ctrl-Alt-C` (case toggle), `Ctrl-Alt-S` (sort lines), `Ctrl-Alt-T` (insert date) and `Ctrl-Shift-D` (duplicate line, when the line-tools plugin is active).

The source file with the full table lives in `src/lib/keyBindings.js` — contributions for new shortcuts are welcome (see [[Contribuindo|Contributing]]).
