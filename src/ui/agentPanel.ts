/** AI Agent drawer — chat log, tool cards, permission prompts, subagent modes. */

import { el, icon, clear } from '../lib/dom';
import { t } from '../lib/i18n';
import { bus } from '../lib/events';
import { truncate } from '../lib/helpers';
import { agents, AgentEvent } from '../core/agent';
import { providers } from '../core/ai';
import * as dialog from '../api/dialog';
import { toast } from '../api/toast';

interface ChatEntry {
  kind: 'user' | 'assistant' | 'note';
  text: string;
}

export class AgentPanel {
  private drawer: HTMLElement;
  private log: HTMLElement;
  private input: HTMLTextAreaElement;
  private statusEl: HTMLElement;
  private running = false;
  private chat: ChatEntry[] = [];
  private mode = 'main';

  constructor(parent: HTMLElement) {
    this.drawer = el('div', { class: 'drawer' });
    const head = el(
      'div',
      { class: 'drawer-head' },
      el('div', { class: 'title' }, icon('robot', 18), el('span', {}, t('agent.title'))),
    );
    const sub = el('div', { class: 'sub' });
    this.renderSub(sub);
    head.appendChild(sub);
    const headActions = el('div', { style: 'margin-left:auto;display:flex;gap:2px' });
    headActions.appendChild(
      el('button', {
        class: 'icon-btn',
        title: t('agent.newChat'),
        onclick: () => this.newChat(),
      }, icon('refresh', 16)),
    );
    headActions.appendChild(
      el('button', {
        class: 'icon-btn',
        title: t('close'),
        onclick: () => this.close(),
      }, icon('close', 16)),
    );
    head.appendChild(headActions);

    this.log = el('div', { class: 'agent-log' });
    this.statusEl = el('div', { class: 'agent-status' }, el('span', { class: 'dot' }), el('span', {}, t('agent.mode.main')));

    const modes = el('div', { class: 'agent-modes' });
    const modeDefs: Array<[string, string]> = [
      ['main', t('agent.mode.main')],
      ['coder', t('agent.mode.coder')],
      ['analyzer', t('agent.mode.analyzer')],
      ['ops', t('agent.mode.ops')],
    ];
    for (const [value, label] of modeDefs) {
      const chip = el('button', { class: `chip${value === this.mode ? ' active' : ''}`, dataset: { mode: value } }, label);
      chip.addEventListener('click', () => {
        this.mode = value;
        modes.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', (c as HTMLElement).dataset.mode === value));
        this.setStatus(`mode: ${label}`);
        this.renderSub(sub);
      });
      modes.appendChild(chip);
    }

    const row = el('div', { class: 'agent-input-row' });
    this.input = el('textarea', {
      class: 'agent-input',
      placeholder: t('agent.placeholder'),
    }) as HTMLTextAreaElement;
    const send = el('button', { class: 'btn btn-primary', style: 'align-self:flex-end' }, icon('play', 15), t('agent.run'));
    send.addEventListener('click', () => void this.submit());
    row.append(this.input, send);

    this.input.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        void this.submit();
      }
    });

    this.drawer.append(head, this.log, modes, this.statusEl, row);
    parent.appendChild(this.drawer);

    bus.on<{ req: { tool: string; summary: string }; resolve: (a: 'allow' | 'always' | 'deny') => void }>(
      'agent:permission',
      ({ req, resolve }) => void this.handlePermission(req, resolve),
    );
  }

  private renderSub(sub: HTMLElement): void {
    clear(sub);
    const model = providers.active;
    sub.textContent = model ? `${model.label} · ${model.model}` : t('agent.noProvider');
  }

  open(): void {
    this.drawer.classList.add('open');
    if (!this.chat.length) {
      this.addEntry('note', providers.active ? t('agent.placeholder') : t('agent.noProvider'));
    }
  }

  close(): void {
    this.drawer.classList.remove('open');
  }

  get isOpen(): boolean {
    return this.drawer.classList.contains('open');
  }

  private newChat(): void {
    this.chat = [];
    clear(this.log);
    agents.permissions.forget();
    this.addEntry('note', t('agent.cleared'));
  }

  private addEntry(kind: ChatEntry['kind'], text: string): HTMLElement {
    this.chat.push({ kind, text });
    const node = el('div', { class: `msg ${kind}` }, text);
    this.log.appendChild(node);
    this.log.scrollTop = this.log.scrollHeight;
    return node;
  }

  private addToolCard(name: string, args: unknown): HTMLElement {
    const card = el(
      'div',
      { class: 'tool-card' },
      el('div', { class: 'tool-name' }, `${t('agent.toolCall')}: ${name}`),
      el('div', { class: 'tool-args' }, truncate(typeof args === 'string' ? args : JSON.stringify(args, null, 1), 500)),
    );
    this.log.appendChild(card);
    this.log.scrollTop = this.log.scrollHeight;
    return card;
  }

  private setStatus(text: string, runningState = false): void {
    clear(this.statusEl);
    this.statusEl.append(el('span', { class: 'dot' }), el('span', {}, text));
    this.statusEl.classList.toggle('running', runningState);
  }

  private async submit(): Promise<void> {
    if (this.running) {
      agents.abortController?.abort();
      return;
    }
    const task = this.input.value.trim();
    if (!task) return;
    if (!agents.hasProvider()) {
      toast(t('agent.noProvider'), 'warn');
      return;
    }
    this.input.value = '';
    this.addEntry('user', task);
    this.running = true;
    const abort = agents.newAbort();
    this.setStatus(t('agent.working'), true);

    const unbind = bus.on('agent:event', (evt: AgentEvent) => {
      if (evt.type === 'tool-call') {
        const data = evt.data as { id: string; name: string; args: unknown };
        this.addToolCard(data.name, data.args);
      } else if (evt.type === 'tool-result') {
        const data = evt.data as { id: string; ok: boolean; result: string };
        const cards = this.log.querySelectorAll('.tool-card:not(.ok):not(.fail)');
        const card = cards[cards.length - 1] as HTMLElement | undefined;
        if (card) {
          card.classList.add(data.ok ? 'ok' : 'fail');
          const argsEl = card.querySelector('.tool-args');
          if (argsEl) argsEl.textContent = truncate(data.result, 400);
        }
      } else if (evt.type === 'subagent') {
        this.addEntry('note', `→ ${(evt.data as { subagent?: string }).subagent ?? 'subagent'}`);
      }
    });

    try {
      const result = await agents.run(task, {
        subagent: this.mode === 'main' ? undefined : this.mode,
        signal: abort.signal,
      });
      if (result.ok) {
        this.addEntry('assistant', result.output);
        this.addEntry('note', t('agent.done', { steps: result.steps }));
      } else {
        this.addEntry('note', result.output);
      }
    } catch (err) {
      this.addEntry('note', t('agent.failed', { reason: (err as Error).message }));
    } finally {
      unbind();
      this.running = false;
      this.setStatus(t('agent.mode.main'));
      this.renderSub(this.drawer.querySelector('.drawer-head .sub') as HTMLElement);
    }
  }

  private async handlePermission(
    req: { tool: string; summary: string },
    resolve: (answer: 'allow' | 'always' | 'deny') => void,
  ): Promise<void> {
    const answer = await dialog.action(
      t('agent.permissionTitle'),
      t('agent.permissionMsg', { tool: req.tool, summary: req.summary }),
      [
        { label: t('agent.deny'), value: 'deny' },
        { label: t('agent.allow'), value: 'allow' },
        { label: t('agent.allowAll'), value: 'always', variant: 'primary' },
      ],
    );
    resolve((answer || 'deny') as 'allow' | 'always' | 'deny');
  }
}
