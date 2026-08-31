/**
 * Promise-based dialogs (alert / confirm / prompt / select).
 * Rendered into #dialog-root; keyboard + theme aware.
 */
import { el, $maybe } from '@lib/dom';
import { i18n } from '@lib/i18n';

interface PromptOptions {
  value?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}

let root: HTMLElement | null = null;

function ensureRoot(): HTMLElement {
  root = $maybe('#dialog-root');
  if (!root) {
    root = el('div', { id: 'dialog-root' });
    document.body.append(root);
  }
  return root;
}

/**
 * Opens a modal. `actions` are resolved in order; each action's handler
 * decides the resolution value (null = dismiss / cancel).
 */
function showModal<T>(
  title: string,
  buildBody: HTMLElement,
  actions: Array<{ label: string; kind: 'primary' | 'secondary'; handler?: () => T | null }>
): Promise<T | null> {
  return new Promise((resolve) => {
    const overlay = el('div', { class: 'dialog-overlay' });
    let done = false;
    const close = (v: T | null) => {
      if (done) return;
      done = true;
      overlay.classList.add('dialog-closing');
      setTimeout(() => overlay.remove(), 120);
      document.removeEventListener('keydown', onKey, true);
      resolve(v);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(null);
      }
    };
    document.addEventListener('keydown', onKey, true);

    const btnRow = el('div', { class: 'dialog-actions' });
    for (const a of actions) {
      btnRow.append(
        el(
          'button',
          {
            class: `btn btn-${a.kind}`,
            type: 'button',
            onclick: () => close(a.handler ? a.handler() : null)
          },
          a.label
        )
      );
    }

    overlay.append(
      el(
        'div',
        { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        el('h3', { class: 'dialog-title' }, title),
        buildBody,
        btnRow
      )
    );
    ensureRoot().append(overlay);
    overlay.querySelector<HTMLElement>('input, .btn-primary')?.focus();
  });
}

export function alert(title: string, message: string): Promise<void> {
  return showModal<void>(
    title,
    el('p', { class: 'dialog-message' }, message),
    [{ label: i18n.t('dialog.ok'), kind: 'primary', handler: () => undefined }]
  ).then(() => undefined);
}

export function confirm(title: string, message: string): Promise<boolean> {
  return showModal<boolean>(
    title,
    el('p', { class: 'dialog-message' }, message),
    [
      { label: i18n.t('dialog.ok'), kind: 'primary', handler: () => true },
      { label: i18n.t('dialog.cancel'), kind: 'secondary', handler: () => false }
    ]
  ).then((v) => v === true);
}

export function prompt(
  title: string,
  message: string,
  opts: PromptOptions = {}
): Promise<string | null> {
  const input = el('input', {
    class: 'dialog-input',
    type: opts.type ?? 'text',
    value: opts.value ?? '',
    placeholder: opts.placeholder ?? ''
  }) as HTMLInputElement;

  const submit = (): string | null => {
    if (opts.required && !input.value.trim()) {
      input.classList.add('dialog-input-invalid');
      return null; // keep dialog open
    }
    return input.value;
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = submit();
      if (v !== null) {
        // emulate OK click resolution
        (input.closest('.dialog-overlay')?.querySelector('.btn-primary') as HTMLButtonElement | null)
          ?.click();
      }
    }
  });

  return showModal<string>(
    title,
    el(
      'div',
      { class: 'dialog-body' },
      el('p', { class: 'dialog-message' }, message),
      input
    ),
    [
      { label: i18n.t('dialog.ok'), kind: 'primary', handler: submit },
      { label: i18n.t('dialog.cancel'), kind: 'secondary' }
    ]
  );
}

export function select(
  title: string,
  message: string,
  options: string[],
  selectedIndex = -1
): Promise<number | null> {
  const list = el('div', { class: 'dialog-select', role: 'listbox' });
  let chosen: number | null = null;
  options.forEach((label, idx) => {
    const item = el(
      'div',
      {
        class: `dialog-select-item${idx === selectedIndex ? ' selected' : ''}`,
        role: 'option',
        'aria-selected': String(idx === selectedIndex),
        tabindex: '0',
        onclick: () => {
          chosen = idx;
          (list.closest('.dialog-overlay')?.querySelector('.btn-primary') as HTMLButtonElement | null)
            ?.click();
        }
      },
      label
    );
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') item.click();
    });
    list.append(item);
  });

  return showModal<number>(
    title,
    el('div', { class: 'dialog-body' }, el('p', { class: 'dialog-message' }, message), list),
    [
      {
        label: i18n.t('dialog.ok'),
        kind: 'primary',
        handler: () => chosen
      },
      { label: i18n.t('dialog.cancel'), kind: 'secondary' }
    ]
  );
}

/** Key/value properties dialog (file info). */
export function info(title: string, rows: Array<[string, string]>): Promise<void> {
  const body = el('div', { class: 'dialog-body dialog-info' });
  for (const [k, v] of rows) {
    body.append(
      el(
        'div',
        { class: 'info-row' },
        el('span', { class: 'info-key' }, k),
        el('span', { class: 'info-value' }, v)
      )
    );
  }
  return showModal<void>(title, body, [
    { label: i18n.t('dialog.ok'), kind: 'primary', handler: () => undefined }
  ]).then(() => undefined);
}

/** Named API object (consumers: `import { dialog } from '@api/dialog'`). */
export const dialog = { alert, confirm, prompt, select, info };
