# Roadmap do XCoder

> Onde o XCoder está indo. Tudo aqui é **gratuito** — o Premium continua
> limitado a remover anúncios e ampliar os limites de IA.
> Itens marcados com 💡 vêm da comparação contínua com o upstream
> [Acode](https://github.com/Acode-Foundation/Acode) (CHANGELOG lido por
> completo até a v1.13.3).

## ✅ Concluído até a v1.6.0

- **v1.6.0 — roadmap v1.6.x completo + fix do sign-in GitHub:**
  - **Sessões SSH** (item 1): página própria lista os servidores SFTP
    salvos e abre o terminal remoto com um toque (credenciais ficam no
    perfil nativo SFTP; atalho para adicionar novos)
  - **Console JS** (item 2): novo app da sidebar — REPL real (valor da
    última expressão, console capturado, histórico ↑/↓) rodando num
    **Web Worker em sandbox** (sem DOM, sem Cordova — experimentos não
    derrubam o editor)
  - **Gerenciador de fontes** (item 3): instale fontes por URL
    (.ttf/.otf/.woff2, baixadas para DATA/fonts e cacheadas) e aplique
    ao editor e à interface separadamente; remove e lista as instaladas
  - **Onboarding do terminal** (item 4): na primeira abertura, explica
    Alpine × FailSafe e oferece "Reinstalar ambiente" num toque
  - **Fix crítico do Device Flow**: o resultado de `pollForToken()` era
    destruturado como objeto → sessão salvava VAZIA ("conectou" mas sem
    conta nem repositórios); agora o token é consumido como string, o
    perfil falha graciosamente e a sessão sem token é rejeitada; perfil
    via plugin nativo (CORS-free); o card da conta da sidebar Git atualiza
    na hora quando a sessão muda
  - +19 testes (611 → 630); pt-br 100%
- **v1.5.4 — GitHub App oficial + model picker com logos:** o Client ID
  do GitHub App do mantenedor vem embutido (Device Flow de fábrica, sem
  clientes próprios; GitHub Apps não usam `scope`) e o seletor de
  modelos ganhou picker próprio: logo real por marca, badge grátis/pago,
  ✓ no modelo atual e busca instantânea (grupos vazios somem)
- **v1.5.3 — polimento de UI + GitHub sem clientes próprios:** botões
  ←/→ removidos do header (Alt-←/→ e paleta mantidos); suportes de IA
  (texto/imagem/vídeo/agentes) em linha própria **abaixo** do modelo,
  com scroll lateral; ids de modelo normalizados sem o prefixo
  `models/` (Fireworks/OpenRouter intactos); sign-in do GitHub refeito
  (PAT primeiro + device flow oficial) + guia `docs/github-oauth-app.md`;
  Dependabot agrupado por github-actions
- Agente de IA com ferramentas, subagentes e streaming (pensamento
  expansível) + pílulas "Pensar"/"Buscar" que desligam de verdade
- Provedores **Integrados sem chave**: Pollinations (texto + imagem
  `/image`), DuckDuckGo AI — e logos REAIS de 16 marcas no chat e na
  página de provedores (modelo na frente do logo, faixa com scroll)
- Copiar mensagens à prova de WebView: plugin nativo → Clipboard API →
  execCommand; erros de IA/provedor 100% em pt (com placeholders
  interpolados, sem "{name}" literal)
- Editor multi-painel (split view) com abas por painel e foco por clique 💡
- Navegação por histórico de abas (Alt-←/→ + paleta) com feedback de
  beco sem saída e histórico persistente entre sessões 💡 (Acode v1.12.7)
- **Guia de indentação ativa** (opt-in, estilo VSCode) 💡 (Acode v1.11.5)
- Terminal Alpine (proot) com **auto-cura do modo FailSafe** (o Alpine
  volta sem desinstalar), banner explicativo e rootfs verificado
- Site embutido (aba Website), marketplace com 16+ plugins, página de
  apoio própria + conta compartilhada com o site (login único)
- **Site 100% bilíngue pt/en** — incluindo /user/*, submissão de plugins,
  tópico do fórum, corpo dos posts e das docs (variantes EN com troca no
  cliente, SSG)
- **Perfil com sessão reativa** (entrar/sair reflete na hora no gate /user;
  re-sync ao voltar da aba congelada — bfcache/WebView em fundo)
- **Anúncio automático de release no fórum** (release estável → post do
  bot; pre-release não anuncia)
- Release assinado automático, build de preview por rótulo (app + site),
  CI com checagem de traduções e typos, Dependabot + bot de dependências
- v1.4.19–v1.5.1: hardening da IA (retry anônimo do Pollinations, cookie-
  jar à prova de corrupção), i18n de notificações/diálogos, CLI `acode`,
  hotfix do boot "Sidebar is not defined" com blindagem por app

## 🎯 Próximo (v1.7.x)

1. **Mais plugins portados do Acode** 💡 — linter, formatter (Prettier/
   Ruff), compilador Sass ao vivo, runner avançado, visualizador de
   documentos.
2. **API de plugins expandida** 💡 — ativar/desativar sem reiniciar,
   segredos seguros, ratings, exposição de pacotes CM6.
3. **Console REPL v2** — snippets salvos, import de módulos do workspace
   no sandbox (via Blob/URL), histórico persistente entre sessões.
4. **Sessões SSH v2** — nome do servidor com favicon/cores, histórico de
   comandos por host, diretório inicial configurável no perfil.
5. **Fontes v2** — preview visual antes de aplicar, import por arquivo
   local (além de URL), variação de peso (bold/black) no editor.

## 🚀 Depois (v1.8+)

6. **Anúncios recompensados** 💡 — assistir um anúncio dá tempo extra sem
   anúncios; horário silencioso (Acode v1.12.0 #1918 / v1.11.8 #1779).
7. **Novos idiomas** — a infra bilíngue pt/en do site e do app abre caminho
   para es/fr (dicionários por área já estão modularizados).
8. **Painel do bot de release** — administrar os posts automáticos
   (editar/apagar o anúncio do release) na área /admin do site.
9. **Colaboração/backup** — sincronizar settings + sessões de IA via
   ghBackend já existente (backup/restore agendado, diff visual).
10. **Editor de temas avançado** — editor visual de tokens (fundo,
    primária, syntax colors) com export/import JSON compartilhável.

## 🧭 Direção contínua

- Manter o CI verde e a pt-br 100% traduzida (`npm run lang:check`).
- Verificar o CHANGELOG do Acode a cada release upstream e portar o que
  for útil (workflows, plugins, IA, editor).
- Nunca travar recursos atrás do Premium — doar é opcional.
