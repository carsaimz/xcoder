/**
 * Main menu — the kebab dropdown in the header (editor menu order).
 */
import { exec as execCommand } from '@api/commands';
import { editorManager } from '@api/editorManager';
import { terminal } from '@core/terminal/terminal';
import { CordovaBackend } from '@core/file/backend-cordova';
import { openPalette } from './palette';
import { showContextMenu, closeContextMenu, type MenuEntry } from './contextMenu';
import { i18n } from '@lib/i18n';

export function openMainMenu(anchorX: number, anchorY: number): void {
  const hasEditor = Boolean(editorManager.activeEditor);
  const items: MenuEntry[] = [
    { label: i18n.t('menu.newFile'), icon: 'file-plus', action: () => void execCommand('file.new') },
    {
      label: i18n.t('menu.save'),
      icon: 'save',
      disabled: !hasEditor,
      action: () => void editorManager.saveActive()
    },
    {
      label: i18n.t('menu.saveAs'),
      icon: 'save',
      disabled: !hasEditor,
      action: () => void execCommand('file.saveAs')
    },
    'separator',
    { label: i18n.t('menu.openRecent'), icon: 'search', action: () => openPalette('files') },
    { label: i18n.t('menu.findFile'), icon: 'search', action: () => openPalette('files') },
    'separator',
    { label: i18n.t('menu.terminal'), icon: 'terminal', action: () => terminal.toggle() },
    {
      label: i18n.t('menu.newTerminal'),
      icon: 'terminal',
      action: () => {
        terminal.open();
        terminal.createTab();
      }
    },
    { label: i18n.t('menu.commandPalette'), icon: 'palette', action: () => openPalette('commands') },
    'separator',
    { label: i18n.t('menu.settings'), icon: 'settings', action: () => void execCommand('view.settings') },
    { label: i18n.t('menu.plugins'), icon: 'command', action: () => void execCommand('view.plugins') },
    { label: i18n.t('menu.about'), icon: 'info', action: () => void execCommand('app.about') }
  ];
  if (CordovaBackend.isAvailable) {
    items.push('separator', {
      label: i18n.t('menu.exit'),
      icon: 'x-circle',
      action: () => {
        const app = (window as unknown as { navigator?: { app?: { exitApp?: () => void } } }).navigator?.app;
        app?.exitApp?.();
      }
    });
  }
  showContextMenu(anchorX, anchorY, items, 'top-right');
}

/** Wire the header kebab button. */
export function mountMainMenu(): void {
  const btn = document.getElementById('btn-kebab');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const rect = btn.getBoundingClientRect();
    if (document.querySelector('.context-menu')) {
      closeContextMenu();
      return;
    }
    openMainMenu(rect.right + 6, rect.bottom + 4);
  });
}

/** Helper shared with commands: scroll to a settings section after opening. */
export async function openSettingsSection(section: string): Promise<void> {
  await execCommand('view.settings');
  setTimeout(() => {
    document
      .querySelector(`#settings-body .settings-section.${section}`)
      ?.scrollIntoView({ behavior: 'smooth' });
  }, 120);
}
