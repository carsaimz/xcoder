# Primeiros passos

Este guia leva você do app recém-instalado até o primeiro arquivo salvo, em cerca de dez minutos.

## 1. Escolha o idioma

Na primeira execução o XCoder detecta o idioma do sistema; se não houver correspondência exata, o **português** é o padrão. Para trocar depois, vá em **Configurações (Ctrl-,) › App › Idioma** — há 31 idiomas disponíveis e a troca é aplicada **imediatamente**, sem reiniciar o app.

## 2. Abra ou crie uma pasta de projeto

Tudo no XCoder gira em torno de uma pasta de trabalho. Toque no **menu principal (☰) › Abrir pasta** (ou `Ctrl-Shift-O`) e conceda a permissão de acesso ao armazenamento quando solicitado. Escolha — ou crie — a pasta do seu projeto; ela aparecerá no **explorador de arquivos** na barra lateral.

Para criar um arquivo novo: `Ctrl-N` (ou o botão + no explorador). Para renomear/duplicar/excluir, use o toque longo sobre o arquivo no explorador — o menu de contexto traz todas as ações.

## 3. Edite com conforto

O editor é baseado no CodeMirror 6, com realce de sintaxe para dezenas de linguagens, fechamento automático de pares, dobramento de código e formatação (`Ctrl-Alt-F`). Atalhos que você vai usar o tempo todo:

- `Ctrl-S` — salvar
- `Ctrl-F` / `Ctrl-R` — buscar / substituir
- `Ctrl-G` — ir para a linha
- `Ctrl-/` — comentar linha
- `` Ctrl-` `` — abrir o terminal

A lista completa está em [[Atalhos]].

## 4. Ajuste o visual

Em **Configurações › Tema** você escolhe entre **30 temas** prontos (Xcoder, Aurora, Nord, Matcha, Mocha, Sakura...). Fonte, tamanho (`Ctrl-+` / `Ctrl--`), quebra de linha e tab/space ficam em **Configurações › Editor**. Detalhes em [[Temas]].

## 5. Conecte os superpoderes

- **IA**: abra o chat na barra lateral e configure um provedor em **Configurações › IA** — veja [[Assistente-IA]]. Provedores com nível gratuito (Groq, OpenRouter *free models*, Google Gemini) funcionam muito bem para começar.
- **Git**: toque no app **Git** na barra lateral e entre com a sua conta GitHub via *device flow* — veja [[Git]].
- **Plugins**: em **Configurações › Plugins** (`Ctrl-Shift-X`) você explora o marketplace com os plugins oficiais — veja [[Plugins]].
- **Terminal**: ``Ctrl-` `` abre o terminal com comandos de arquivos e Git. Veja [[Interface]].

## 6. Salve tudo e siga em frente

`Ctrl-Shift-S` salva com "salvar como"; o autosave pode ser ativado em **Configurações › Editor**. Se algo se comportar de forma estranha, a [[Solucao-de-Problemas]] e o menu oculto de desenvolvedor (7 toques no número da versão em **Sobre**) resolvem a maioria dos casos. Bom código!
