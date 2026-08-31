/**
 * Context menu (long-press on touch, right-click on desktop).
 * Menu rows: label left, icon right, hr separators, optional value text.
 */
import { el, iconEl } from '@lib/dom';

export interface MenuItem {
  label?: string;
  icon?: string;
  value?: string;
  danger?: boolean;
  disabled?: boolean;
  action?: () => void;
}

export type MenuEntry = MenuItem | 'separator';

let openMenu: HTMLElement | null = null;
let disarm: (() => void) | null = null;

export function showContextMenu(
  x: number,
  y: number,
  items: MenuEntry[],
  anchor: 'point' | 'top-right' = 'point'
): void {
  closeContextMenu();
  const menu = el('div', { class: 'context-menu', role: 'menu' });
  for (const item of items) {
    if (item === 'separator') {
      menu.append(el('hr'));
      continue;
    }
    const row = el(
      'div',
      {
        class: `context-menu-item${item.danger ? ' danger' : ''}${item.disabled ? ' disabled' : ''}`,
        role: 'menuitem'
      },
      el('span', { class: 'mi-label' }, item.label ?? '')
    );
    if (item.value) row.append(el('span', { class: 'mi-value' }, item.value));
    if (item.icon) row.append(iconEl(item.icon, 16));
    row.addEventListener('click', () => {
      closeContextMenu();
      item.action?.();
    });
    menu.append(row);
  }
  document.body.append(menu);
  const rect = menu.getBoundingClientRect();
  let left: number;
  let top: number;
  if (anchor === 'top-right') {
    left = x - rect.width;
    top = y;
  } else {
    left = Math.min(x, window.innerWidth - rect.width - 8);
    top = Math.min(y, window.innerHeight - rect.height - 8);
  }
  menu.style.left = `${Math.max(4, left)}px`;
  menu.style.top = `${Math.max(4, top)}px`;
  openMenu = menu;
  armOutsideClose(menu);
}

/** Close when interacting outside the menu (capture phase, so a right-click
 *  elsewhere both closes the old menu and can open a new one). */
function armOutsideClose(menu: HTMLElement): void {
  const onPointer = (e: Event) => {
    if (menu.contains(e.target as Node)) return;
    closeContextMenu();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeContextMenu();
    }
  };
  const opts: AddEventListenerOptions = { capture: true };
  document.addEventListener('pointerdown', onPointer, opts);
  document.addEventListener('contextmenu', onPointer, opts);
  document.addEventListener('keydown', onKey, opts);
  disarm = () => {
    document.removeEventListener('pointerdown', onPointer, opts);
    document.removeEventListener('contextmenu', onPointer, opts);
    document.removeEventListener('keydown', onKey, opts);
  };
}

export function closeContextMenu(): void {
  disarm?.();
  disarm = null;
  openMenu?.remove();
  openMenu = null;
}
