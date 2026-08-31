/**
 * Toast notifications. Renders into #toast-container (see index.html).
 */
import { el } from '@lib/dom';
import type { ToastType } from '@types-app/xcoder';

const DEFAULT_DURATION = 3000;
let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (container && document.body.contains(container)) return container;
  container = document.getElementById('toast-container');
  if (!container) {
    container = el('div', { id: 'toast-container', role: 'status', 'aria-live': 'polite' });
    document.body.append(container);
  }
  return container;
}

export function show(message: string, type: ToastType = 'info', duration = DEFAULT_DURATION): void {
  const box = el('div', { class: `toast toast-${type}` }, message);
  const close = () => {
    box.classList.add('toast-out');
    setTimeout(() => box.remove(), 200);
  };
  const timer = setTimeout(close, Math.max(500, duration));
  box.addEventListener('click', () => {
    clearTimeout(timer);
    close();
  });
  ensureContainer().append(box);
}

export const info = (m: string, d?: number) => show(m, 'info', d);
export const success = (m: string, d?: number) => show(m, 'success', d);
export const warning = (m: string, d?: number) => show(m, 'warning', d);
export const error = (m: string, d?: number) => show(m, 'error', d);

export function clear(): void {
  ensureContainer().replaceChildren();
}

/** Named API object (consumers: `import { toast } from '@api/toast'`). */
export const toast = { show, info, success, warning, error, clear };
