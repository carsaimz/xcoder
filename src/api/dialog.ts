/** Promise-based dialogs (alert / confirm / prompt / select / multi-button). */

import { el } from '../lib/dom';
import { t } from '../lib/i18n';

interface DialogOptions {
  title?: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  buttons?: Array<{ label: string; value: string; variant?: 'primary' | 'danger' }>;
  okLabel?: string;
  cancelLabel?: string;
}

function open(contents: HTMLElement, buttons: Array<{ label: string; value: string; variant?: string }>): Promise<string> {
  return new Promise((resolve) => {
    const overlay = el('div', { class: 'dialog-overlay' });
    const box = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true' }, contents);
    const bar = el('div', { class: 'dialog-buttons' });
    // capture the live input value at click time (close() removes the node)
    const valueEl = box.querySelector<HTMLInputElement | HTMLSelectElement>('input.dialog-input, select.dialog-input');
    const close = () => overlay.remove();
    for (const b of buttons) {
      bar.appendChild(
        el(
          'button',
          {
            class: `btn ${b.variant === 'danger' ? 'btn-danger' : b.variant === 'primary' ? 'btn-primary' : 'btn-ghost'}`,
            onclick: () => {
              const result = b.value === '__ok' && valueEl ? valueEl.value : b.value;
              close();
              resolve(result);
            },
          },
          b.label,
        ),
      );
    }
    box.appendChild(bar);
    overlay.appendChild(box);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        close();
        resolve('');
      }
    });
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onKey);
        close();
        resolve('');
      }
      if (e.key === 'Enter' && valueEl && document.activeElement === valueEl) {
        const okBtn = bar.querySelector<HTMLButtonElement>('.btn-primary');
        okBtn?.click();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    if (valueEl) {
      valueEl.focus();
      if (valueEl instanceof HTMLInputElement) valueEl.select();
    }
  });
}

export async function alert(message: string, title?: string): Promise<void> {
  await open(
    el('div', {}, el('h3', { class: 'dialog-title' }, title ?? t('dialog.alertTitle')), el('p', { class: 'dialog-body' }, message)),
    [{ label: t('ok'), value: 'ok', variant: 'primary' }],
  );
}

export async function confirm(message: string, title?: string): Promise<boolean> {
  const res = await open(
    el('div', {}, el('h3', { class: 'dialog-title' }, title ?? t('dialog.confirmTitle')), el('p', { class: 'dialog-body' }, message)),
    [
      { label: t('cancel'), value: 'cancel' },
      { label: t('ok'), value: 'ok', variant: 'primary' },
    ],
  );
  return res === 'ok';
}

export async function prompt(message: string, defaultValue = '', title?: string): Promise<string | null> {
  const res = await open(
    el(
      'div',
      {},
      el('h3', { class: 'dialog-title' }, title ?? t('dialog.promptTitle')),
      el('p', { class: 'dialog-body' }, message),
      el('input', { class: 'dialog-input', type: 'text', value: defaultValue, placeholder: '' }),
    ),
    [
      { label: t('cancel'), value: '' },
      { label: t('ok'), value: '__ok', variant: 'primary' },
    ],
  );
  // '' can be a legitimate empty input only when the user cleared it and hit OK;
  // distinguishing cancel: cancel resolves with the cancel button value ''
  // while OK resolves with the live input value — same '' means we treat it
  // as cancelled unless the input itself had focus on Enter. For simplicity,
  // an empty OK result is treated as cancellation.
  return res === '' ? null : res;
}

export async function select(message: string, options: Array<{ value: string; label: string }>, title?: string): Promise<string | null> {
  const res = await open(
    el(
      'div',
      {},
      el('h3', { class: 'dialog-title' }, title ?? t('dialog.selectTitle')),
      el('p', { class: 'dialog-body' }, message),
      el(
        'select',
        { class: 'dialog-input' },
        ...options.map((o) => el('option', { value: o.value }, o.label)),
      ),
    ),
    [
      { label: t('cancel'), value: '' },
      { label: t('ok'), value: '__ok', variant: 'primary' },
    ],
  );
  return res === '' ? null : res;
}

/** Generic multi-button dialog (used by permission prompts). */
export function action(
  title: string,
  message: string,
  buttons: Array<{ label: string; value: string; variant?: 'primary' | 'danger' }>,
): Promise<string> {
  return open(
    el('div', {}, el('h3', { class: 'dialog-title' }, title), el('p', { class: 'dialog-body' }, message)),
    buttons,
  );
}
