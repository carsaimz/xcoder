# AI Agent & Subagent System

The XCoder agent turns the editor into an autonomous coding assistant. It plans, calls
tools, asks for permission before anything destructive, and reports a summary.

## Anatomy

```
src/core/agent/
├── types.ts         AgentTool / ToolContext / AgentEvent / SubagentDef contracts
├── tools.ts         the 17 builtin tools (fs, code, git, exec, agent, app)
├── analyze.ts       regex-based code outline (imports/classes/functions/TODOs)
├── subagents.ts     coder / analyzer / ops definitions
├── orchestrator.ts  the reasoning loop (LLM ⇄ tools)
├── python.ts        Pyodide loader (lazy, CDN)
└── index.ts         facade wired to settings + providers + permissions
```

## The loop

1. The user task and a system prompt (persona + working directory + rules) go to the LLM
   **with the tool catalog** (JSON-schema parameters, provider-mapped automatically).
2. The model answers with text, or with tool calls.
3. For each tool call:
   - the UI receives a `tool-call` event (rendered as a card),
   - dangerous tools raise a **permission request** (Allow / Always allow / Deny),
   - the tool runs; output is truncated to 6000 chars and appended as a `tool` message,
   - the UI receives `tool-result`.
4. Repeat until the model produces a final answer or `maxSteps` (default 25) is reached.

Failures never crash the run: unknown tools and tool errors are reported back to the model
as error text so it can adapt; aborting (`AbortController`) stops at the next model call.

## Tools

| Tool | Kind | Description |
| --- | --- | --- |
| `fs.read` `{path}` | read | file content (truncated at 24k chars) |
| `fs.list` `{path}` | read | directory children, `[dir]`/`[file]` prefixed |
| `fs.search` `{query}` | read | content grep under the working directory |
| `code.analyze` `{path}` | read | outline: language, imports, classes, functions, exports, TODOs |
| `app.info` | read | roots, cwd, open tabs, active provider/model |
| `fs.write` `{path, content}` | ⚠ write | create/overwrite (parents auto-created) |
| `fs.append` `{path, content}` | ⚠ write | append to a file |
| `fs.delete` `{path, recursive?}` | ⚠ write | delete file/dir |
| `fs.mkdir` `{path}` | ⚠ write | create directory tree |
| `code.edit` `{path, edits[{find, replace, replaceAll?}]}` | ⚠ write | exact find→replace edits; **fails without writing if any `find` is missing** |
| `git.status` / `git.log` / `git.diff` | read | working tree state, history, unstaged diff |
| `git.add` `{paths}` | ⚠ write | stage files (`.` for everything) |
| `git.commit` `{message}` | ⚠ write | conventional-commit style messages |
| `git.branch` `{name?}` | write | list or create |
| `git.checkout` `{name, create?}` | ⚠ write | switch branches (materializes the tree) |
| `exec.run` `{runtime, command?/code?}` | ⚠ write | `bash` = virtual shell line/script, `js` = sandboxed Function with captured console, `python` = Pyodide (first call downloads the runtime) |
| `agent.spawn` `{subagent, task}` | — | delegate to `coder` / `analyzer` / `ops` |

## Subagents

| Name | Tools | Typical task |
| --- | --- | --- |
| `coder` | full fs/code/git + exec | “implement feature X in files Y” |
| `analyzer` | fs.read/list/search, code.analyze, git history | “review module Z and list risks” |
| `ops` | exec.run + minimal fs | “run the tests and summarize output” |

The main agent spawns them via `agent.spawn`; you can also start a run **as** a subagent
from the mode chips in the agent panel (main / coder / analyzer / ops).

## Permissions

`agents.permissions` (settings → Agent → permission mode):

- `ask` (default) — every dangerous call raises `bus` event `agent:permission`
  with `{req, resolve}`; the agent panel shows the 3-button dialog. *Always allow*
  remembers the decision per tool for the session; **New chat** clears memory.
- `auto` — everything is allowed (for trusted local models/Ollama or CI-like use).

The event contract (for custom UIs):

```js
window.xcoder.require('bus').on('agent:permission', ({ req, resolve }) => {
  // req: {tool, action, path?, summary}
  resolve('allow' | 'always' | 'deny');
});
```

## Configuring providers

The agent needs an active provider (Settings → AI providers):

- **Free** — Groq, Cerebras, OpenRouter `:free`, Hugging Face Router, GitHub Models, Ollama (local, no key);
- **Paid with free tier** — OpenAI, Anthropic, Gemini, Mistral, DeepSeek, Together, Cohere;
- **Premium** — Azure OpenAI, AWS Bedrock (via OpenAI-compatible gateway), Google Vertex, IBM watsonx;
- **Custom** — any OpenAI-compatible base URL.

Each profile stores `api` (`openai` | `anthropic` | `gemini`), `baseURL`, `apiKey`, `model`
and optional extra headers. **Test connection** hits the vendor's cheap endpoint (`/models`
or a 1-token ping). API keys stay in the device's IndexedDB and are sent only to the
provider you configured.

Example with the facade:

```js
const ai = window.xcoder.require('ai');
ai.providers.addProfile({ presetId: 'groq', apiKey: 'gsk_…' });
ai.providers.setActive(ai.providers.list()[0].id);

await window.xcoder.require('agents').run(
  'analyze src/lib/path.ts and summarize its edge cases',
  { subagent: 'analyzer' },
);
```

## Running headless (tests/CI)

The orchestrator takes injected dependencies (`fs`, `shell`, `getClient`, `confirm`, `cwd`),
so the whole loop is testable without a browser or network — see
`tests/agent-orchestrator.test.ts` for a scripted fake provider covering tool calls,
permission denial, unknown tools, subagent toolset restriction and max-steps.
