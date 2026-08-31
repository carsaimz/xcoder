/**
 * AI chat panel — conversations with agents & subagents.
 *
 * UX: full-height bottom-sheet/drawer over the editor, mobile-first.
 * Live streaming, tool-call cards with permission gates, subagent nesting,
 * session management and markdown-lite rendering.
 */

import { el, $, $maybe, clearNode, iconSvg } from '@lib/dom';
import { i18n } from '@lib/i18n';
import { settings } from '@api/settings';
import { dialog } from '@api/dialog';
import { toast } from '@api/toast';
import { editorManager } from '@api/editorManager';
import { aiManager, type ApprovalRequest } from '@core/ai/manager';
import { AGENTS, type AgentId } from '@core/ai/agents';
import type { AiMessage } from '@core/ai/client';

let mounted = false;
let liveRoot: HTMLElement | null = null;
let messagesEl: HTMLElement | null = null;
let agentSelect: HTMLSelectElement | null = null;
let modelChip: HTMLElement | null = null;
let sessionTitleEl: HTMLElement | null = null;
let sendBtn: HTMLButtonElement | null = null;
let stopBtn: HTMLButtonElement | null = null;
let inputEl: HTMLTextAreaElement | null = null;
let composerEl: HTMLElement | null = null;

/** tool results seen during the current app run: callId → { ok, result } */
const toolResults = new Map<string, { ok: boolean; result: string }>();
/** live run containers keyed by runId */
const liveBubbles = new Map<string, HTMLElement>();

// ── mount ────────────────────────────────────────────────────────────────────

export function mountAi(): void {
  if (mounted) return;
  mounted = true;

  // editor context providers for the agent loop
  aiManager.activeEditorProvider = () => {
    const e = editorManager.activeEditor;
    return e ? { url: e.url, text: e.text } : null;
  };
  aiManager.activeSelectionProvider = () => {
    const e = editorManager.activeEditor;
    if (!e) return null;
    const sel = e.view.state.selection.main;
    return sel.empty ? null : e.view.state.doc.sliceString(sel.from, sel.to);
  };

  // permission cards + ask_user
  aiManager.approvalHandler = () => undefined; // events drive the UI
  aiManager.askHandler = (q) => dialog.prompt('AI', q, { required: false });

  aiManager.events.on('ai:delta', ({ sessionId, runId, depth, text }) => {
    if (sessionId !== aiManager.activeSessionId) return;
    bubbleFor(runId, depth).append(document.createTextNode(text));
    scrollBottom();
  });
  aiManager.events.on('ai:tool-start', ({ sessionId, runId, depth, callId, name, args, risk }) => {
    if (sessionId !== aiManager.activeSessionId) return;
    toolResults.delete(callId);
    bubbleFor(runId, depth).append(toolCard(callId, name, args, risk, 'running'));
    scrollBottom();
  });
  aiManager.events.on('ai:tool-end', ({ sessionId, callId, result, ok }) => {
    if (sessionId !== aiManager.activeSessionId) return;
    toolResults.set(callId, { ok, result });
    const card = messagesEl?.querySelector(`[data-call-id="${callId}"]`);
    if (card) {
      const status = card.querySelector('.ai-tool-status');
      if (status) {
        status.textContent = ok ? '✓' : '✕';
        status.className = `ai-tool-status ${ok ? 'ok' : 'fail'}`;
      }
      const body = card.querySelector('.ai-tool-result');
      if (body) body.textContent = previewResult(result);
    }
    scrollBottom();
  });
  aiManager.events.on('ai:note', ({ sessionId, depth, text }) => {
    if (sessionId !== aiManager.activeSessionId) return;
    ensureLiveRoot().append(el('div', { class: `ai-note${depth ? ' sub' : ''}` }, text));
    scrollBottom();
  });
  aiManager.events.on('ai:approval', ({ request }) => showApprovalCard(request));
  aiManager.events.on('ai:run-end', ({ sessionId }) => {
    if (sessionId !== aiManager.activeSessionId) return;
    liveBubbles.clear();
    void refresh();
  });
  aiManager.events.on('ai:session-changed', ({ id }) => {
    liveBubbles.clear();
    clearNode(ensureLiveRoot());
    void refresh();
    void updateHeader(id);
  });

  $('#btn-ai').addEventListener('click', () => void togglePanel());
}

export async function togglePanel(open?: boolean): Promise<void> {
  const overlay = $('#ai-overlay');
  const willOpen = open ?? overlay.classList.contains('hidden');
  if (willOpen) {
    overlay.classList.remove('hidden');
    if (!messagesEl) buildPanel();
    await refresh();
    await updateHeader();
    inputEl?.focus();
  } else {
    overlay.classList.add('hidden');
  }
}

function buildPanel(): void {
  const overlay = $('#ai-overlay');
  clearNode(overlay);

  agentSelect = el('select', { class: 'ai-agent-select', title: 'Agent' }) as HTMLSelectElement;
  for (const a of AGENTS) {
    agentSelect.append(el('option', { value: a.id }, `${a.emoji} ${a.name}`));
  }
  agentSelect.addEventListener('change', () => {
    void applyAgent(agentSelect!.value as AgentId);
  });

  modelChip = el(
    'button',
    { class: 'ai-model-chip', title: i18n.t('settings.ai'), onclick: () => openAiSettings() },
    '…'
  );

  sessionTitleEl = el('span', { class: 'ai-session-title' }, 'AI');

  const header = el(
    'div',
    { class: 'ai-header' },
    agentSelect,
    modelChip,
    sessionTitleEl,
    el('span', { class: 'spacer' }),
    el('button', {
      class: 'icon-btn small',
      html: iconSvg('plus'),
      title: i18n.t('ai.newChat'),
      onclick: () => void newChat()
    }),
    el('button', {
      class: 'icon-btn small',
      html: iconSvg('refresh'),
      title: i18n.t('ai.sessions'),
      onclick: () => void pickSession()
    }),
    el('button', {
      class: 'icon-btn small',
      html: iconSvg('trash'),
      title: i18n.t('ai.deleteChat'),
      onclick: () => void deleteChat()
    }),
    el('button', {
      class: 'icon-btn small',
      html: iconSvg('close'),
      title: i18n.t('dialog.cancel'),
      onclick: () => void togglePanel(false)
    })
  );

  messagesEl = el('div', { class: 'ai-messages', id: 'ai-messages' });
  liveRoot = el('div', { class: 'ai-live' });
  messagesEl.append(liveRoot);

  // composer
  const chips = el('div', { class: 'ai-chips' });
  const chipDefs: Array<{ key: 'file' | 'selection' | 'tree'; label: string }> = [
    { key: 'file', label: i18n.t('ai.ctxFile') },
    { key: 'selection', label: i18n.t('ai.ctxSelection') },
    { key: 'tree', label: i18n.t('ai.ctxTree') }
  ];
  for (const c of chipDefs) {
    const chip = el('button', { class: 'ai-chip', dataset: { chip: c.key }, type: 'button' }, c.label);
    chip.addEventListener('click', () => chip.classList.toggle('on'));
    chips.append(chip);
  }

  inputEl = el('textarea', {
    class: 'ai-input',
    placeholder: i18n.t('ai.placeholder'),
    rows: '1'
  }) as HTMLTextAreaElement;
  inputEl.addEventListener('input', autogrow);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendCurrent();
    }
  });

  sendBtn = el('button', {
    class: 'icon-btn ai-send',
    html: iconSvg('send'),
    title: i18n.t('ai.send'),
    onclick: () => void sendCurrent()
  }) as HTMLButtonElement;
  stopBtn = el('button', {
    class: 'icon-btn ai-stop hidden',
    html: iconSvg('stop'),
    title: i18n.t('ai.stop'),
    onclick: () => aiManager.abort(aiManager.activeSessionId ?? undefined)
  }) as HTMLButtonElement;

  composerEl = el('div', { class: 'ai-composer' }, chips, el('div', { class: 'ai-input-row' }, inputEl, sendBtn, stopBtn));

  overlay.append(el('div', { class: 'ai-panel' }, header, messagesEl, composerEl));
}

// ── header helpers ───────────────────────────────────────────────────────────

async function updateHeader(sessionId?: string): Promise<void> {
  const id = sessionId ?? aiManager.activeSessionId;
  if (!agentSelect || !modelChip || !sessionTitleEl) return;
  if (id) {
    const s = await aiManager.getSession(id);
    if (agentSelect.querySelector(`option[value="${s.agentId}"]`)) agentSelect.value = s.agentId;
    sessionTitleEl.textContent = s.title;
  }
  const providerId = settings.get('ai.provider');
  modelChip.textContent = `${providerId} · ${settings.get('ai.model')}`;
}

async function applyAgent(agentId: AgentId): Promise<void> {
  const id = aiManager.activeSessionId;
  if (id) await aiManager.setSessionAgent(id, agentId);
  else await aiManager.newSession(agentId);
}

async function newChat(): Promise<void> {
  const agent = (agentSelect?.value as AgentId) ?? 'chat';
  await aiManager.newSession(agent);
}

async function deleteChat(): Promise<void> {
  const id = aiManager.activeSessionId;
  if (!id) return;
  if (!(await dialog.confirm(i18n.t('ai.deleteChat'), i18n.t('ai.deleteChatConfirm')))) return;
  await aiManager.deleteSession(id);
  await refresh();
  await updateHeader();
}

async function pickSession(): Promise<void> {
  const sessions = await aiManager.listSessions();
  if (!sessions.length) {
    toast.info(i18n.t('ai.noSessions'));
    return;
  }
  const idx = await dialog.select(
    i18n.t('ai.sessions'),
    i18n.t('ai.pickSession'),
    sessions.map((s) => `${s.title} · ${new Date(s.updatedAt).toLocaleDateString()}`),
    Math.max(0, sessions.findIndex((s) => s.id === aiManager.activeSessionId))
  );
  if (idx === null || !sessions[idx]) return;
  await aiManager.openSession(sessions[idx].id);
}

function openAiSettings(): void {
  void togglePanel(false);
  $('#btn-settings').click();
  // jump to the AI section once rendered
  setTimeout(() => {
    document.querySelector('#settings-body .settings-section.ai')?.scrollIntoView({ behavior: 'smooth' });
  }, 60);
}

// ── rendering ────────────────────────────────────────────────────────────────

async function refresh(): Promise<void> {
  if (!messagesEl || !liveRoot) return;
  clearNode(messagesEl);
  liveRoot = el('div', { class: 'ai-live' });
  messagesEl.append(liveRoot);

  const id = aiManager.activeSessionId;
  setRunning(aiManager.isRunning());
  if (!id) {
    messagesEl.append(emptyState());
    return;
  }
  const session = await aiManager.getSession(id);
  if (!session.messages.length) {
    messagesEl.append(emptyState());
    return;
  }
  for (const msg of session.messages) renderMessage(msg);
  scrollBottom();
}

function emptyState(): HTMLElement {
  return el(
    'div',
    { class: 'ai-empty' },
    el('div', { class: 'ai-empty-icon', html: iconSvg('ai', 34) }),
    el('h3', {}, i18n.t('ai.welcomeTitle')),
    el('p', {}, i18n.t('ai.welcomeBody'))
  );
}

function renderMessage(msg: AiMessage): void {
  if (!messagesEl) return;
  if (msg.role === 'user') {
    messagesEl.append(el('div', { class: 'ai-msg user' }, el('div', { class: 'ai-bubble' }, msg.content)));
    return;
  }
  if (msg.role === 'assistant') {
    if (msg.content) {
      messagesEl.append(el('div', { class: 'ai-msg assistant' }, el('div', { class: 'ai-bubble md' }, renderMarkdown(msg.content))));
    }
    for (const tc of msg.toolCalls ?? []) {
      const st = toolResults.get(tc.id);
      messagesEl.append(toolCard(tc.id, tc.name, tc.args, 'safe', st ? (st.ok ? 'done' : 'fail') : 'done', st?.result));
    }
  }
  // tool result messages are rendered inside their call card
}

function bubbleFor(runId: string, depth: number): HTMLElement {
  const existing = liveBubbles.get(runId);
  if (existing) return existing;
  const wrap = el(
    'div',
    { class: `ai-msg assistant${depth ? ' subagent' : ''}` },
    el('div', { class: 'ai-bubble md' })
  );
  if (depth) wrap.prepend(el('div', { class: 'ai-sub-badge' }, i18n.t('ai.subagent')));
  ensureLiveRoot().append(wrap);
  liveBubbles.set(runId, wrap);
  return wrap;
}

function ensureLiveRoot(): HTMLElement {
  if (!liveRoot || !liveRoot.isConnected) {
    liveRoot = el('div', { class: 'ai-live' });
    messagesEl?.append(liveRoot);
  }
  return liveRoot;
}

function toolCard(
  callId: string,
  name: string,
  args: Record<string, unknown>,
  risk: string,
  status: 'running' | 'done' | 'fail',
  result?: string
): HTMLElement {
  const detail =
    String(args['path'] ?? args['command'] ?? args['query'] ?? args['agent'] ?? args['question'] ?? '')
      .slice(0, 90) || JSON.stringify(args).slice(0, 90);
  const riskClass = risk === 'safe' ? '' : ` risk-${risk}`;
  const card = el(
    'div',
    { class: `ai-tool${riskClass}`, dataset: { callId } },
    el('span', { class: `ai-tool-status ${status === 'running' ? 'spin' : status === 'done' ? 'ok' : 'fail'}` },
      status === 'running' ? '…' : status === 'done' ? '✓' : '✕'),
    el('span', { class: 'ai-tool-name' }, name),
    el('span', { class: 'ai-tool-detail' }, detail)
  );
  const body = el('pre', { class: 'ai-tool-result hidden' }, result ? previewResult(result) : '');
  card.append(body);
  card.addEventListener('click', () => body.classList.toggle('hidden'));
  return card;
}

function previewResult(result: string): string {
  return result.length > 800 ? `${result.slice(0, 800)}\n…` : result;
}

function showApprovalCard(req: ApprovalRequest): void {
  if (!messagesEl) return;
  const card = el(
    'div',
    { class: 'ai-approval' },
    el('div', { class: 'ai-approval-title' }, i18n.t('ai.wantsTo', { tool: req.tool })),
    el('div', { class: 'ai-approval-detail' }, req.detail),
    el(
      'div',
      { class: 'ai-approval-actions' },
      el('button', {
        class: 'btn btn-primary',
        text: i18n.t('ai.allow'),
        onclick: () => {
          req.resolve('allow');
          card.remove();
        }
      }),
      el('button', {
        class: 'btn btn-secondary',
        text: i18n.t('ai.allowAlways'),
        onclick: () => {
          req.resolve('always');
          card.remove();
        }
      }),
      el('button', {
        class: 'btn btn-secondary',
        text: i18n.t('ai.deny'),
        onclick: () => {
          req.resolve('deny');
          card.remove();
        }
      })
    )
  );
  ensureLiveRoot().append(card);
  scrollBottom();
}

// ── markdown-lite ────────────────────────────────────────────────────────────

function renderMarkdown(text: string): HTMLElement {
  const root = el('div', {});
  const parts = text.split(/```/);
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      // code fence — first line may carry the language
      const nl = part.indexOf('\n');
      const lang = nl > 0 ? part.slice(0, nl).trim() : '';
      const code = nl > 0 ? part.slice(nl + 1) : part;
      const pre = el('pre', { class: 'ai-code' }, code.replace(/\n$/, ''));
      const bar = el(
        'div',
        { class: 'ai-code-bar' },
        el('span', { class: 'ai-code-lang' }, lang || 'code'),
        el('span', { class: 'spacer' }),
        el('button', {
          class: 'icon-btn small',
          html: iconSvg('copy'),
          title: i18n.t('ai.copy'),
          onclick: (e) => {
            e.stopPropagation();
            void navigator.clipboard?.writeText(code).then(() => toast.success(i18n.t('tree.pathCopied')));
          }
        })
      );
      root.append(el('div', { class: 'ai-code-wrap' }, bar, pre));
    } else if (part.trim()) {
      for (const line of part.split('\n')) {
        const t = line.trim();
        if (!t) continue;
        if (t.startsWith('### ')) root.append(el('h4', {}, t.slice(4)));
        else if (t.startsWith('## ')) root.append(el('h4', {}, t.slice(3)));
        else if (t.startsWith('# ')) root.append(el('h4', {}, t.slice(2)));
        else if (/^[-*] /.test(t)) root.append(el('div', { class: 'ai-li' }, `• ${inline(t.slice(2))}`));
        else if (/^\d+[.)] /.test(t)) root.append(el('div', { class: 'ai-li' }, inline(t)));
        else root.append(el('p', {}, inline(t)));
      }
    }
  });
  return root;
}

function inline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1');
}

// ── composer ─────────────────────────────────────────────────────────────────

function setRunning(running: boolean): void {
  sendBtn?.classList.toggle('hidden', running);
  stopBtn?.classList.toggle('hidden', !running);
}

async function sendCurrent(): Promise<void> {
  if (!inputEl) return;
  const text = inputEl.value.trim();
  if (!text) return;
  const chips = [...(composerEl?.querySelectorAll('.ai-chip.on') ?? [])].map(
    (c) => (c as HTMLElement).dataset.chip
  );
  const ctx = {
    file: chips.includes('file'),
    selection: chips.includes('selection'),
    tree: chips.includes('tree')
  };
  inputEl.value = '';
  autogrow();
  setRunning(true);
  try {
    await aiManager.send(text, ctx);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err));
  } finally {
    setRunning(false);
  }
}

function autogrow(): void {
  if (!inputEl) return;
  inputEl.style.height = 'auto';
  inputEl.style.height = `${Math.min(120, inputEl.scrollHeight)}px`;
}

function scrollBottom(): void {
  requestAnimationFrame(() => {
    messagesEl?.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' });
  });
}

// ── one-shot commands (palette) ──────────────────────────────────────────────

/** Open panel + send a message in the current session. */
export async function askAi(text: string, ctx: { file?: boolean; selection?: boolean } = {}): Promise<void> {
  await togglePanel(true);
  if (aiManager.isRunning()) {
    toast.warning(i18n.t('ai.busy'));
    return;
  }
  setRunning(true);
  try {
    await aiManager.send(text, ctx);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err));
  } finally {
    setRunning(false);
  }
}

export type { AiMessage };
