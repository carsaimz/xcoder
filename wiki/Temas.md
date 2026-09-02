# Temas

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
