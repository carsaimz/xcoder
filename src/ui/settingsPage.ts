/** Settings sheet — General / Editor / AI providers / Agent. */

import { el, icon, clear, qs } from '../lib/dom';
import { t, listLocales } from '../lib/i18n';
import { settings, SettingsShape } from '../api/settings';
import { providers } from '../core/ai';
import { PRESETS, PRESET_GROUPS, getPreset } from '../core/ai/presets';
import { ProviderProfile, ProviderGroup } from '../core/ai/types';
import * as dialog from '../api/dialog';
import { toast } from '../api/toast';
import { bus } from '../lib/events';
import { THEME_LIST } from '../core/editor/themes';
import { createClient } from '../core/ai/clients';
import { agents } from '../core/agent';

export function openSettings(initialTab = 'general'): void {
  qs('.settings-sheet-host')?.remove();
  const overlay = el('div', { class: 'overlay settings-sheet-host' });
  const sheet = el('div', { class: 'sheet' });
  const head = el(
    'div',
    { class: 'sheet-head' },
    icon('gear', 17),
    el('span', {}, t('settings.title')),
  );
  const closeBtn = el('button', { class: 'icon-btn', style: 'margin-left:auto' }, icon('close', 16));
  closeBtn.addEventListener('click', () => overlay.remove());
  head.appendChild(closeBtn);

  const nav = el('div', { class: 'sheet-nav' });
  const body = el('div', { class: 'sheet-body' });
  sheet.append(head, nav, body);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const tabs: Array<[string, string]> = [
    ['general', t('settings.general')],
    ['editor', t('settings.editor')],
    ['ai', t('settings.ai')],
    ['agent', t('settings.agent')],
  ];
  let current = initialTab;
  const renderNav = (): void => {
    clear(nav);
    for (const [id, label] of tabs) {
      const chip = el('button', { class: `chip${id === current ? ' active' : ''}` }, label);
      chip.addEventListener('click', () => {
        current = id;
        renderNav();
        renderBody();
      });
      nav.appendChild(chip);
    }
  };

  const renderBody = (): void => {
    clear(body);
    if (current === 'general') renderGeneral(body);
    else if (current === 'editor') renderEditor(body);
    else if (current === 'ai') renderAI(body);
    else renderAgent(body);
  };

  renderNav();
  renderBody();
}

type Body = HTMLElement;

function row(body: Body, label: string, control: HTMLElement, desc?: string): void {
  const r = el('div', { class: 'form-row' });
  if (label) r.appendChild(el('label', {}, label));
  r.appendChild(control);
  if (desc) r.appendChild(el('span', { class: 'muted' }, desc));
  body.appendChild(r);
}

function renderGeneral(body: Body): void {
  const themeSel = el(
    'select',
    {},
    ...THEME_LIST.map((th) => el('option', { value: th, selected: settings.get('theme') === th }, th)),
  ) as HTMLSelectElement;
  themeSel.addEventListener('change', () => void settings.set('theme', themeSel.value as SettingsShape['theme']));
  row(body, t('settings.theme'), themeSel);

  const locales = listLocales();
  const locSel = el(
    'select',
    {},
    ...locales.map((l) => el('option', { value: l.code, selected: settings.get('locale') === l.code }, l.name)),
  ) as HTMLSelectElement;
  locSel.addEventListener('change', () => void settings.set('locale', locSel.value));
  row(body, t('settings.locale'), locSel);
}

function renderEditor(body: Body): void {
  const fontSize = el('input', { type: 'number', value: String(settings.get('fontSize')), min: '10', max: '28' }) as HTMLInputElement;
  fontSize.addEventListener('change', () => void settings.set('fontSize', Number(fontSize.value) || 14));
  row(body, t('settings.fontSize'), fontSize);

  const tabSize = el('input', { type: 'number', value: String(settings.get('tabSize')), min: '2', max: '8' }) as HTMLInputElement;
  tabSize.addEventListener('change', () => void settings.set('tabSize', Number(tabSize.value) || 4));
  row(body, t('settings.tabSize'), tabSize);

  const wrapRow = el('div', { class: 'switch-row' });
  const wrapChk = el('input', { type: 'checkbox' }) as HTMLInputElement;
  wrapChk.checked = settings.get('wordWrap');
  wrapChk.addEventListener('change', () => void settings.set('wordWrap', wrapChk.checked));
  wrapRow.append(el('div', {}, el('div', {}, t('settings.wordWrap'))), wrapChk);
  body.appendChild(wrapRow);

  const autoRow = el('div', { class: 'switch-row' });
  const autoChk = el('input', { type: 'checkbox' }) as HTMLInputElement;
  autoChk.checked = settings.get('autoSave');
  autoChk.addEventListener('change', () => void settings.set('autoSave', autoChk.checked));
  autoRow.append(el('div', {}, el('div', {}, t('settings.autoSave'))), autoChk);
  body.appendChild(autoRow);

  const delay = el('input', { type: 'number', value: String(settings.get('autoSaveDelay')), min: '500', step: '250' }) as HTMLInputElement;
  delay.addEventListener('change', () => void settings.set('autoSaveDelay', Number(delay.value) || 2000));
  row(body, t('settings.autoSaveDelay'), delay);
}

function providerCard(profile: ProviderProfile, rerender: () => void): HTMLElement {
  const card = el('div', { class: `provider-card${providers.activeProfileId === profile.id ? ' active' : ''}` });
  const head = el('div', { class: 'head' });
  const preset = getPreset(profile.presetId);
  head.appendChild(el('span', { class: 'name' }, profile.label));
  head.appendChild(el('span', { class: 'badge' }, preset?.label ?? profile.presetId));
  head.appendChild(el('span', { class: 'badge' }, profile.api));
  if (providers.activeProfileId === profile.id) head.appendChild(el('span', { class: 'badge ok' }, t('providers.activeBadge')));
  const actions = el('div', { style: 'margin-left:auto;display:flex;gap:2px' });
  const useBtn = el('button', { class: 'icon-btn', title: t('providers.setActive') }, icon('check', 16));
  useBtn.addEventListener('click', async () => {
    providers.setActive(profile.id);
    const agentSettings = settings.get('agent');
    await settings.set('agent', { ...agentSettings, activeProfileId: profile.id });
    rerender();
    toast(t('providers.setActive'), 'success');
  });
  const delBtn = el('button', { class: 'icon-btn', title: t('delete') }, icon('trash', 16));
  delBtn.addEventListener('click', async () => {
    const ok = await dialog.confirm(t('providers.deleteConfirm', { label: profile.label }));
    if (!ok) return;
    providers.remove(profile.id);
    const agentSettings = settings.get('agent');
    await settings.set('agent', { ...agentSettings, activeProfileId: providers.activeProfileId });
    await settings.set('providers', providers.list());
    rerender();
  });
  actions.append(useBtn, delBtn);
  head.appendChild(actions);
  card.appendChild(head);

  const keyInput = el('input', { type: 'password', value: profile.apiKey, placeholder: t('providers.apiKey') }) as HTMLInputElement;
  keyInput.addEventListener('change', async () => {
    providers.update(profile.id, { apiKey: keyInput.value });
    await settings.set('providers', providers.list());
  });
  row(card, t('providers.apiKey'), keyInput);

  const modelInput = el('input', { type: 'text', value: profile.model }) as HTMLInputElement;
  modelInput.addEventListener('change', async () => {
    providers.update(profile.id, { model: modelInput.value });
    await settings.set('providers', providers.list());
  });
  if (preset) {
    const modelSel = el(
      'select',
      {},
      ...preset.models.map((m) => el('option', { value: m.id, selected: profile.model === m.id }, m.label ?? m.id)),
    ) as HTMLSelectElement;
    modelSel.addEventListener('change', async () => {
      modelInput.value = modelSel.value;
      providers.update(profile.id, { model: modelSel.value });
      await settings.set('providers', providers.list());
    });
    row(card, t('providers.model'), modelSel);
  }
  row(card, t('providers.model'), modelInput, '(raw model id)');

  const urlInput = el('input', { type: 'text', value: profile.baseURL }) as HTMLInputElement;
  urlInput.addEventListener('change', async () => {
    providers.update(profile.id, { baseURL: urlInput.value });
    await settings.set('providers', providers.list());
  });
  row(card, t('providers.baseUrl'), urlInput);

  const testBtn = el('button', { class: 'btn' }, icon('sparkles', 15), t('providers.test'));
  testBtn.addEventListener('click', async () => {
    testBtn.textContent = '…';
    const client = createClient({ ...profile, apiKey: keyInput.value, baseURL: urlInput.value, model: modelInput.value });
    const res = await client.testConnection();
    testBtn.textContent = t('providers.test');
    if (res.ok) toast(t('providers.testOk', { models: res.models?.slice(0, 3).join(', ') ?? 'ok' }), 'success');
    else toast(t('providers.testFail', { reason: res.message }), 'error');
  });
  if (preset?.apiKeyURL) {
    const docsLink = el('a', { href: preset.apiKeyURL, target: '_blank', rel: 'noopener', class: 'btn btn-ghost' }, t('providers.docs'));
    const btnRow = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' });
    btnRow.append(testBtn, docsLink);
    card.appendChild(btnRow);
  } else {
    card.appendChild(testBtn);
  }
  return card;
}

function renderAI(body: Body): void {
  const addBtn = el('button', { class: 'btn btn-primary', style: 'margin-bottom:14px' }, icon('plus', 15), t('providers.add'));
  addBtn.addEventListener('click', () => void addProviderFlow(body));
  body.appendChild(addBtn);

  const list = el('div');
  body.appendChild(list);
  const renderProviders = (): void => {
    clear(list);
    const profiles = providers.list();
    if (!profiles.length) {
      list.appendChild(el('p', { class: 'muted' }, t('providers.empty')));
      return;
    }
    for (const profile of profiles) {
      list.appendChild(providerCard(profile, renderProviders));
    }
  };
  renderProviders();
}

async function addProviderFlow(container: HTMLElement): Promise<void> {
  // group → preset → configure
  const groupOptions: Array<{ value: string; label: string }> = PRESET_GROUPS.map((g) => ({
    value: g.id,
    label: `${t(g.labelKey)} (${PRESETS.filter((p) => p.group === g.id).length})`,
  }));
  groupOptions.push({ value: 'custom', label: t('providers.custom') });
  const groupChoice = await dialog.select(t('providers.group'), groupOptions, t('providers.add'));
  if (!groupChoice) return;

  if (groupChoice === 'custom') {
    const profile = providers.addProfile({ presetId: 'custom', label: 'Custom', api: 'openai' });
    await settings.set('providers', providers.list());
    const agentSettings = settings.get('agent');
    if (!agentSettings.activeProfileId) await settings.set('agent', { ...agentSettings, activeProfileId: profile.id });
    clear(container);
    renderAI(container);
    return;
  }

  const presets = PRESETS.filter((p) => p.group === (groupChoice as ProviderGroup));
  const presetChoice = await dialog.select(
    t('providers.preset'),
    presets.map((p) => ({ value: p.id, label: `${p.label} — ${p.note ?? ''}` })),
    t('providers.add'),
  );
  if (!presetChoice) return;
  const preset = getPreset(presetChoice);
  if (!preset) return;
  const profile = providers.addProfile({ presetId: preset.id });
  await settings.set('providers', providers.list());
  const agentSettings = settings.get('agent');
  if (!agentSettings.activeProfileId) await settings.set('agent', { ...agentSettings, activeProfileId: profile.id });
  clear(container);
  renderAI(container);
  if (preset.requiresKey && preset.apiKeyURL) {
    toast(`${preset.label}: ${preset.apiKeyURL}`, 'info', 5000);
  }
}

function renderAgent(body: Body): void {
  const modeSel = el(
    'select',
    {},
    el('option', { value: 'ask', selected: settings.get('agent').permissionMode === 'ask' }, 'ask (recommended)'),
    el('option', { value: 'auto', selected: settings.get('agent').permissionMode === 'auto' }, 'auto-allow (dangerous)'),
  ) as HTMLSelectElement;
  modeSel.addEventListener('change', async () => {
    const agentSettings = settings.get('agent');
    await settings.set('agent', { ...agentSettings, permissionMode: modeSel.value as 'ask' | 'auto' });
    toast(t('settings.saved'), 'success');
  });
  row(body, t('agent.permissionTitle'), modeSel, '“ask” shows a confirmation before every write/git/exec action.');

  const steps = el('input', { type: 'number', value: String(settings.get('agent').maxSteps), min: '3', max: '100' }) as HTMLInputElement;
  steps.addEventListener('change', async () => {
    const agentSettings = settings.get('agent');
    await settings.set('agent', { ...agentSettings, maxSteps: Number(steps.value) || 25 });
  });
  row(body, t('agent.maxSteps', { steps: settings.get('agent').maxSteps }), steps);

  body.appendChild(el('div', { class: 'group-title' }, 'Toolbox'));
  const tools = agents.listTools();
  const list = el('ul', { class: 'muted', style: 'padding-left:18px' });
  for (const tool of tools) {
    list.appendChild(el('li', {}, el('b', {}, tool.name), ` — ${tool.description}`));
  }
  body.appendChild(list);
}

export function initSettingsSync(): void {
  bus.on<{ key: string }>('settings:change', ({ key }) => {
    if (key === 'theme' || key === '*') {
      document.documentElement.dataset.theme = settings.get('theme');
    }
  });
}
