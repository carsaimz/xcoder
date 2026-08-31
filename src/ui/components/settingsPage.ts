/**
 * Settings page (right drawer): appearance, editor, language, terminal,
 * plugins, about.
 */
import { el, clearNode, $ } from '@lib/dom';
import { settings } from '@api/settings';
import { editorThemes } from '@api/editorThemes';
import { pluginsApi } from '@api/plugins/public';
import { providersByTier, TIER_ORDER, TIER_LABELS } from '@core/ai/providers';
import { i18n } from '@lib/i18n';
import { xcoder } from '@api/xcoder';

export function mountSettings(): void {
  const overlay = $('#settings-overlay');
  $('#btn-settings').addEventListener('click', () => {
    overlay.classList.remove('hidden');
    render();
  });
  $('#btn-settings-close').addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
}

function render(): void {
  const body = $('#settings-body');
  clearNode(body);

  body.append(
    appearanceSection(),
    editorSection(),
    languageSection(),
    terminalSection(),
    aiSection(),
    pluginsSection(),
    aboutSection()
  );
}

function section(title: string, ...rows: HTMLElement[]): HTMLElement {
  return el('div', { class: 'settings-section' }, el('h3', {}, title), ...rows);
}

function taggedSection(tag: string, title: string, ...rows: HTMLElement[]): HTMLElement {
  return el('div', { class: `settings-section ${tag}` }, el('h3', {}, title), ...rows);
}

function appearanceSection(): HTMLElement {
  const themeSelect = el('select', {});
  for (const theme of editorThemes.list()) {
    themeSelect.append(
      el('option', { value: theme.id, selected: settings.get('theme') === theme.id }, theme.name)
    );
  }
  themeSelect.addEventListener('change', () => void editorThemes.set(themeSelect.value));

  const wrapSwitch = makeSwitch(settings.get('wordWrap'), async (on) => {
    await settings.set('wordWrap', on);
  });

  const autoSave = makeSwitch(settings.get('autoSave'), async (on) => {
    await settings.set('autoSave', on);
  });

  return section(
    i18n.t('settings.appearance'),
    settingRow('Theme', themeSelect),
    settingRow('Word wrap', wrapSwitch),
    settingRow('Auto save', autoSave, i18n.t('settings.autoSaveHint'))
  );
}

function editorSection(): HTMLElement {
  const fontSize = el('input', {
    type: 'range',
    min: '10',
    max: '30',
    value: String(settings.get('fontSize'))
  }) as HTMLInputElement;
  const fontSizeVal = el('span', { text: `${settings.get('fontSize')}px` });
  fontSize.addEventListener('input', () => {
    fontSizeVal.textContent = `${fontSize.value}px`;
  });
  fontSize.addEventListener('change', () => {
    void settings.set('fontSize', Number(fontSize.value));
  });

  const tabSize = el('select', {});
  for (const size of [2, 4, 8]) {
    tabSize.append(
      el('option', { value: String(size), selected: settings.get('tabSize') === size }, String(size))
    );
  }
  tabSize.addEventListener('change', () => {
    void settings.set('tabSize', Number(tabSize.value) as 2 | 4 | 8);
  });

  return section(
    i18n.t('settings.editor'),
    settingRow('Font size', el('span', { class: 'inline-range' }, fontSize, fontSizeVal)),
    settingRow('Tab size', tabSize)
  );
}

function languageSection(): HTMLElement {
  const select = el('select', {});
  const options = i18n.available().sort();
  for (const code of options) {
    select.append(el('option', { value: code, selected: settings.get('lang') === code }, code));
  }
  select.addEventListener('change', async () => {
    await settings.set('lang', select.value);
    location.reload();
  });
  return section(i18n.t('settings.language'), settingRow('UI Language', select), el('p', { class: 'setting-hint' }, i18n.t('settings.languageHint')));
}

function terminalSection(): HTMLElement {
  const fontSize = el('input', {
    type: 'range',
    min: '9',
    max: '22',
    value: String(settings.get('terminal.fontSize'))
  }) as HTMLInputElement;
  const fontSizeVal = el('span', { text: `${settings.get('terminal.fontSize')}px` });
  fontSize.addEventListener('input', () => {
    fontSizeVal.textContent = `${fontSize.value}px`;
  });
  fontSize.addEventListener('change', () => {
    void settings.set('terminal.fontSize', Number(fontSize.value));
  });
  return section(i18n.t('settings.terminal'), settingRow('Font size', el('span', { class: 'inline-range' }, fontSize, fontSizeVal)));
}

function aiSection(): HTMLElement {
  const custom = settings.get('ai.customProviders');
  const grouped = providersByTier(custom);
  const currentProviderId = settings.get('ai.provider');

  // provider picker grouped by tier (Free / Paid·free-tier / Premium)
  const providerSelect = el('select', {});
  for (const tier of TIER_ORDER) {
    if (!grouped[tier].length) continue;
    const og = el('optgroup', { label: TIER_LABELS[tier] });
    for (const p of grouped[tier]) {
      og.append(el('option', { value: p.id, selected: p.id === currentProviderId }, p.name));
    }
    providerSelect.append(og);
  }
  providerSelect.addEventListener('change', async () => {
    const all = [...grouped.free, ...grouped.freemium, ...grouped.premium];
    const next = all.find((p) => p.id === providerSelect.value);
    await settings.set('ai.provider', providerSelect.value);
    if (next?.models.length) await settings.set('ai.model', next.models[0].id);
    render();
  });

  const resolved = [...grouped.free, ...grouped.freemium, ...grouped.premium].find(
    (p) => p.id === currentProviderId
  );

  // API key for the current provider
  const keys = { ...(settings.get('ai.keys') as Record<string, string>) };
  const keyInput = el('input', {
    type: 'password',
    value: keys[currentProviderId] ?? '',
    placeholder: resolved?.needsKey ? 'sk-…' : '(not required)',
    autocomplete: 'off'
  }) as HTMLInputElement;
  const keyBtn = el(
    'button',
    {
      class: 'btn',
      onclick: async () => {
        keys[currentProviderId] = keyInput.value.trim();
        await settings.set('ai.keys', keys);
        const { toast } = await import('@api/toast');
        toast.success(i18n.t('settings.aiKeySaved'));
      }
    },
    i18n.t('settings.aiTestKey')
  );

  // model combobox with provider suggestions
  const modelInput = el('input', {
    type: 'text',
    value: settings.get('ai.model'),
    list: 'ai-model-list',
    spellcheck: 'false'
  }) as HTMLInputElement;
  const datalist = el('datalist', { id: 'ai-model-list' });
  for (const m of resolved?.models ?? []) datalist.append(el('option', { value: m.id }, m.name));
  modelInput.addEventListener('change', () => void settings.set('ai.model', modelInput.value.trim()));

  const approval = el('select', {});
  for (const mode of ['careful', 'balanced', 'auto'] as const) {
    approval.append(
      el('option', { value: mode, selected: settings.get('ai.approval') === mode }, mode)
    );
  }
  approval.addEventListener('change', () => {
    void settings.set('ai.approval', approval.value as 'careful' | 'balanced' | 'auto');
  });

  const temp = el('input', {
    type: 'range', min: '0', max: '1', step: '0.1',
    value: String(settings.get('ai.temperature'))
  }) as HTMLInputElement;
  const tempVal = el('span', { text: String(settings.get('ai.temperature')) });
  temp.addEventListener('input', () => (tempVal.textContent = temp.value));
  temp.addEventListener('change', () => void settings.set('ai.temperature', Number(temp.value)));

  const maxTokens = el('input', {
    type: 'number', min: '256', max: '32768', step: '256',
    value: String(settings.get('ai.maxTokens'))
  }) as HTMLInputElement;
  maxTokens.addEventListener('change', () => void settings.set('ai.maxTokens', Number(maxTokens.value)));

  const maxTurns = el('input', {
    type: 'number', min: '4', max: '64',
    value: String(settings.get('ai.maxTurns'))
  }) as HTMLInputElement;
  maxTurns.addEventListener('change', () => void settings.set('ai.maxTurns', Number(maxTurns.value)));

  const streaming = makeSwitch(settings.get('ai.streaming'), (on) => settings.set('ai.streaming', on));

  // custom providers (JSON array)
  const customJson = el('textarea', {
    class: 'ai-json',
    spellcheck: 'false',
    placeholder: i18n.t('settings.aiCustomHint')
  }) as HTMLTextAreaElement;
  if (custom.length) customJson.value = JSON.stringify(custom, null, 2);
  const customBtn = el(
    'button',
    {
      class: 'btn',
      onclick: async () => {
        const { toast } = await import('@api/toast');
        try {
          const parsed = JSON.parse(customJson.value || '[]') as typeof custom;
          if (!Array.isArray(parsed)) throw new Error('not an array');
          for (const c of parsed) {
            if (!c.id || !c.baseURL) throw new Error('each provider needs id and baseURL');
          }
          await settings.set('ai.customProviders', parsed);
          toast.success('OK');
          render();
        } catch (err) {
          toast.error(`Invalid JSON: ${err instanceof Error ? err.message : err}`);
        }
      }
    },
    'OK'
  );

  const sec = taggedSection(
    'ai',
    i18n.t('settings.ai'),
    settingRow(i18n.t('settings.aiProvider'), providerSelect),
    settingRow(i18n.t('settings.aiKey', { provider: resolved?.name ?? currentProviderId }), el('span', { class: 'inline-range' }, keyInput, keyBtn), i18n.t('settings.aiKeyHint')),
    settingRow(i18n.t('settings.aiModel'), modelInput),
    datalist,
    settingRow(i18n.t('settings.aiApproval'), approval, i18n.t('settings.aiApprovalHint')),
    settingRow(i18n.t('settings.aiTemperature'), el('span', { class: 'inline-range' }, temp, tempVal)),
    settingRow(i18n.t('settings.aiMaxTokens'), maxTokens),
    settingRow(i18n.t('settings.aiMaxTurns'), maxTurns),
    settingRow(i18n.t('settings.aiStreaming'), streaming),
    el('div', { class: 'setting-hint' }, i18n.t('settings.aiCustomProviders')),
    customJson,
    customBtn,
    el('p', { class: 'setting-hint' }, i18n.t('settings.aiCustomHint'))
  );
  sec.classList.add('ai');
  return sec;
}

function pluginsSection(): HTMLElement {
  const container = el('div', {});
  void (async () => {
    const list = await pluginsApi.list();
    for (const record of list) {
      const toggle = makeSwitch(record.enabled, async (on) => {
        try {
          if (on) await pluginsApi.enable(record.id);
          else await pluginsApi.disable(record.id);
          render();
        } catch (err) {
          console.error(err);
        }
      });
      container.append(
        el(
          'div',
          { class: 'plugin-row' },
          el(
            'div',
            { class: 'setting-row', style: 'flex:1' },
            el(
              'div',
              {},
              el('div', { class: 'p-name' }, record.name),
              el('div', { class: 'p-meta' }, `${record.id} · v${record.version}`)
            )
          ),
          toggle
        )
      );
    }
    const installBtn = el(
      'button',
      {
        class: 'btn',
        onclick: async () => {
          const { dialog } = await import('@api/dialog');
          const { toast } = await import('@api/toast');
          const url = await dialog.prompt(
            'Install plugin',
            'Directory URL containing plugin.json',
            { placeholder: 'https://example.com/my-plugin/' }
          );
          if (!url) return;
          try {
            await pluginsApi.install({ dirUrl: url });
            toast.success('Plugin installed — enable it below');
            render();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
          }
        }
      },
      'Install from URL…'
    );
    container.append(installBtn);
  })();
  return taggedSection('plugins', 'Plugins', container);
}

function aboutSection(): HTMLElement {
  return section(
    'About',
    el(
      'div',
      { class: 'about-block' },
      el('p', {}, el('strong', {}, 'XCoder'), ` v${xcoder.version} — mobile-first code editor & IDE.`),
      el(
        'p',
        {},
        'Engine: CodeMirror 6 · Bundler: Rspack · Tests: Vitest · Bridge: Apache Cordova.'
      ),
      el('p', {}, 'Original project — all code written for XCoder.')
    )
  );
}

function settingRow(label: string, control: HTMLElement, hint?: string): HTMLElement {
  return el(
    'div',
    { class: 'setting-row' },
    el(
      'label',
      {},
      label,
      hint ? el('span', { class: 'setting-hint' }, hint) : null
    ),
    control
  );
}

function makeSwitch(initial: boolean, onChange: (on: boolean) => Promise<void>): HTMLElement {
  const sw = el('div', { class: `switch${initial ? ' on' : ''}`, role: 'switch', 'aria-checked': String(initial) });
  sw.addEventListener('click', async () => {
    const next = !sw.classList.contains('on');
    sw.classList.toggle('on', next);
    sw.setAttribute('aria-checked', String(next));
    await onChange(next);
  });
  return sw;
}
