import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/**
 * Minimap bridge — a tiny update bus between CodeMirror and the DOM
 * minimap component (components/minimap). The extension is pure: it only
 * records that a view needs a repaint; the minimap component subscribes
 * and does the (debounced) rendering, so unit tests can exercise the bus
 * without instantiating CodeMirror.
 */

type Listener = (view: EditorView) => void;

const listeners = new Set<Listener>();

/** Subscribe a renderer; returns an unsubscribe function. */
export function onMinimapUpdate(listener: Listener): () => void {
        listeners.add(listener);
        return () => {
                listeners.delete(listener);
        };
}

/** Fire for views whose doc/geometry/viewport changed. */
function notify(view: EditorView): void {
        listeners.forEach((listener) => {
                try {
                        listener(view);
                } catch (error) {
                        console.warn("minimap listener failed", error);
                }
        });
}

/** CodeMirror extension: repaint triggers for the minimap. */
export const minimapUpdateExtension: Extension = EditorView.updateListener.of(
        (update) => {
                if (
                        update.docChanged ||
                        update.geometryChanged ||
                        update.viewportChanged ||
                        update.selectionSet
                ) {
                        notify(update.view);
                }
        },
);

export default minimapUpdateExtension;
