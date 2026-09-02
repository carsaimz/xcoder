# Interface

A interface do XCoder segue o padrão de IDEs modernas: **editor no centro, abas no topo, apps na barra lateral e terminal em painel**. Quem vem do VS Code ou do Acode se sente em casa em segundos.

## Editor e abas

Cada arquivo aberto ocupa uma **aba** no topo do editor. Você pode dividir a tela em **painéis** — `Ctrl-\` divide à direita, `Ctrl-Shift-\` divide para baixo e `Ctrl-Alt-\` move a aba atual para um novo painel — útil para comparar arquivos ou escrever código e preview lado a lado. Navegue entre abas com `Ctrl-Tab` / `Ctrl-Shift-Tab` e feche com `Ctrl-Q` (atual) ou `Ctrl-Shift-Q` (todas).

O marcador de bolinha no título da aba indica alterações não salvas. Com o autosave ativado em **Configurações › Editor**, esse cuidado desaparece.

## Barra lateral (apps)

O botão `Ctrl-B` (ou o gesto de deslizar da borda esquerda) abre a barra lateral com os apps disponíveis:

- **Explorador de arquivos** (`Ctrl-Shift-E`) — árvore do projeto, criação, renomeação e exclusão, com menu de contexto no toque longo.
- **Busca em arquivos** — pesquisa textual em todo o projeto, com filtro por extensão.
- **Git** — status do repositório, staging, commits, push/pull e histórico. Veja [[Git]].
- **Chat de IA** — conversa com o modelo configurado, com acesso ao contexto do arquivo aberto. Veja [[Assistente-IA]].
- **Plugins** — gerenciamento do que está instalado e exploração do marketplace. Veja [[Plugins]].
- **Configurações** (`Ctrl-,`) — todas as preferências do app, editor, IA e atalhos.

Cada app é um painel independente; abrir um novo não fecha o que você estava usando — a barra lateral alterna entre eles.

## Terminal

``Ctrl-` `` abre o **terminal** em painel inferior. É um emulador xterm com comandos reais para navegar arquivos, ler/editar texto e operar Git — o estado do repositório é compartilhado com o painel Git. Tabs de terminal permitem manter mais de uma sessão. Não é um shell Linux completo (sem apt/npm do sistema), mas cobre o fluxo de trabalho de edição e versionamento.

## Paleta de comandos

`Ctrl-Shift-P` abre a **paleta de comandos**, o canivete suíço do app: todos os comandos registrados (mais de 100, incluindo os de plugins), com **busca fuzzy** — digite "svfl" e ela encontra "Salvar arquivo". As descrições aparecem no seu idioma e os **comandos recentes ficam no topo** da lista. Se você só decorar um atalho deste guia, que seja este.

## Menu e notificações

O menu principal (☰ ou `F3`) reúne ações de arquivo, edição e ferramentas. Avisos (salvamentos, erros de rede, resultados de comandos) aparecem como **toasts** na parte inferior; erros de código são sinalizados em **Problemas** (`Ctrl-Shift-M`).

## Menu oculto de desenvolvedor

Na página **Sobre**, tocar **7 vezes** no número da versão abre o menu de desenvolvedor: limpar cache, reiniciar o app, abrir o console e copiar informações de build. Ele existe para diagnóstico — não há nada de "manutenção" espalhado pelas configurações comuns. Detalhes em [[Solucao-de-Problemas]].
