# Solução de problemas / Troubleshooting

[🇧🇷 Português](#português) | [🇺🇸 English](#english)

---

<a id="português"></a>

## 🇧🇷 Português

Reúne os erros mais reportados e o caminho para resolver cada um. Se o seu problema não estiver aqui, abra uma issue com o template de bug (em português ou inglês) — quanto mais contexto (versão do app, modelo do aparelho, passos para reproduzir), mais rápido o conserto.

## Erro ao iniciar: "Cannot read properties of undefined (reading 'bind')"

**Causa**: nas versões anteriores a 1.4.3, um plugin interno tentava acessar a ponte do Cordova antes de ela existir em alguns aparelhos/WebViews, derrubando a inicialização.
**Solução**: atualize para a **v1.4.3 ou superior** ([[Instalacao]]). Se ainda ocorrer: **Sobre › toque 7 vezes na versão › menu dev › Limpar cache**, reinicie e, persistindo, reporte com o log copiado (o próprio menu dev tem "copiar build info").

## "Failed to load changelog" na página Sobre/Changelog

**Causa**: versões antigas buscavam o changelog do repositório errado (404).
**Solução**: a partir da v1.4.2 o app lê o `CHANGELOG.md` oficial e falha **em silêncio** quando está offline — você sempre verá o changelog local embutido. Sem rede, essa mensagem é esperada e inofensiva.

## Troca de idioma não aplica / traduções faltando

A partir da v1.4.2 a troca de idioma é **imediata** (sem reiniciar) e a primeira execução usa **português** quando o idioma do sistema não é reconhecido. Se você encontrar um texto sem tradução, reporte em uma issue — a varredura `npm run lang:check` compara os 31 idiomas contra o inglês e o português fica sempre em 100%.

## Git: login não conclui / "Bad credentials"

- Gere um novo login (**Sair** e **Entrar com GitHub** de novo) — códigos do device flow expiram em ~15 minutos.
- Verifique em [github.com/settings/applications](https://github.com/settings/applications) se o app não foi revogado.
- Rede corporativa/VPN podem bloquear o endpoint do OAuth; tente outra rede.
- Rate limit 403 sem login é normal: a cota anônima é compartilhada.

## IA: erro 401/404, respostas cortadas

Veja a seção de problemas na página [[Assistente-IA]] — na prática, 90% dos casos são token inválido (401) ou URL base errada (404).

## Terminal não abre ou fica em branco

- Feche e reabra o painel (``Ctrl-` ``).
- Alguns WebViews antigos falham com o xterm — atualize o **WebView do Android** (Play Store › Android System WebView) e reinicie o aparelho.
- Persistindo, reporte com o modelo do aparelho e versão do Android.

## App lento / cache grande

No menu de desenvolvedor (**Sobre › 7 toques na versão**) use **Limpar cache**. Projetos gigantes (node_modules!) abertos no explorador pesam — prefira abrir a pasta do código em si. O cache pode ser limpo com segurança: nenhum projeto ou configuração é apagado.

## Diagnóstico rápido — checklist do menu dev

1. **Sobre** → toque 7× no número da versão (menu oculto abre com uma vibração longa).
2. **Copiar build info** — cole na issue; traz versão, plataforma e build.
3. **Limpar cache** → **Reiniciar** — resolve a maioria dos estados estranhos.
4. **Console** — erros em vermelho aqui são a melhor pista para o bug report.

---

<a id="english"></a>

## 🇺🇸 English

This page gathers the most reported errors and the path to fix each one. If your problem is not here, open an issue with the bug template (in Portuguese or English) — the more context (app version, device model, steps to reproduce), the faster the fix.

## Startup error: "Cannot read properties of undefined (reading 'bind')"

**Cause**: in versions before 1.4.3, an internal plugin tried to access the Cordova bridge before it existed on some devices/WebViews, crashing startup.
**Fix**: update to **v1.4.3 or higher** ([[Instalacao|Installation]]). If it still happens: **About › tap the version 7 times › dev menu › Clear cache**, restart and, if it persists, report with the copied log (the dev menu itself has "copy build info").

## "Failed to load changelog" on the About/Changelog page

**Cause**: old versions fetched the changelog from the wrong repository (404).
**Fix**: since v1.4.2 the app reads the official `CHANGELOG.md` and fails **silently** when offline — you always see the embedded local changelog. Without network, this message is expected and harmless.

## Language switch not applying / missing translations

Since v1.4.2 the language switch is **immediate** (no restart) and first run uses **Portuguese** when the system language is not recognized. If you find untranslated text, report it in an issue — the `npm run lang:check` scan compares the 31 languages against English and Portuguese always stays at 100%.

## Git: login does not finish / "Bad credentials"

- Generate a fresh login (**Sign out** and **Sign in with GitHub** again) — device flow codes expire after ~15 minutes.
- Check [github.com/settings/applications](https://github.com/settings/applications) to see whether the app was revoked.
- Corporate networks/VPNs may block the OAuth endpoint; try another network.
- Rate limit 403 without login is normal: the anonymous quota is shared.

## AI: error 401/404, truncated responses

See the issues section on the [[Assistente-IA|AI assistant]] page — in practice, 90% of cases are an invalid token (401) or a wrong base URL (404).

## Terminal does not open or stays blank

- Close and reopen the panel (``Ctrl-` ``).
- Some older WebViews fail with xterm — update **Android System WebView** (Play Store) and restart the device.
- If it persists, report with the device model and Android version.

## Slow app / large cache

In the developer menu (**About › 7 taps on the version**) use **Clear cache**. Huge projects (node_modules!) opened in the explorer are heavy — prefer opening the actual code folder. The cache is safe to clear: no project or setting is deleted.

## Quick diagnosis — dev menu checklist

1. **About** → tap the version number 7× (hidden menu opens with a long vibration).
2. **Copy build info** — paste it into the issue; it carries version, platform and build.
3. **Clear cache** → **Restart** — solves most odd states.
4. **Console** — red errors here are the best clue for the bug report.
