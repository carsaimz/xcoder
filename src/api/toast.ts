/** Toast notifications. */

import { el, qs } from '../lib/dom';
import { t } from '../lib/i18n';

export type ToastType = 'info' | 'success' | 'error' | 'warn';

function container(): HTMLElement {
  let c = qs<HTMLElement>('.toast-container');
  if (!c) {
    c = el('div', { class: 'toast-container' });
    document.body.appendChild(c);
  }
  return c;
}

export function toast(message: string, type: ToastType = 'info', duration = 2600): void {
  const item = el('div', { class: `toast toast-${type}`, role: 'status' }, message);
  container().appendChild(item);
  requestAnimationFrame(() => item.classList.add('show'));
  setTimeout(() => {
    item.classList.remove('show');
    setTimeout(() => item.remove(), 300);
  }, duration);
}

export const toastT = (key: string, vars?: Record<string, string | number>, type: ToastType = 'info') =>
  toast(t(key, vars), type);
