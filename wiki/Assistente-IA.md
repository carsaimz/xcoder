# Assistente de IA

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
