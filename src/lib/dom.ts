/**
 * DOM helpers. Only loaded in the app bundle (browser/WebView).
 */

export function $<T extends Element = HTMLElement>(
  sel: string,
  root: ParentNode = document
): T {
  const el = root.querySelector(sel);
  if (!el) throw new Error(`[xcoder] missing element: ${sel}`);
  return el as T;
}

export function $maybe<T extends Element = HTMLElement>(
  sel: string,
  root: ParentNode = document
): T | null {
  return root.querySelector(sel) as T | null;
}

type Attrs = Record<
  string,
  | string
  | number
  | boolean
  | undefined
  | Record<string, string>
  | ((e: Event) => void)
>;

/** Create an element with attributes and children in one call. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs,
  ...children: Array<Node | string | null | undefined>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === false) continue;
      if (typeof v === 'function') {
        // onclick → click, onchange → change …
        const evt = k.startsWith('on') ? k.slice(2).toLowerCase() : k;
        node.addEventListener(evt, v as EventListener);
      } else if (k === 'class') node.className = String(v);
      else if (k === 'text') node.textContent = String(v);
      else if (k === 'html') node.innerHTML = String(v);
      else if (k === 'dataset' && typeof v === 'object') {
        for (const [dk, dv] of Object.entries(v as Record<string, string>)) {
          node.dataset[dk] = dv;
        }
      } else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, String(v));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

/** Remove all children of a node. */
export function clearNode(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Icon injection point: ui/components/icons.ts registers SVG strings here. */
const iconRegistry = new Map<string, string>();

export function registerIcons(map: Record<string, string>): void {
  for (const [name, svg] of Object.entries(map)) iconRegistry.set(name, svg);
}

export function hasIcon(name: string): boolean {
  return iconRegistry.has(name);
}

/** Returns inline SVG markup for a registered icon (or a square placeholder). */
export function iconSvg(name: string, size = 16): string {
  const svg = iconRegistry.get(name);
  if (!svg) return `<span class="icon-missing" style="width:${size}px;height:${size}px"></span>`;
  return svg.replace('%SIZE%', String(size));
}

/** Build an element containing an inline icon. */
export function iconEl(name: string, size = 16): HTMLSpanElement {
  const span = el('span', { class: 'icon', 'aria-hidden': 'true' });
  span.innerHTML = iconSvg(name, size);
  return span;
}
