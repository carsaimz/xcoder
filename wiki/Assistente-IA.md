# Assistente de IA / AI assistant

[🇧🇷 Português](#português) | [🇺🇸 English](#english)

---

<a id="português"></a>

## 🇧🇷 Português

O XCoder traz um **chat de IA na barra lateral** que conversa com qualquer modelo via API — sem intermediários, sem assinatura do app: você usa as suas próprias chaves dos provedores que já conhece.

## Provedores suportados

20 integrações prontas, organizadas por nível:

| Nível | Provedores |
|---|---|
| **Grátis** | Groq Cloud, OpenRouter (free models), Cloudflare Workers AI, GitHub Models |
| **Free tier** | Google Gemini, Cerebras Inference, Hugging Face Inference, Mistral AI, Together AI, Cohere, Fireworks AI |
| **Premium** | OpenAI, Anthropic Claude, DeepSeek, xAI Grok, Perplexity, Azure OpenAI, NVIDIA NIM, OpenRouter (all models) |
| **Custom** | Qualquer endpoint **compatível com OpenAI** (incluindo servidores locais como Ollama ou LM Studio, se o aparelho/PC expuser a API) |

Cada provedor aparece com um **selo de nível** (verde = Grátis, azul = Free tier, dourado = Premium) na lista de configuração e no cabeçalho do chat.

## Configurando um provedor

1. Abra **Configurações (Ctrl-,) › IA › Provedores** e toque em **novo provedor**.
2. Preencha **nome**, **URL base** (pré-preenchida para os provedores conhecidos) e **token** da API.
3. Toque em **Buscar modelos disponíveis** — o botão consulta o endpoint `/models` do provedor e lista o que existe; escolha o modelo padrão.
4. Ajuste os dois controles finos:
   - **Autonomia** — Baixo (verde), Médio (amarelo) ou Alto (vermelho): o quanto o assistente pode fazer sem confirmar cada passo.
   - **Max tokens** — slider de 256 a 8192 (passo 128), sincronizado com o campo numérico ao lado.

O token é salvo **apenas no armazenamento local do app** e só é enviado ao endpoint do próprio provedor. Nada passa por servidores do XCoder.

## Usando o chat

Abra o app **IA** na barra lateral (`Ctrl-B` se estiver fechada). O chat tem conhecimento do **arquivo aberto** como contexto; dicas de uso:

- Peça explicações de trecho selecionado, refatorações, geração de funções e correção de erros apontados em **Problemas** (`Ctrl-Shift-M`).
- Em autonomia **Alta**, o assistente pode executar ações por você — comece em **Baixo** até confiar no fluxo.
- Os selos no cabeçalho mostram qual provedor/modelo está respondendo; troque de provedor a qualquer momento nas configurações.

## Problemas comuns

- **Erro 401** — token inválido ou revogado; gere um novo no painel do provedor.
- **Erro 404 ao buscar modelos** — URL base errada (deve terminar em `/v1` na maioria dos endpoints compatíveis com OpenAI).
- **Respostas cortadas** — aumente **Max tokens**; se o provedor aplicar limite próprio, o valor efetivo é o menor.
- **Provedor não aparece** — confirme que o nível do provedor não está oculto nos filtros e que a URL base está correta.

Veja também [[Solucao-de-Problemas]] para o diagnóstico geral.

---

<a id="english"></a>

## 🇺🇸 English

XCoder ships with an **AI chat in the sidebar** that talks to any model via API — no middlemen, no app subscription: you use your own keys from the providers you already know.

## Supported providers

20 ready integrations, organized by tier:

| Tier | Providers |
|---|---|
| **Free** | Groq Cloud, OpenRouter (free models), Cloudflare Workers AI, GitHub Models |
| **Free tier** | Google Gemini, Cerebras Inference, Hugging Face Inference, Mistral AI, Together AI, Cohere, Fireworks AI |
| **Premium** | OpenAI, Anthropic Claude, DeepSeek, xAI Grok, Perplexity, Azure OpenAI, NVIDIA NIM, OpenRouter (all models) |
| **Custom** | Any **OpenAI-compatible endpoint** (including local servers such as Ollama or LM Studio, if the device/PC exposes the API) |

Each provider shows a **tier badge** (green = Free, blue = Free tier, gold = Premium) in the settings list and in the chat header.

## Setting up a provider

1. Open **Settings (Ctrl-,) › AI › Providers** and tap **new provider**.
2. Fill in the **name**, **base URL** (pre-filled for known providers) and API **token**.
3. Tap **Fetch available models** — the button queries the provider's `/models` endpoint and lists what exists; pick the default model.
4. Adjust the two fine controls:
   - **Autonomy** — Low (green), Medium (yellow) or High (red): how much the assistant may do without confirming each step.
   - **Max tokens** — slider from 256 to 8192 (step 128), synced with the numeric field beside it.

The token is stored **only in the app's local storage** and is sent exclusively to the provider's own endpoint. Nothing goes through XCoder servers.

## Using the chat

Open the **AI** app in the sidebar (`Ctrl-B` if it is closed). The chat knows the **open file** as context; usage tips:

- Ask for explanations of a selected snippet, refactors, function generation and fixes for errors flagged under **Problems** (`Ctrl-Shift-M`).
- At **High** autonomy the assistant can perform actions for you — start at **Low** until you trust the flow.
- The badges in the header show which provider/model is answering; switch providers anytime in the settings.

## Common issues

- **Error 401** — invalid or revoked token; generate a new one in the provider's dashboard.
- **Error 404 when fetching models** — wrong base URL (it should end in `/v1` on most OpenAI-compatible endpoints).
- **Truncated responses** — increase **Max tokens**; if the provider enforces its own limit, the effective value is the lower one.
- **Provider not showing up** — confirm the provider tier is not hidden by filters and that the base URL is correct.

See also [[Solucao-de-Problemas|Troubleshooting]] for the general diagnosis.
