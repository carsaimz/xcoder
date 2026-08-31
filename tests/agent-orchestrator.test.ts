import { describe, expect, it } from 'vitest';
import { AgentOrchestrator } from '../src/core/agent/orchestrator';
import { Workspace } from '../src/core/file';
import { MemoryBackend } from '../src/core/file/memory';
import { Shell } from '../src/core/terminal/shell';
import { ChatMessage, ToolCallReq, ToolDef } from '../src/core/ai/types';

/** Scripted fake LLM — returns queued responses in order. */
function fakeClient(script: Array<Partial<ChatMessage>>) {
  let i = 0;
  const seen: Array<{ messages: ChatMessage[]; tools?: ToolDef[] }> = [];
  return {
    seen,
    chat(opts: { messages: ChatMessage[]; tools?: ToolDef[] }) {
      seen.push({ messages: opts.messages, tools: opts.tools });
      const next = script[i++ % script.length];
      const msg: ChatMessage = { role: 'assistant', content: next.content ?? '', toolCalls: next.toolCalls };
      return Promise.resolve(msg);
    },
  };
}

function makeDeps(client: ReturnType<typeof fakeClient>, confirmAnswer = true) {
  const ws = new Workspace();
  ws.mount(new MemoryBackend(), { root: 'file:///proj', label: 'proj' });
  const shell = new Shell(ws);
  const confirmations: string[] = [];
  const deps = {
    fs: ws,
    shell,
    getClient: () => client,
    getActiveModel: () => 'fake-model',
    confirm: async (req: { tool: string }) => {
      confirmations.push(req.tool);
      return confirmAnswer;
    },
    cwd: () => 'file:///proj',
  };
  return {
    deps,
    ws,
    confirmations,
  };
}

describe('agent orchestrator', () => {
  it('writes a file through tools and returns the final answer', async () => {
    const client = fakeClient([
      {
        content: 'I will create the file.',
        toolCalls: [{ id: 'c1', name: 'fs.write', arguments: JSON.stringify({ path: 'hi.txt', content: 'hello agent' }) }],
      },
      { content: 'Done — created hi.txt.' },
    ]);
    const { deps, ws } = makeDeps(client);
    const orch = new AgentOrchestrator(deps as never);
    const result = await orch.run('create hi.txt with hello agent');
    expect(result.ok).toBe(true);
    expect(result.output).toBe('Done — created hi.txt.');
    expect(result.steps).toBe(2);
    expect(await ws.readText('file:///proj/hi.txt')).toBe('hello agent');
    // tools were offered to the model
    expect(client.seen[0].tools?.some((t) => t.name === 'fs.write')).toBe(true);
    // tool result message was appended for the model
    expect(client.seen[1].messages.some((m) => m.role === 'tool' && m.content.includes('wrote'))).toBe(true);
  });

  it('dangerous tool without permission is denied and reported to the model', async () => {
    const client = fakeClient([
      { toolCalls: [{ id: 'c1', name: 'fs.write', arguments: '{"path":"x.txt","content":"y"}' }] },
      { content: 'understood.' },
    ]);
    const { deps } = makeDeps(client, false);
    const orch = new AgentOrchestrator(deps as never);
    const result = await orch.run('try to write');
    expect(result.ok).toBe(true);
    const toolMsg = client.seen[1].messages.find((m) => m.role === 'tool');
    expect(toolMsg?.content).toBe('denied by user');
  });

  it('unknown tool reports an error message instead of crashing', async () => {
    const client = fakeClient([
      { toolCalls: [{ id: 'c1', name: 'fs.notreal', arguments: '{}' }] },
      { content: 'noted.' },
    ]);
    const { deps } = makeDeps(client);
    const orch = new AgentOrchestrator(deps as never);
    const result = await orch.run('call a bogus tool');
    expect(result.ok).toBe(true);
    expect(client.seen[1].messages.find((m) => m.role === 'tool')?.content).toContain('unknown tool');
  });

  it('subagent run restricts the toolset (analyzer has no fs.write)', async () => {
    const client = fakeClient([{ content: 'analysis done' }]);
    const { deps } = makeDeps(client);
    const orch = new AgentOrchestrator(deps as never);
    const result = await orch.run('analyze', { subagent: 'analyzer' });
    expect(result.agent).toBe('analyzer');
    const offered = client.seen[0].tools?.map((t) => t.name) ?? [];
    expect(offered).not.toContain('fs.write');
    expect(offered).toContain('fs.read');
  });

  it('maxSteps produces a stopping message', async () => {
    const looping: ToolCallReq[] = [{ id: 'x', name: 'fs.list', arguments: '{"path":"."}' }];
    const client = fakeClient([{ toolCalls: looping }]);
    const { deps } = makeDeps(client);
    const orch = new AgentOrchestrator(deps as never);
    const result = await orch.run('loop forever', { maxSteps: 3 });
    expect(result.output).toContain('Stopped after 3 steps');
  });

  it('no provider → ok:false with clear message', async () => {
    const { deps, ws } = makeDeps(fakeClient([]));
    const brokenDeps = { ...deps, getClient: () => null };
    const orch = new AgentOrchestrator(brokenDeps as never);
    const result = await orch.run('anything');
    expect(result.ok).toBe(false);
    expect(result.output).toContain('no AI provider');
    void ws;
  });

  it('listSubagents exposes coder/analyzer/ops', () => {
    const { deps } = makeDeps(fakeClient([]));
    const orch = new AgentOrchestrator(deps as never);
    const names = orch.listSubagents().map((s) => s.name);
    expect(names).toEqual(['coder', 'analyzer', 'ops']);
  });
});
