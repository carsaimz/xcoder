/** Inline SVG icon set (stroke = currentColor). Registered at boot. */
import { registerIcons, iconSvg } from '@lib/dom';

const S = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="%SIZE%" height="%SIZE%" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const F = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="%SIZE%" height="%SIZE%" viewBox="0 0 16 16" fill="currentColor" stroke="none">${body}</svg>`;

export const ICONS: Record<string, string> = {
  menu: S('<path d="M2 4h12M2 8h12M2 12h12"/>'),
  'more-vert': F('<circle cx="8" cy="3" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="8" cy="13" r="1.4"/>'),
  play: F('<path d="M4.5 2.8v10.4c0 .6.65.97 1.17.66l8.1-5.2a.78.78 0 0 0 0-1.32l-8.1-5.2a.78.78 0 0 0-1.17.66z"/>'),
  command: S('<circle cx="4" cy="4" r="2"/><circle cx="12" cy="4" r="2"/><circle cx="4" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><path d="M6 6l4 4M10 6l-4 4"/>'),
  save: S('<path d="M3 2h8l3 3v9H3z"/><path d="M5 2v4h6V2M5 14v-5h6v5"/>'),
  settings: S('<circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"/>'),
  'file-plus': S('<path d="M4 1.5h5l3 3V14H4z"/><path d="M9 1.5V5h3M8 8v4M6 10h4"/>'),
  'folder-plus': S('<path d="M1.5 3.5h4l1.5 2h7.5v8h-13z"/><path d="M8 8v4M6 10h4"/>'),
  refresh: S('<path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9"/><path d="M13.5 1.5v3h-3"/>'),
  close: S('<path d="M3 3l10 10M13 3L3 13"/>'),
  folder: S('<path d="M1.5 3.5h4l1.5 2h7.5v8h-13z"/>'),
  file: S('<path d="M4 1.5h5l3 3V14H4z"/><path d="M9 1.5V5h3"/>'),
  chevron: S('<path d="M6 3l5 5-5 5"/>'),
  'chevron-down': S('<path d="M3 6l5 5 5-5"/>'),
  'chevron-up': S('<path d="M3 10l5-5 5 5"/>'),
  'arrow-left': S('<path d="M13 8H3M7 4L3 8l4 4"/>'),
  'arrow-right': S('<path d="M3 8h10M9 4l4 4-4 4"/>'),
  'arrow-up': S('<path d="M8 13V3M4 7l4-4 4 4"/>'),
  'arrow-down': S('<path d="M8 3v10M4 9l4 4 4-4"/>'),
  'tab-key': S('<path d="M1.5 8h9M7.5 4.5L11 8l-3.5 3.5M13.5 3.5v9"/>'),
  undo: S('<path d="M3 6h7a3.5 3.5 0 0 1 0 7H6"/><path d="M6 3L3 6l3 3"/>'),
  redo: S('<path d="M13 6H6a3.5 3.5 0 0 0 0 7h4"/><path d="M10 3l3 3-3 3"/>'),
  paste: S('<rect x="4" y="3" width="8" height="11" rx="1"/><path d="M6 3a2 2 0 0 1 4 0M6.5 7h3M6.5 10h3"/>'),
  'select-all': S('<rect x="2.5" y="2.5" width="11" height="11" rx="1" stroke-dasharray="2.4 2"/><path d="M5 8h6M8 5v6"/>'),
  'move-line-up': S('<path d="M3 12.5h10M8 9V3.5M5.5 6L8 3.5 10.5 6"/>'),
  'move-line-down': S('<path d="M3 3.5h10M8 7v5.5M5.5 10L8 12.5 10.5 10"/>'),
  'copy-line-up': S('<path d="M5 8.5V5.7L8 3l3 2.7v2.8M3 12.5h10"/><path d="M6 5.5h4"/>'),
  'copy-line-down': S('<path d="M5 7.5v2.8L8 13l3-2.7V7.5M3 3.5h10"/><path d="M6 10.5h4"/>'),
  goto: S('<path d="M3 13V8a2 2 0 0 1 2-2h8M10 3l3 3-3 3"/>'),
  info: S('<circle cx="8" cy="8" r="6"/><path d="M8 7.5V11M8 5h.01"/>'),
  terminal: S('<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M4 6l2.5 2L4 10M8.5 10.5h4"/>'),
  search: S('<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>'),
  'git-branch': S('<circle cx="4" cy="3.5" r="1.8"/><circle cx="4" cy="12.5" r="1.8"/><circle cx="12" cy="5" r="1.8"/><path d="M4 5.3v5.4M12 6.8c0 3-4 2.5-5.5 4"/>'),
  alert: S('<path d="M8 2L1.5 13.5h13z"/><path d="M8 7v3M8 12h.01"/>'),
  'x-circle': S('<circle cx="8" cy="8" r="6"/><path d="M6 6l4 4M10 6l-4 4"/>'),
  palette: S('<path d="M8 1.5a6.5 6.5 0 1 0 0 13c1.2 0 1.6-.8 1.2-1.6-.5-1 .2-1.9 1.3-1.9h1.5A2.5 2.5 0 0 0 14.5 8 6.5 6.5 0 0 0 8 1.5z"/><circle cx="5.5" cy="6" r=".8" fill="currentColor"/><circle cx="8" cy="4.5" r=".8" fill="currentColor"/><circle cx="10.5" cy="6" r=".8" fill="currentColor"/>'),
  ai: S('<path d="M8 1.5l1.4 3.4 3.4 1.4-3.4 1.4L8 11.1 6.6 7.7 3.2 6.3l3.4-1.4z"/><path d="M12.5 10.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/><path d="M3.5 11.5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z"/>'),
  send: S('<path d="M14 2L7 9M14 2L9.5 14 7 9 2 6.5z"/>'),
  stop: S('<rect x="4" y="4" width="8" height="8" rx="1"/>'),
  plus: S('<path d="M8 3v10M3 8h10"/>'),
  trash: S('<path d="M3 4.5h10M6.5 4.5v-1a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M4.5 4.5l.7 9a1 1 0 0 0 1 .9h3.6a1 1 0 0 0 1-.9l.7-9"/>'),
  copy: S('<rect x="5.5" y="5.5" width="8" height="8" rx="1"/><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/>'),
  'pin': S('<path d="M9.5 1.5l5 5-2.2.6-2.8 2.8-.4 3.3-4.3-4.3L1.5 12l3.1-3.3L.3 4.4l3.3-.4L6.4 1.2z" transform="translate(1.5 1)"/>'),
  spark: S('<path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2"/>')
};

export function registerIconSet(): void {
  registerIcons(ICONS);
}

/** Inject icons into the fixed chrome buttons declared in index.html. */
export function hydrateChromeIcons(): void {
  const map: Record<string, [string, number]> = {
    'btn-menu': ['menu', 20],
    'btn-run': ['play', 20],
    'btn-kebab': ['more-vert', 20],
    'btn-settings-close': ['arrow-left', 20],
    'rail-files': ['folder', 20],
    'rail-search': ['search', 20],
    'btn-ai': ['ai', 20],
    'btn-settings': ['settings', 20],
    'btn-new-file': ['file-plus', 18],
    'btn-new-folder': ['folder-plus', 18],
    'btn-refresh': ['refresh', 18],
    'btn-sif-clear': ['close', 16],
    'btn-term-new': ['plus', 16],
    'btn-term-close': ['close', 16],
    'plugin-pages-close': ['close', 18]
  };
  for (const [id, [name, size]] of Object.entries(map)) {
    const btn = document.getElementById(id);
    if (btn && !btn.innerHTML.trim()) btn.innerHTML = iconSvg(name, size);
  }
}
