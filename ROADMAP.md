# ROADMAP — XCoder

> Onde o projeto está e para onde vai. Actualizado em **Setembro de 2026** (v1.4.19).
> Itens marcados com ✅ estão feitos e publicados; 🔜 são os próximos passos;
> 💡 são ideias avaliadas para depois.

---

## ✅ Concluído (até v1.4.19)

### Núcleo / Editor
- ✅ Editor CodeMirror 6 com 23+ linguagens, temas (Dark+/Light/Solarized + construtor), multi-janela.
- ✅ Sistema de ficheiros multi-backend: local (Cordova), memória, navegador (IndexedDB), WebDAV/SFTP/FTP.
- ✅ Terminal virtual integrado (proot/Alpine), execução de JS e shell sandboxed.
- ✅ Git simplificado: snapshots, restauro, GitHub OAuth Device Flow, comandos preparados.
- ✅ Markdown, busca global, substituição, formatação de código.

### IA (integrada e gratuita por defeito)
- ✅ Chat + Agente (ferramentas: ler/escrever ficheiros, comandos, subagentes).
- ✅ Provedores keyless (sem chave): **Integrado (Pollinations)** e **DuckDuckGo AI**.
- ✅ **v1.4.19 — correções de fiabilidade:** Pollinations volta ao modo não-streaming (a API legacy rejeitou SSE anónimo com "402"); chave Pollinations expirada é ignorada automaticamente (retry anónimo) e o erro passa a explicar o que fazer; crash de cookies do plugin HTTP (`hostOnly`) corrigido na raiz (parche no plugin + auto-limpeza).
- ✅ **v1.4.19 — controlo rápido no chat:** botões "Pensar" (raciocínio) e "Buscar" (busca na web) junto ao campo de mensagem; ao pensar aparece só "Pensando..." (o processo completo fica recolhido num bloco opcional).
- ✅ **v1.4.19 — logotipos dos provedores:** logo + modelo seleccionado na faixa do chat (nome completo no tooltip); logos também no seletor de modelos; provedores personalizados usam 🤖.
- ✅ **v1.4.19 — acções nas mensagens:** toque longo / 2 toques / botão direito abre o menu completo: copiar, inserir no editor, partilhar, regenerar, explicar melhor e resumir.
- ✅ Geração de imagens por comando (`/image`), artefactos, sessões múltiplas, slash commands, skills.
- ✅ Scroll automático para a última mensagem ao entrar no chat.

### Plugins
- ✅ 16 plugins próprios no marketplace (toggle-comment, json-tools, uuid, emoji, cores, TOC, indent, dedupe, hash, …).
- ✅ **v1.4.19 — scroll do painel de plugins corrigido** (layout flexbox em vez do max-height injectado; scroll infinito deixa de falhar).
- ✅ Fontes remotas: registry GitHub + jsDelivr com cache offline no app.

### Conta / Site / Pagamentos
- ✅ Conta única partilhada entre app e site (Supabase) com Premium por doação.
- ✅ Página /sponsor no site e "Apoie o projecto" no app.
- ✅ **v1.4.19 — OAuth:** Google/GitHub só aparecem quando estão activos no projecto (verificação antes de renderizar, sem "flash"), agora com os logos reais das marcas.
- ✅ Premium simplificado: apenas remove anúncios e aumenta limites de IA — todas as outras funcionalidades são livres.

### Infra / Bots / Release
- ✅ CI (vitest + typecheck + biome + build), CodeQL diário, dependency-review.
- ✅ **v1.4.19 — release automático:** um push em `main` que sobe a versão gera a tag e publica o release assinado automaticamente (workflow `auto-release.yml`).
- ✅ **v1.4.19 — bot de dependências próprio:** `deps-update.yml` corre semanalmente, testa tudo e abre 1 PR com updates minor/patch (independente dos toggles da Dependabot) + auto-merge configurado para bots.
- ✅ Dependabot (diário) mantido; instruções de ativação nos cabeçalhos dos workflows.
- ✅ i18n: pt-br 100% (idioma principal de UX), notificações LSP traduzidas, diálogos de plugins traduzidos.

---

## 🔜 Próximos passos (curto prazo)

1. **i18n completa do site** — dicionário EN para toda a interface do site (este release traz a infra-estrutura e a UI principal); docs/blog podem seguir para EN aos poucos.
2. **Publicar v1.4.19** nas lojas/releases com as notas de correção dos provedores de IA.
3. **Verificar o DuckDuckGo AI em dispositivo real** (o erro `hostOnly` foi corrigido na raiz, mas falta confirmação em rede móvel).
4. **Pagamentos:** PIX/QR Code e SDK de pagamento no site (junto com o painel admin de pagamentos).
5. **Migração Pollinations para enter.pollinations.ai** quando a API legacy for desligada — a camada `client.js` já isola os provedores, a troca é pontual.

## 💡 Ideias avaliadas (médio prazo)

- 💡 Mais provedores keyless à medida que surgirem serviços verificáveis (critério: funcionar sem chave, sem CORS no app e com limite razoável por IP).
- 💡 Port de mais plugins open-source do Acode (o fluxo de port já está dominado — 16 publicados).
- 💡 Colaboração em tempo real (CRDT) para partilhar projectos entre dispositivos.
- 💡 Assistant offline (modelos GGUF via webview) para dispositivos topo de gama.
- 💡 Deep links do site para o app (abrir ficheiro/repo directamente no XCoder).

---

## Como acompanhar

- **Releases assinados:** <https://github.com/carsaimz/xcoder/releases>
- **Marketplace de plugins:** <https://github.com/carsaimz/xcoder-plugins>
- **Site:** <https://xcoderapp.vercel.app>
- Votos e sugestões de prioridade: discussões do repositório.
