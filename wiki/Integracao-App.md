# API de integração (backend e site) / Integration API (backend and website)

[🇧🇷 Português](#português) | [🇺🇸 English](#english)

---

<a id="português"></a>

## 🇧🇷 Português

O app consome serviços remotos **opcionais** para configuração, anúncios, changelog e marketplace. Há duas implementações compatíveis:

- **[carsaimz/xcoder-backend](https://github.com/carsaimz/xcoder-backend)** — backend dedicado (Node serverless na Vercel + espelho PHP para hospedagens gratuitas com PHP/MySQL).
- **[carsaimz/xcoder-web](https://github.com/carsaimz/xcoder-web)** — o site da comunidade, que serve os mesmos endpoints.

No app, aponte **Configurações › Backend URL** para a base de qualquer um deles. Tudo funciona sem isso — a configuração remota é uma conveniência que pode ser trocada sem publicar build nova.

## GET /api/config — configuração remota

```json
{
  "service": "xcoder-backend",
  "updatedAt": "2026-09-02T00:00:00.000Z",
  "marketplaceUrl": "https://raw.githubusercontent.com/carsaimz/xcoder-plugins/main/plugins.json",
  "changelog": { "repo": "carsaimz/xcoder", "branch": "main" },
  "announcements": [
    { "id": "boas-vindas", "level": "info", "message": "...", "url": "https://..." }
  ],
  "firebase": { "projectId": "...", "apiKey": "..." }
}
```

- `marketplaceUrl` — registro de plugins usado como fallback quando o usuário não define um próprio (prioridade: usuário > backend > padrão).
- `changelog` — repositório de onde o app lê o `CHANGELOG.md`.
- `announcements` — mensagens remotas (`level`: `info` | `warning` | `critical`, máximo 10), prontas para consumo pela UI.
- `firebase` — credenciais **externalizadas** (Task 9.3): nada de chaves hardcoded no app; os recursos de nuvem só ligam com o toggle do usuário.

O app aplica *stale-while-revalidate* de 30 minutos em cache local (`localStorage`) e **nunca bloqueia a inicialização** se o backend estiver fora.

## GET /api/plugins — registro do marketplace

Proxy do `plugins.json` oficial (com fallback jsDelivr), no mesmo formato que **Configurações › Marketplace URL** espera: lista de plugins com `id`, `name`, `description` (EN+PT), `version`, `author`, `icon`, `source` e `source_fallback`.

## GET /api/changelog — changelog

Proxy do `CHANGELOG.md` branco do repo configurado — mesmo conteúdo da página **Sobre › Changelog**.

## Site da comunidade (xcoder-web)

O site adiciona, além dos endpoints acima, superfícies de leitura e integração:

| Endpoint | Uso |
|---|---|
| `/api/app/config` | mesmo contrato de `/api/config` acima |
| `/api/app/announcements` | anúncios atuais (JSON) |
| `/api/app/changelog` | changelog + última release (JSON) |
| `/api/app/plugins` | registro do marketplace |
| `/api/stats` | métricas públicas do repo (stars, forks, contribuidores) |
| `/api/forum` | discussões recentes do fórum (GitHub Discussions) |

Documentação viva desses endpoints: seção **Docs › Integração do app** no site.

## Variáveis de ambiente do backend

| Variável | Função |
|---|---|
| `XCODER_MARKETPLACE_URL` | registro de plugins alternativo |
| `XCODER_REPO` / `XCODER_BRANCH` | repo/branch do changelog |
| `XCODER_ANNOUNCEMENTS` | JSON array de anúncios |
| `XCODER_FIREBASE_PROJECT_ID` / `XCODER_FIREBASE_API_KEY` | credenciais Firebase externalizadas |

## Por que PHP+MySQL e Vercel?

O backend histórico mantém **as duas vias**: endpoints em Node (Vercel — recomendado, APIs serverless, deploy via GitHub, HTTPS e cache de borda) e espelho **PHP** para hospedagens gratuitas tipo iFastNet/InfinityFree (quem já tem MySQL e quiser banco próprio). O site da comunidade ([xcoder-web](https://github.com/carsaimz/xcoder-web)) roda em **Vercel + Next.js** e usa o GitHub como CMS — sem banco para operar, custo zero e integração nativa com o repositório.

---

<a id="english"></a>

## 🇺🇸 English

The app consumes **optional** remote services for config, announcements, changelog and marketplace. There are two compatible implementations:

- **[carsaimz/xcoder-backend](https://github.com/carsaimz/xcoder-backend)** — dedicated backend (Node serverless on Vercel + a PHP mirror for free PHP/MySQL hosting).
- **[carsaimz/xcoder-web](https://github.com/carsaimz/xcoder-web)** — the community website, which serves the same endpoints.

In the app, point **Settings › Backend URL** to the base of either one. Everything works without it — remote config is a convenience that can be swapped without publishing a new build.

## GET /api/config — remote config

```json
{
  "service": "xcoder-backend",
  "updatedAt": "2026-09-02T00:00:00.000Z",
  "marketplaceUrl": "https://raw.githubusercontent.com/carsaimz/xcoder-plugins/main/plugins.json",
  "changelog": { "repo": "carsaimz/xcoder", "branch": "main" },
  "announcements": [
    { "id": "welcome", "level": "info", "message": "...", "url": "https://..." }
  ],
  "firebase": { "projectId": "...", "apiKey": "..." }
}
```

- `marketplaceUrl` — plugin registry used as fallback when the user does not set their own (priority: user > backend > default).
- `changelog` — repository the app reads `CHANGELOG.md` from.
- `announcements` — remote messages (`level`: `info` | `warning` | `critical`, max 10), ready for UI consumption.
- `firebase` — **externalized** credentials (Task 9.3): no hardcoded keys in the app; cloud features only switch on with the user's toggle.

The app applies 30-minute *stale-while-revalidate* caching in local storage (`localStorage`) and **never blocks startup** if the backend is down.

## GET /api/plugins — marketplace registry

Proxy of the official `plugins.json` (with jsDelivr fallback), in the same format **Settings › Marketplace URL** expects: a list of plugins with `id`, `name`, `description` (EN+PT), `version`, `author`, `icon`, `source` and `source_fallback`.

## GET /api/changelog — changelog

Proxy of the configured repo's raw `CHANGELOG.md` — same content as the **About › Changelog** page.

## Community website (xcoder-web)

On top of the endpoints above, the website adds reading and integration surfaces:

| Endpoint | Purpose |
|---|---|
| `/api/app/config` | same contract as `/api/config` above |
| `/api/app/announcements` | current announcements (JSON) |
| `/api/app/changelog` | changelog + latest release (JSON) |
| `/api/app/plugins` | marketplace registry |
| `/api/stats` | public repo metrics (stars, forks, contributors) |
| `/api/forum` | recent forum threads (GitHub Discussions) |

Living documentation for these endpoints: the **Docs › App integration** section on the website.

## Backend environment variables

| Variable | Purpose |
|---|---|
| `XCODER_MARKETPLACE_URL` | alternative plugin registry |
| `XCODER_REPO` / `XCODER_BRANCH` | changelog repo/branch |
| `XCODER_ANNOUNCEMENTS` | JSON array of announcements |
| `XCODER_FIREBASE_PROJECT_ID` / `XCODER_FIREBASE_API_KEY` | externalized Firebase credentials |

## Why PHP+MySQL and Vercel?

The historical backend keeps **both paths**: Node endpoints (Vercel — recommended, serverless APIs, deploy via GitHub, HTTPS and edge caching) and a **PHP** mirror for free hosts like iFastNet/InfinityFree (for those who already have MySQL and want their own database). The community website ([xcoder-web](https://github.com/carsaimz/xcoder-web)) runs on **Vercel + Next.js** and uses GitHub as its CMS — no database to operate, zero cost and native integration with the repository.
