# XCoder Ads — decisão, formato e como trocar por Unity Ads
# XCoder Ads — decision, format and how to switch to Unity Ads

[🇧🇷 Português](#português) | [🇺🇸 English](#english)

---

<a id="português"></a>

## 🇧🇷 Português

## Decisão: House Ads agora, Unity Ads opcional depois

O XCoder usa **House Ads** como sistema de anúncios padrão (sem AdMob).
A razão da escolha, comparando com Unity Ads:

| Critério | House Ads (atual) | Unity Ads |
|---|---|---|
| Receita imediata | ❌ nenhuma (promove o próprio ecossistema: site, plugins, Premium) | ✅ eCPM real (US$ 2–12 por 1000 impressões em mercados Tier-1) |
| Configuração | ✅ zero — já funciona (site serve os anúncios) | ❌ requer conta Unity, Game ID, SDK nativo e revisão |
| Requisitos da loja | ✅ sem SDK de terceiros, leve, F-Droid friendly | SDK ~1 MB, políticas Unity/Google adicionais |
| Controle do conteúdo | ✅ total (você edita no site, tabela `ads`) | ❌ anúncios de redes externas |
| Volume mínimo p/ valer a pena | irrelevante | ~10k+ usuários ativos/dia |

**Conclusão prática**: Unity Ads rende *dinheiro de verdade* quando há
volume; House Ads rende *usuários do Premium* (que é onde o projeto
monetiza hoje com pouco tráfego). Por isso os dois foram desenhados para
coexistir: enquanto o tráfego é pequeno, House Ads + doações rendem mais;
quando houver volume, o Unity Ads entra por baixo dos panos **sem mudar
uma linha do app** (ver abaixo).

> Premium sempre vence: apoiadores nunca veem nenhum tipo de anúncio
> (`adsAvailable()` checa `isPremium()` primeiro).

## Como funciona hoje (House Ads)

- **Fonte**: `GET {site}/api/app/ads` (xcoder-web) → tabela `ads` do
  Supabase quando configurada, senão lista estática. Cache de 6 h.
- **Formatos**:
  - banner discreto no welcome (`ads.createBanner("welcome")`);
  - interstitial em pontos naturais (`helpers.showAd()`), com caps
    anti-abuso: primeiras 3 aberturas limpas, no máx. 1 interstitial a
    cada 4 aberturas, mínimo de 20 h entre exibições, nunca durante IA.
- **Código**: `src/lib/ads.js`. Sem SDK — é HTML renderizado no app.

### Gerenciar os anúncios da casa

1. Configure o Supabase do site (ou use o assistente `/setup`) e rode o schema.
2. No site, entre em **/admin › Anúncios (app)** e crie/edite os anúncios:
   `format` (`banner`|`interstitial`), `title`, `body`, `url`, `cta`,
   `active` — CRUD completo, sem tocar no banco. (Alternativa: inserir
   linhas direto na tabela `ads` via Studio.)
3. As caps de frequência ficam em `/api/app/ads` (env
   `XCODER_ADS_EVERY_OPENS`, `XCODER_ADS_MIN_GAP_HOURS`) e podem ser
   ajustadas em **/admin › Configurações**.

## Como ativar o Unity Ads depois (quando houver volume)

O `lib/ads.js` já tem o ponto de extensão `registerNativeProvider()`:
o provedor nativo registrado **ganha automaticamente** as exibições
(banner e interstitial) e herda as mesmas caps anti-abuso + o corte do
Premium. Nada mais muda no app.

1. **Conta**: crie em <https://unity.com/products/ads> e adicione um
   projeto Android → anote o **Game ID**.
2. **Plugin**: adicione um plugin Cordova que exponha o SDK do Unity
   (ex.: `cordova-plugin-unityads` ou um fork próprio) e instale o
   Game ID no `config.xml` (preference `UNITY_GAME_ID`).
3. **Registro** (em `src/main.js`, dentro do `onDeviceReady`):

   ```js
   import { registerNativeProvider } from "lib/ads";

   registerNativeProvider("unityads", {
       showBanner: async (slot) => {
           // chama o plugin nativo e devolve um elemento com o banner
           // (ou null para cair no house ad)
       },
       showInterstitial: async (reason) => {
           // chama o plugin nativo; devolva true quando exibir
       },
   });
   ```

4. **Placements**: crie `interstitial` e `banner` no painel Unity; comece
   em **test mode** e habilite produção só quando o fluxo estiver
   validado no aparelho.
5. **Regra de ouro**: se o plugin falhar ou não carregar, devolva
   `null`/`false` — o fallback para House Ads é automático.

---

<a id="english"></a>

## 🇺🇸 English

## Decision: House Ads now, Unity Ads optionally later

XCoder ships **House Ads** as the default ads system (no AdMob). Why,
compared with Unity Ads:

| Criterion | House Ads (current) | Unity Ads |
|---|---|---|
| Immediate revenue | ❌ none (promotes our own ecosystem: site, plugins, Premium) | ✅ real eCPM (US$ 2–12 per 1000 impressions in Tier-1 markets) |
| Setup | ✅ zero — already works (the site serves the ads) | ❌ needs a Unity account, Game ID, native SDK and review |
| Store requirements | ✅ no third-party SDK, light, F-Droid friendly | ~1 MB SDK, extra Unity/Google policies |
| Content control | ✅ full (edit on the site, `ads` table) | ❌ external network ads |
| Minimum traffic to matter | irrelevant | ~10k+ daily active users |

**Practical takeaway**: Unity Ads earns *real money* once you have volume;
House Ads earns *Premium users* (where this project actually monetizes with
low traffic). That is why both were designed to coexist: while traffic is
small, House Ads + donations pay off better; once volume arrives, Unity Ads
plugs in under the hood **without changing a single line of the app** (see
below).

> Premium always wins: supporters never see any ads at all
> (`adsAvailable()` checks `isPremium()` first).

## How it works today (House Ads)

- **Source**: `GET {site}/api/app/ads` (xcoder-web) → the Supabase `ads`
  table when configured, otherwise a static list. 6 h cache.
- **Formats**:
  - a small banner on the welcome page (`ads.createBanner("welcome")`);
  - interstitials at natural points (`helpers.showAd()`), with anti-abuse
    caps: first 3 opens are clean, at most 1 interstitial every 4 opens,
    at least 20 h between shows, never during AI runs.
- **Code**: `src/lib/ads.js`. No SDK — it is HTML rendered in the app.

### Managing the house ads

1. Configure the site's Supabase (or use the `/setup` assistant) and run the schema.
2. On the site, open **/admin › Anúncios (app)** and create/edit ads:
   `format` (`banner`|`interstitial`), `title`, `body`, `url`, `cta`,
   `active` — full CRUD, no database access needed. (Alternative: insert
   rows directly into the `ads` table via Studio.)
3. Frequency caps live in `/api/app/ads` (env `XCODER_ADS_EVERY_OPENS`,
   `XCODER_ADS_MIN_GAP_HOURS`) and can be tuned in **/admin › Configurações**.

## Enabling Unity Ads later (when there is volume)

`lib/ads.js` already ships the `registerNativeProvider()` extension point:
the registered native provider **automatically wins** the impressions
(banner and interstitial) and inherits the same anti-abuse caps plus the
Premium cut. Nothing else changes in the app.

1. **Account**: create one at <https://unity.com/products/ads> and add an
   Android project → note the **Game ID**.
2. **Plugin**: add a Cordova plugin exposing the Unity SDK (e.g.
   `cordova-plugin-unityads` or your own fork) and set the Game ID in
   `config.xml` (preference `UNITY_GAME_ID`).
3. **Register** (in `src/main.js`, inside `onDeviceReady`):

   ```js
   import { registerNativeProvider } from "lib/ads";

   registerNativeProvider("unityads", {
       showBanner: async (slot) => {
           // call the native plugin and return an element with the banner
           // (or null to fall back to the house ad)
       },
       showInterstitial: async (reason) => {
           // call the native plugin; return true when it was shown
       },
   });
   ```

4. **Placements**: create `interstitial` and `banner` in the Unity
   dashboard; start in **test mode** and enable production only after the
   flow is validated on a real device.
5. **Golden rule**: if the plugin fails or does not load, return
   `null`/`false` — falling back to House Ads is automatic.

p = pathlib.Path('docs/ADS.md')
