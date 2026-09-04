# XCoder Ads — decisão, formato e como trocar por Unity Ads

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
