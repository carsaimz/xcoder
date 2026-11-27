import { EditorView, ViewPlugin } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { Text } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import type { ViewUpdate } from "@codemirror/view";
import type { Tree } from "@lezer/common";

/**
 * Sticky scroll — VS Code port (roadmap 🧩 item 1).
 *
 * When the top of the viewport is inside a nested scope (function inside
 * class inside …), the opening lines of the enclosing scopes stay pinned
 * below the editor's top edge, each on its own row, so the context of the
 * code being read never scrolls away. Tapping a pinned row scrolls that
 * scope's opening line into view.
 *
 * The chain is derived from the Lezer syntax tree: starting at the first
 * visible position, every ancestor block that begins ABOVE the viewport
 * contributes one header row (outermost first, at most MAX_STICKY_ROWS).
 * Languages without a syntax tree get no headers (same as plain files in
 * VS Code). The whole feature is behind the `stickyScroll` setting
 * (editorManager compartment), on by default.
 */

/** Maximum number of pinned header rows (VS Code default caps at 5; 3
 * keeps the overlay small on phone screens). */
export const MAX_STICKY_ROWS = 3;

/**
 * Pure core: the line numbers (1-based, outermost scope first) whose
 * opening lines should stay pinned for a viewport top position.
 * @param tree syntax tree of the document
 * @param doc document text
 * @param topPos document position at the top edge of the viewport
 * @returns line numbers, outermost first
 */
export function collectStickyHeaders(
        tree: Tree | null,
        doc: Text,
        topPos: number,
): number[] {
        if (!(tree && doc instanceof Text) || !(topPos > 0)) return [];
        const topLine = doc.lineAt(Math.min(topPos, doc.length)).number;
        const headers: number[] = [];
        let node = tree.resolveInner(Math.min(topPos, doc.length), -1);
        while (node && headers.length < MAX_STICKY_ROWS) {
                const parent = node.parent;
                if (!parent) break;
                const line = doc.lineAt(Math.min(parent.from, doc.length)).number;
                if (line < topLine && !headers.includes(line)) headers.push(line);
                node = parent;
        }
        return headers.reverse();
}

const baseTheme = EditorView.theme({
        "&": { position: "relative" },
        ".cm-stickyScroll": {
                position: "absolute",
                top: "0",
                left: "0",
                right: "0",
                zIndex: "8",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                pointerEvents: "none",
        },
        ".cm-stickyScrollRow": {
                pointerEvents: "auto",
                cursor: "pointer",
                whiteSpace: "pre",
                overflow: "hidden",
                textOverflow: "ellipsis",
                padding: "0 8px 0 12px",
                lineHeight: "1.5",
        },
        ".cm-stickyScrollRow:hover": { filter: "brightness(1.15)" },
});

class StickyHeaderView {
        view: EditorView;
        rows: HTMLElement[];
        dom: HTMLElement;
        onScroll: () => void;
        frame: number;

        /**
         * @param view the editor view
         */
        constructor(view: EditorView) {
                this.view = view;
                this.rows = [];
                this.dom = document.createElement("div");
                this.dom.className = "cm-stickyScroll";
                this.dom.setAttribute("aria-hidden", "true");
                view.dom.appendChild(this.dom);
                this.onScroll = () => this.scheduleRender();
                view.scrollDOM.addEventListener("scroll", this.onScroll, {
                        passive: true,
                });
                this.frame = 0;
                this.render();
        }

        /**
         * @param update the view update
         */
        update(update: ViewUpdate) {
                if (
                        update.docChanged ||
                        update.viewportChanged ||
                        update.geometryChanged ||
                        update.selectionSet ||
                        update.focusChanged
                ) {
                        // theme/fonts may have changed — styles are re-cached on render
                        this.scheduleRender();
                }
        }

        scheduleRender() {
                if (this.frame) return;
                this.frame = requestAnimationFrame(() => {
                        this.frame = 0;
                        this.render();
                });
        }

        render() {
                const view = this.view;
                const doc = view.state.doc;
                const headers = collectStickyHeaders(
                        syntaxTree(view.state),
                        doc,
                        this.topPos(),
                );

                // cap the overlay at 40% of the visible editor height (VS Code's
                // maxLineCount behaviour) — never taller than MAX_STICKY_ROWS
                const rowHeight = view.defaultLineHeight * 1.5;
                const maxRows = Math.max(
                        1,
                        Math.floor((view.scrollDOM.clientHeight * 0.4) / rowHeight),
                );
                const shown = headers.slice(0, Math.min(maxRows, MAX_STICKY_ROWS));

                if (!shown.length) {
                        this.clear();
                        return;
                }

                // match the editor's look — fonts from the content, colors from the
                // editor theme (cached between renders, refreshed on transactions)
                this.syncStyles();

                while (this.rows.length > shown.length) {
                        const last = this.rows.pop();
                        if (last) last.remove();
                }
                shown.forEach((lineNumber, index) => {
                        const text = doc.line(lineNumber).text;
                        let row = this.rows[index];
                        if (!row) {
                                row = document.createElement("div");
                                row.className = "cm-stickyScrollRow";
                                row.addEventListener("click", () => {
                                        const pos = this.view.state.doc.line(lineNumber).from;
                                        this.view.dispatch({
                                                effects: EditorView.scrollIntoView(pos, { y: "start" }),
                                        });
                                });
                                this.rows.push(row);
                                this.dom.appendChild(row);
                        }
                        row.textContent = text || " ";
                        row.style.borderBottom =
                                index === shown.length - 1
                                        ? "1px solid var(--hairline, rgba(128,128,128,.25))"
                                        : "none";
                });
        }

        /** Document position at the top edge of the viewport. */
        topPos() {
                const view = this.view;
                const coords = view.coordsAtPos(0);
                if (!coords) return 0;
                const top = view.scrollDOM.getBoundingClientRect().top;
                const point = view.posAtCoords({
                        x: coords.left,
                        y: top + 1,
                });
                return typeof point === "number" ? point : 0;
        }

        syncStyles() {
                const view = this.view;
                const content = getComputedStyle(view.contentDOM);
                const editor = getComputedStyle(view.dom);
                this.dom.style.fontFamily = content.fontFamily;
                this.dom.style.fontSize = content.fontSize;
                this.dom.style.backgroundColor = editor.backgroundColor;
                this.dom.style.color = content.color;
        }

        clear() {
                this.rows.forEach((row) => row.remove());
                this.rows = [];
        }

        destroy() {
                this.view.scrollDOM.removeEventListener("scroll", this.onScroll);
                this.clear();
                this.dom.remove();
        }
}

/**
 * Sticky scroll extension — enable via the `stickyScroll` setting.
 * @returns {Extension}
 */
export function stickyScroll() {
        return [baseTheme, ViewPlugin.fromClass(StickyHeaderView)];
}

export default stickyScroll;
