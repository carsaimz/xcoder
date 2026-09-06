# Roadmap do XCoder

> Onde o XCoder está indo. Tudo aqui é **gratuito** — o Premium continua
> limitado a remover anúncios e ampliar os limites de IA.
> Itens marcados com 💡 vêm da comparação contínua com o upstream
> [Acode](https://github.com/Acode-Foundation/Acode) (CHANGELOG lido por
> completo até a v1.13.3).

## ✅ Concluído até a v1.4.22

- Agente de IA com ferramentas, subagentes e streaming (pensamento expansível)
- Provedores **Integrados sem chave**: Pollinations (texto + imagem `/image`),
  DuckDuckGo AI (protocolo novo x-vqd-hash-1 + cookies)
- Chat estilo Claude/DeepSeek: avatares, botões abaixo do input, ações por
  pressionamento longo (copiar, regenerar, detalhar, resumir, continuar,
  inserir no editor)
- Editor multi-painel (split view) com abas por painel e foco por clique 💡
  — disponível desde a v1.0.0 (atalhos `split-pane-right/down`)
- Página de apoio própria (não modal) + conta compartilhada com o site
- Site embutido (aba lateral Website), marketplace com 16+ plugins
- Terminal Alpine (proot) sem warnings de binding, menu dev em 2 toques
- CI com checagem de traduções e typos; Dependabot daily
- **v1.4.21 — correções e controlo rápido:** pílulas "Pensar" e "Buscar" no
  composer (a busca também libera web_search/read_url no modo chat); ao
  pensar aparece só "Pensando..." (processo completo recolhido); logos dos
  provedores + modelo na faixa do chat; scroll do painel de plugins
  corrigido (flexbox + handler); OAuth só aparece quando ativo (default-deny
  e marcas reais Google/GitHub); chave Pollinations expirada é ignorada com
  retry anônimo e erro explicativo; cookie-jar do plugin HTTP à prova de
  corrupção com auto-cura; scroll automático para a última mensagem ao
  abrir o chat; i18n das notificações LSP e dos diálogos de plugins;
  release automático por bump de versão (auto-release.yml) + bot semanal
  de dependências independente da Dependabot (deps-update.yml)
- **Pós-v1.4.22 (CI):** build de preview por rótulo espelhado no **site**
  (`preview-build.yml` no xcoder-web — typecheck + `next build` nos PRs
  rotulados `build`, com comentário fixo bilíngue no PR); CodeQL do site
  passa a ser **skip** enquanto o repositório é privado (o upload de code
  scanning exige Advanced Security, gratuito só em repos públicos — volta
  sozinho se o repo virar público); typos config corrigido (whitelist de
  palavras pt-br + exclusão de arquivos gerados) — CI 100% verde nos dois
  repositórios
- **v1.4.22 — CLI, histórico e cobertura total de idiomas:** comando
  **`acode` no terminal** (alias Acode-compatível do CLI `xcoder`, com
  subcomando `open <arquivo>`, `--version` e propagação versionada para
  instalações antigas) 💡 (Acode v1.11.8); **navegação por histórico de
  abas** — botões voltar/avançar no cabeçalho + atalhos `Alt-←`/`Alt-→`
  (com back-fill de atalhos novos para instalações existentes) 💡
  (Acode v1.12.7); **guias de indentação ligadas por padrão** (estilo
  VSCode; o scroll-past-end configurável já existia) 💡 (Acode
  v1.11.5/v1.12.6); **site 100% bilíngue pt/en** — todas as páginas
  internas convertidas (download, sponsor, marketplace, about, changelog,
  blog, docs, fórum, chat, stats, setup, user, admin, 404), 348 strings,
  zero chaves sem tradução; **build de preview por rótulo** — o rótulo
  `build` num PR dispara APK de teste (debug) com comentário fixo no PR
  (preview-build.yml)

## 🎯 Próximo (v1.5.x)

1. **Site i18n — última milha**: páginas de usuário logado
   (/user/donations, /user/plugins, /user/favorites, /user/forum,
   /user/profile, /user/settings), /marketplace/submit, /forum/[id],
   posts do blog e o corpo (markdown) das docs.
2. **Guia de indentação ativa** — destacar o nível de indentação da linha
   atual (hoje desligado por performance; opt-in nas configurações).
3. **Histórico de abas persistente** — sobreviver ao reinício do app
   (hoje o histórico recomeça vazio a cada sessão).
4. **Anúncio automático de release** — post no site/fórum quando uma
   versão estável é publicada (o release assinado já é automático).

## 🚀 Depois (v1.6+)

5. **Terminal SSH integrado** 💡 — sessões remotas salvas ao lado do SFTP
   (Acode v1.13.2 #2694).
6. **Console REPL JS isolado** 💡 — Web Worker sandbox com UX mobile
   (Acode v1.13.2 #2808).
7. **Gerenciador de fontes** 💡 — instalar fontes customizadas com atribuição
   separada editor/app (Acode v1.11.6/v1.12.0).
8. **Mais plugins portados do Acode** 💡 — linter, formatter (Prettier/Ruff),
   compilador Sass ao vivo, runner avançado, visualizador de documentos.
9. **API de plugins expandida** 💡 — ativar/desativar sem reiniciar, segredos
   seguros, ratings, exposição de pacotes CM6.
10. **Anúncios recompensados** 💡 — assistir um anúncio dá tempo extra sem
    anúncios; horário silencioso (Acode v1.12.0 #1918 / v1.11.8 #1779).

## 🧭 Direção contínua

- Manter o CI verde e a pt-br 100% traduzida (`npm run lang:check`).
- Verificar o CHANGELOG do Acode a cada release upstream e portar o que for
  útil (workflows, plugins, IA, editor).
- Nunca travar recursos atrás do Premium — doar é opcional.
