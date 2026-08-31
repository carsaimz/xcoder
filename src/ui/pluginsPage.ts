/** Plugins manager sheet. */

import { el, icon, clear, qs } from '../lib/dom';
import { t } from '../lib/i18n';
import { plugins } from '../api/plugins';
import { toast } from '../api/toast';
import { bus } from '../lib/events';

export function openPlugins(): void {
  qs('.plugins-sheet-host')?.remove();
  const overlay = el('div', { class: 'overlay plugins-sheet-host' });
  const sheet = el('div', { class: 'sheet' });
  const head = el(
    'div',
    { class: 'sheet-head' },
    icon('plugin', 17),
    el('span', {}, t('plugins.title')),
  );
  const closeBtn = el('button', { class: 'icon-btn', style: 'margin-left:auto' }, icon('close', 16));
  closeBtn.addEventListener('click', () => overlay.remove());
  head.appendChild(closeBtn);

  const body = el('div', { class: 'sheet-body' });
  const installBtn = el('button', { class: 'btn btn-primary', style: 'margin-bottom:14px' }, icon('download', 15), t('plugins.install'));
  const input = el('input', { type: 'file', accept: '.zip', style: 'display:none' }) as HTMLInputElement;
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const record = await plugins.installFromZip(file);
      toast(t('plugins.installedOk', { name: record.manifest.name }), 'success');
      render();
    } catch (err) {
      toast(t('plugins.invalid', { reason: (err as Error).message }), 'error');
    }
    input.value = '';
  });
  installBtn.addEventListener('click', () => input.click());

  const list = el('div');
  const render = (): void => {
    clear(list);
    const records = plugins.list();
    if (!records.length) {
      list.appendChild(el('p', { class: 'muted' }, t('plugins.empty')));
      return;
    }
    for (const record of records) {
      const card = el('div', { class: 'provider-card' });
      const headRow = el('div', { class: 'head' });
      headRow.appendChild(el('span', { class: 'name' }, record.manifest.name));
      headRow.appendChild(el('span', { class: 'badge' }, `v${record.manifest.version}`));
      headRow.appendChild(el('span', { class: `badge${record.enabled ? ' ok' : ''}` }, record.enabled ? t('plugins.enable') : 'off'));
      const actions = el('div', { style: 'margin-left:auto;display:flex;gap:2px' });
      const toggle = el('button', { class: 'btn btn-ghost' }, record.enabled ? 'disable' : 'enable');
      toggle.addEventListener('click', async () => {
        await plugins.setEnabled(record.manifest.id, !record.enabled);
        render();
      });
      const del = el('button', { class: 'icon-btn' }, icon('trash', 16));
      del.addEventListener('click', async () => {
        await plugins.uninstall(record.manifest.id);
        toast(t('plugins.uninstalledOk', { name: record.manifest.name }), 'success');
        render();
      });
      actions.append(toggle, del);
      headRow.appendChild(actions);
      card.appendChild(headRow);
      if (record.manifest.description) {
        card.appendChild(el('p', { class: 'muted', style: 'margin:0' }, record.manifest.description));
      }
      list.appendChild(card);
    }
  };

  sheet.append(head, body);
  body.append(installBtn, input, list);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  bus.once('plugins:changed', render);
  render();
}
