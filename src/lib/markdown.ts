/**
 * Minimal, dependency-free Markdown → HTML renderer.
 * Security-first: the source is fully HTML-escaped BEFORE any tag is
 * generated, so user content can never inject markup. Supports the
 * common subset: headings, hr, fenced + inline code, emphasis, links,
 * images, blockquotes, ordered/unordered lists, task lists and tables.
 */

const ESC: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESC[ch]);
}

/** Inline pass: code, bold, italic, strike, links, images. Input already escaped. */
function renderInline(text: string): string {
  let out = text;
  // inline code first so its content is not further processed
  out = out.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
  // images ![alt](src) — src restricted to http(s)/data
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, alt: string, src: string) => {
    if (!/^(https?:\/\/|data:image\/)/i.test(src)) return match;
    return `<img src="${src}" alt="${alt}" loading="lazy">`;
  });
  // links [label](href) — href restricted to http(s)/mailto/relative
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, href: string) => {
    if (!/^(https?:\/\/|mailto:|\.?\/|#)/i.test(href)) return match;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return out;
}

function renderTable(rows: string[]): string {
  const cells = rows.map((row) =>
    row.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()),
  );
  const head = cells[0];
  const body = cells.slice(2); // skip separator row
  const th = head.map((c) => `<th>${renderInline(c)}</th>`).join('');
  const trs = body
    .map((row) => `<tr>${row.map((c) => `<td>${renderInline(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

/**
 * Core renderer over ALREADY-ESCAPED lines. Recursion (blockquotes) stays
 * inside this function so content is never escaped twice.
 */
function renderBlocks(lines: string[]): string {
  const html: string[] = [];
  let i = 0;
  let listStack: 'ul' | 'ol' | null = null;
  const closeListTag = (): void => {
    if (listStack) {
      html.push(`</${listStack}>`);
      listStack = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      closeListTag();
      const lang = fence[1];
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      const cls = lang ? ` class="language-${lang}"` : '';
      html.push(`<pre><code${cls}>${buf.join('\n')}</code></pre>`);
      continue;
    }

    // heading
    const head = line.match(/^(#{1,6})\s+(.*)$/);
    if (head) {
      closeListTag();
      const level = head[1].length;
      html.push(`<h${level}>${renderInline(head[2])}</h${level}>`);
      i++;
      continue;
    }

    // horizontal rule
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      closeListTag();
      html.push('<hr>');
      i++;
      continue;
    }

    // table: header row + separator
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      closeListTag();
      const rows: string[] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i]);
        i++;
      }
      html.push(renderTable(rows));
      continue;
    }

    // blockquote (recursion over already-escaped lines)
    if (/^&gt;\s?/.test(line)) {
      closeListTag();
      const buf: string[] = [];
      while (i < lines.length && /^&gt;\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^&gt;\s?/, ''));
        i++;
      }
      html.push(`<blockquote>${renderBlocks(buf)}</blockquote>`);
      continue;
    }

    // lists (supports task list items)
    const li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (li) {
      const ordered = /\d/.test(li[2]);
      const want: 'ul' | 'ol' = ordered ? 'ol' : 'ul';
      if (listStack !== want) {
        closeListTag();
        html.push(`<${want}>`);
        listStack = want;
      }
      let item = li[3];
      const task = item.match(/^\[([ xX])\]\s+(.*)$/);
      if (task) {
        const checked = task[1].toLowerCase() === 'x';
        item = `<input type="checkbox" disabled${checked ? ' checked' : ''}> ${renderInline(task[2])}`;
      } else {
        item = renderInline(item);
      }
      html.push(`<li>${item}</li>`);
      i++;
      continue;
    }

    // paragraph (gather until blank line or block start)
    if (line.trim()) {
      closeListTag();
      const buf: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(#{1,6}\s|```|\s*[-*+]\s|\s*\d+[.)]\s|&gt;|\s*\|)/.test(lines[i])
      ) {
        buf.push(lines[i]);
        i++;
      }
      html.push(`<p>${renderInline(buf.join('\n'))}</p>`);
      continue;
    }

    i++;
  }
  closeListTag();
  return html.join('\n');
}

/** Render a Markdown document to a safe HTML string. */
export function renderMarkdown(src: string): string {
  return renderBlocks(escapeHtml(src).split(/\r?\n/));
}
