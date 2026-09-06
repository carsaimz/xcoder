# Roadmap do XCoder

> Onde o XCoder está indo. Tudo aqui é **gratuito** — o Premium continua
> limitado a remover anúncios e ampliar os limites de IA.
> Itens marcados com 💡 vêm da comparação contínua com o upstream
> [Acode](https://github.com/Acode-Foundation/Acode) (CHANGELOG lido por
> completo até a v1.13.3).

## ✅ Concluído até a v1.4.21

- Agente de IA com ferramentas, subagentes e streaming (pensamento expansível)
- Provedores **Integrados sem chave**: Pollinations (texto + imagem `/image`),
  DuckDuckGo AI (protocolo novo x-vqd-hash-1 + cookies)
- Chat estilo Claude/DeepSeek: avatares, botões abaixo do input, ações por
  pressionamento longo (copiar, regenerar, detalhar, resumir, continuar,
  inserir no editor)
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

## 🎯 Próximo (v1.5.x)

1. **CLI `acode` no terminal** 💡 — `acode open <arquivo>` dentro do proot
   abre o arquivo no editor (ponte terminal ↔ editor, estilo Acode v1.11.8).
2. **Rolagem de histórico de abas** — voltar/avançar entre abas recentes
   (atalho + botões) 💡 (Acode v1.12.7).
3. **Guia de indentação estilo VSCode** e **scroll-past-end configurável** 💡
   (extensões CM6 — Acode v1.11.5/v1.12.6).
4. **Traduções do site em pt/en** — infraestrutura lançada (dicionário
   PT→EN com fallback para pt, seletor no cabeçalho, preferência salva);
   estender a tradução para todas as páginas internas e docs.
5. **Automação de release**: o release assinado já é automático por bump
   de versão (auto-release.yml); falta o anúncio para a comunidade (site +
   fórum) e build de preview por label em PRs 💡.

## 🚀 Depois (v1.6+)

6. **Editor multi-painel (split view)** 💡 — dividir a área do editor lado a
   lado com abas arrastáveis (Acode v1.12.7 #2416) — o maior salto de UX.
7. **Terminal SSH integrado** 💡 — sessões remotas salvas ao lado do SFTP
   (Acode v1.13.2 #2694).
8. **Console REPL JS isolado** 💡 — Web Worker sandbox com UX mobile
   (Acode v1.13.2 #2808).
9. **Gerenciador de fontes** 💡 — instalar fontes customizadas com atribuição
   separada editor/app (Acode v1.11.6/v1.12.0).
10. **Mais plugins portados do Acode** 💡 — linter, formatter (Prettier/Ruff),
    compilador Sass ao vivo, runner avançado, visualizador de documentos.
11. **API de plugins expandida** 💡 — ativar/desativar sem reiniciar, segredos
    seguros, ratings, exposição de pacotes CM6.
12. **Anúncios recompensados** 💡 — assistir um anúncio dá tempo extra sem
    anúncios; horário silencioso (Acode v1.12.0 #1918 / v1.11.8 #1779).

## 🧭 Direção contínua

- Manter o CI verde e a pt-br 100% traduzida (`npm run lang:check`).
- Verificar o CHANGELOG do Acode a cada release upstream e portar o que for
  útil (workflows, plugins, IA, editor).
- Nunca travar recursos atrás do Premium — doar é opcional.
