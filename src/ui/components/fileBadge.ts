/**
 * Colored file-type badges (extension → tinted tile), tinted tiles.
 * Own color mapping — no external icon fonts.
 */

const EXT_META: Record<string, { label: string; color: string }> = {
  js: { label: 'JS', color: '#b8860b' },
  mjs: { label: 'JS', color: '#b8860b' },
  cjs: { label: 'JS', color: '#b8860b' },
  jsx: { label: 'JSX', color: '#61dafb' },
  ts: { label: 'TS', color: '#3178c6' },
  tsx: { label: 'TSX', color: '#3178c6' },
  json: { label: '{ }', color: '#8bc34a' },
  html: { label: '<>', color: '#e34f26' },
  htm: { label: '<>', color: '#e34f26' },
  css: { label: 'CSS', color: '#5c8adb' },
  scss: { label: 'SCS', color: '#c6538c' },
  less: { label: 'LES', color: '#5c8adb' },
  md: { label: 'MD', color: '#519aba' },
  markdown: { label: 'MD', color: '#519aba' },
  py: { label: 'PY', color: '#3572a5' },
  rb: { label: 'RB', color: '#cc342d' },
  go: { label: 'GO', color: '#00add8' },
  rs: { label: 'RS', color: '#de9a52' },
  java: { label: 'JV', color: '#b07219' },
  kt: { label: 'KT', color: '#a97bff' },
  c: { label: 'C', color: '#8a8a8a' },
  cpp: { label: 'C++', color: '#f34b7d' },
  cs: { label: 'C#', color: '#178600' },
  php: { label: 'PHP', color: '#777bb3' },
  sh: { label: 'SH', color: '#89e051' },
  bash: { label: 'SH', color: '#89e051' },
  yml: { label: 'YML', color: '#cb171e' },
  yaml: { label: 'YML', color: '#cb171e' },
  xml: { label: 'XML', color: '#e37933' },
  sql: { label: 'SQL', color: '#e38c00' },
  txt: { label: 'TXT', color: '#9aa0a6' },
  log: { label: 'LOG', color: '#9aa0a6' },
  png: { label: 'IMG', color: '#a074c4' },
  jpg: { label: 'IMG', color: '#a074c4' },
  jpeg: { label: 'IMG', color: '#a074c4' },
  gif: { label: 'IMG', color: '#a074c4' },
  svg: { label: 'SVG', color: '#ffb13b' },
  zip: { label: 'ZIP', color: '#8d6e63' },
  pdf: { label: 'PDF', color: '#d93831' }
};

export function fileBadge(fileName: string): HTMLElement {
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
  const meta = EXT_META[ext];
  const el = document.createElement('span');
  el.className = 'ft-badge';
  if (meta) {
    el.textContent = meta.label;
    el.style.background = meta.color;
    el.style.color = readableOn(meta.color);
  } else {
    el.textContent = (ext || '·').slice(0, 3);
    el.style.background = 'var(--bg-elev)';
    el.style.color = 'var(--text-dim)';
  }
  return el;
}

/** Pick white/black text for badge backgrounds. */
function readableOn(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1c1c1c' : '#ffffff';
}
