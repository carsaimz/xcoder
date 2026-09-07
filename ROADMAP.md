# Roadmap do XCoder

> Onde o XCoder está indo. Tudo aqui é **gratuito** — o Premium continua
> limitado a remover anúncios e ampliar os limites de IA.
> Itens marcados com 💡 vêm da comparação contínua com o upstream
> [Acode](https://github.com/Acode-Foundation/Acode) (CHANGELOG lido por
> completo até a v1.13.3).

## ✅ Concluído até a v1.5.3

- **v1.5.3 — polimento de UI + GitHub sem clientes próprios:** botões
  ←/→ removidos do header (Alt-←/→ e paleta mantidos); suportes de IA
  (texto/imagem/vídeo/agentes) em linha própria **abaixo** do modelo,
  com scroll lateral; ids de modelo normalizados sem o prefixo
  `models/` (Fireworks/OpenRouter intactos); sign-in do GitHub refeito
  (PAT primeiro + device flow oficial com client id embutido em
  `config.GH_OAUTH_CLIENT_ID` — ninguém cria OAuth App próprio) + guia
  `docs/github-oauth-app.md` (webhook/bot user id explicados);
  Dependabot agrupado por github-actions; +12 testes (581 → 593)
- Agente de IA com ferramentas, subagentes e streaming (pensamento
  expansível) + pílulas "Pensar"/"Buscar" que desligam de verdade
- Provedores **Integrados sem chave**: Pollinations (texto + imagem
  `/image`), DuckDuckGo AI — e logos REAIS de 16 marcas no chat e na
  página de provedores (modelo na frente do logo, faixa com scroll)
- Copiar mensagens à prova de WebView: plugin nativo → Clipboard API →
  execCommand; erros de IA/provedor 100% em pt (com placeholders
  interpolados, sem "{name}" literal)
- Editor multi-painel (split view) com abas por painel e foco por clique 💡
- Navegação por histórico de abas (Alt-←/→ + paleta; os botões ←/→ do
  header saíram na v1.5.3 por não terem utilidade prática) com feedback de
  beco sem saída e histórico persistente entre sessões 💡 (Acode v1.12.7)
- **Guia de indentação ativa** (opt-in, estilo VSCode) 💡 (Acode v1.11.5)
- Terminal Alpine (proot) com **auto-cura do modo FailSafe** (o Alpine
  volta sem desinstalar), banner explicativo e rootfs verificado
- Site embutido (aba Website), marketplace com 16+ plugins, página de
  apoio própria + conta compartilhada com o site (login único)
- **Site 100% bilíngue pt/en** — incluindo /user/*, submissão de plugins,
  tópico do fórum, corpo dos posts e das docs (variantes EN com troca no
  cliente, SSG)
- **Perfil com sessão reativa** (entrar/sair reflete na hora no gate /user)
- **Anúncio automático de release no fórum** (release estável → post do
  bot; pre-release não anuncia)
- Release assinado automático, build de preview por rótulo (app + site),
  CI com checagem de traduções e typos, Dependabot + bot de dependências
- v1.4.19–v1.5.1: hardening da IA (retry anônimo do Pollinations, cookie-
  jar à prova de corrupção), i18n de notificações/diálogos, CLI `acode`,
  hotfix do boot "Sidebar is not defined" com blindagem por app

## 🎯 Próximo (v1.6.x)

1. **Terminal SSH integrado** 💡 — sessões remotas salvas ao lado do SFTP
   (Acode v1.13.2 #2694).
2. **Console REPL JS isolado** 💡 — Web Worker sandbox com UX mobile
   (Acode v1.13.2 #2808).
3. **Gerenciador de fontes** 💡 — instalar fontes customizadas com
   atribuição separada editor/app (Acode v1.11.6/v1.12.0).
4. **Onboarding do terminal** — primeira execução mostra o que é o Alpine,
   o que é FailSafe e um botão "reinstalar ambiente" (hoje só o banner).
5. **Seletor de modelos com logos** — o select nativo do picker é
   texto-only; migrar para um picker próprio (lista com logo, badge
   free/pago e busca) reutilizando os SVGs de `providerLogos.js`.

## 🚀 Depois (v1.7+)

6. **Mais plugins portados do Acode** 💡 — linter, formatter (Prettier/
   Ruff), compilador Sass ao vivo, runner avançado, visualizador de
   documentos.
7. **API de plugins expandida** 💡 — ativar/desativar sem reiniciar,
   segredos seguros, ratings, exposição de pacotes CM6.
8. **Anúncios recompensados** 💡 — assistir um anúncio dá tempo extra sem
   anúncios; horário silencioso (Acode v1.12.0 #1918 / v1.11.8 #1779).
9. **Novos idiomas** — a infra bilíngue pt/en do site e do app abre caminho
   para es/fr (dicionários por área já estão modularizados).
10. **Painel do bot de release** — administrar os posts automáticos
    (editar/apagar o anúncio do release) na área /admin do site.

## 🧭 Direção contínua

- Manter o CI verde e a pt-br 100% traduzida (`npm run lang:check`).
- Verificar o CHANGELOG do Acode a cada release upstream e portar o que
  for útil (workflows, plugins, IA, editor).
- Nunca travar recursos atrás do Premium — doar é opcional.
