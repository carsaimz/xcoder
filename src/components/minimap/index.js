import "./style.scss";
import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { onMinimapUpdate } from "cm/minimapExtension";
import appSettings from "lib/settings";
import { lineMetrics, roleColor, scrollToFromClick, tokenRole } from "./utils";

/**
 * Minimap — the VS Code code overview on the right edge of the editor.
 * One instance per editor pane container (panes share ONE CodeMirror view
 * across their files, so this stays cheap): a canvas renders a scaled-down
 * document — block bars as the base layer, string/comment/number/keyword/
 * tag tokens colored via the Lezer syntax tree for docs up to 3000 lines —
 * plus a viewport slider. Tap/drag scrolls the editor.
 *
 * Toggle lives in Settings > Editor ("minimap"). Rendering is debounced
 * and capped so it stays cheap on phones.
 */

const MINIMAP_WIDTH = 76;
const LINE_HEIGHT = 2;
const CHAR_WIDTH = 1;
const MAX_CANVAS_HEIGHT = 6000;
const MAX_RENDER_LINES = 12000;
const RENDER_DEBOUNCE = 180;

/** @type {Map<HTMLElement, {un:()=>void, instance:object}>} */
const instances = new Map();
/** @type {boolean} */
let enabled = false;

/**
 * Attaches (or re-binds) the minimap of a pane container.
 * @param {import("@codemirror/view").EditorView} editorView the pane's view
 * @param {HTMLElement} container the pane's editor container
 */
export function attachMinimap(editorView, container) {
	if (!editorView || !container) return;
	let record = instances.get(container);
	if (!record) {
		record = createInstance(container);
		instances.set(container, record);
	}
	record.instance.setView(editorView);
	record.instance.refresh();
}

/** Shows/hides every minimap (Settings > Editor > minimap). */
export function setEnabled(value) {
	enabled = Boolean(value);
	instances.forEach((record) => record.instance.refresh());
}

/** Re-evaluates every instance (file switched — editor vs page gate). */
export function refreshAll() {
	instances.forEach((record) => record.instance.refresh());
}

/** Detaches and destroys every instance (tests / hot reload). */
export function destroy() {
	instances.forEach((record) => record.un());
	instances.clear();
}

/**
 * Creates one minimap bound to a pane container.
 * @param {HTMLElement} container
 * @returns {{un: () => void, instance: object}}
 */
function createInstance(container) {
	const canvas = (
		<canvas className="xc-minimap-canvas" width={MINIMAP_WIDTH} height={100} />
	);
	const slider = <div className="xc-minimap-slider" />;
	const host = (
		<div className="xc-minimap">
			{canvas}
			{slider}
		</div>
	);
	container.append(host);
	container.classList.add("pane-has-minimap");

	const state = {
		view: null,
		timer: null,
		dragging: false,
	};

	// tap / drag to scroll (viewport centers on the clicked position)
	const onPointer = (e) => {
		if (!state.view) return;
		e.preventDefault();
		const rect = canvas.getBoundingClientRect();
		const y = e.clientY - rect.top;
		state.view.scrollDOM.scrollTop = scrollToFromClick(
			y,
			rect.height,
			state.view.scrollDOM.scrollHeight,
			state.view.scrollDOM.clientHeight,
		);
		render();
	};
	host.addEventListener("pointerdown", (e) => {
		state.dragging = true;
		onPointer(e);
	});
	host.addEventListener("pointermove", (e) => {
		if (state.dragging) onPointer(e);
	});
	const stopDrag = () => {
		state.dragging = false;
	};
	window.addEventListener("pointerup", stopDrag);

	function scheduleRender() {
		if (!enabled) return;
		clearTimeout(state.timer);
		state.timer = setTimeout(render, RENDER_DEBOUNCE);
	}

	function refresh() {
		host.classList.toggle("show", enabled);
		if (enabled) scheduleRender();
	}

	function render() {
		if (!enabled || !state.view) return;
		const view = state.view;
		const cmState = view.state;
		if (!cmState?.doc) return;

		// live only for real editor files — pages (welcome, terminal,
		// previews) render inside the same container and get no strip
		const isEditorFile = view.__editorPane?.activeFile?.type === "editor";
		host.classList.toggle("empty", !isEditorFile);
		container.classList.toggle("minimap-live", Boolean(isEditorFile));
		if (!isEditorFile) {
			clear();
			return;
		}

		const scrollDOM = view.scrollDOM;
		const styles = getComputedStyle(scrollDOM);
		const fg = styles.color || "#ccc";
		const dark = isDarkColor(styles.backgroundColor);
		host.style.backgroundColor = styles.backgroundColor || "transparent";

		const doc = cmState.doc;
		if (!doc.lines) {
			clear();
			return;
		}

		// scale: 2px per line until the doc outgrows the canvas cap
		let lineH = LINE_HEIGHT;
		if (doc.lines * lineH > MAX_CANVAS_HEIGHT) {
			lineH = Math.max(1, Math.floor(MAX_CANVAS_HEIGHT / doc.lines));
		}
		const height = Math.min(doc.lines * lineH, MAX_CANVAS_HEIGHT);
		// dpr capped so tall documents stay inside the WebView canvas
		// limits (~16k px on Android) and don't balloon memory
		const dpr = Math.min(
			window.devicePixelRatio || 1,
			Math.max(1, 16000 / height),
		);
		const pxHeight = Math.round(height * dpr);
		const pxWidth = Math.round(MINIMAP_WIDTH * dpr);
		if (canvas.height !== pxHeight || canvas.width !== pxWidth) {
			canvas.width = pxWidth;
			canvas.height = pxHeight;
			canvas.style.height = `${height}px`;
		}
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, MINIMAP_WIDTH, height);

		const tabSize = cmState.facet(EditorState.tabSize) ?? 2;
		const colors = {
			comment: roleColor("comment", dark),
			string: roleColor("string", dark),
			number: roleColor("number", dark),
			keyword: roleColor("keyword", dark),
			tag: roleColor("tag", dark),
			text: roleColor("text", dark),
		};
		const activeLine = doc.lineAt(cmState.selection.main.head).number;
		const maxLines = Math.min(doc.lines, MAX_RENDER_LINES);

		// pass 1 — block bars: one bar per line (indent + length)
		for (let i = 1; i <= maxLines; i++) {
			const line = doc.line(i);
			const y = (i - 1) * lineH;
			const { indent, length } = lineMetrics(line.text, tabSize);
			if (!length) continue;
			const width = Math.min((indent + length) * CHAR_WIDTH, MINIMAP_WIDTH - 4);
			ctx.fillStyle = colors.text;
			ctx.globalAlpha = i === activeLine ? 1 : 0.75;
			ctx.fillRect(
				Math.min(indent * CHAR_WIDTH, MINIMAP_WIDTH - 4),
				y,
				Math.max(width - indent * CHAR_WIDTH, 2),
				Math.max(lineH - 0.4, 0.8),
			);
			ctx.globalAlpha = 1;
			if (i === activeLine) {
				ctx.fillStyle = dark
					? "rgba(255, 255, 255, 0.14)"
					: "rgba(0, 0, 0, 0.08)";
				ctx.fillRect(0, y, MINIMAP_WIDTH, lineH);
			}
		}

		// pass 2 — token colors from the Lezer syntax tree (only for
		// reasonably sized documents; huge ones keep the block bars)
		if (doc.lines <= 3000) {
			try {
				syntaxTree(cmState).iterate({
					from: 0,
					to: doc.length,
					enter: (nodeRef) => {
						const role = tokenRole(nodeRef.name);
						if (role === "text") return;
						const node = nodeRef.node;
						if (node && node.childCount > 0) return;
						const line = doc.lineAt(nodeRef.from);
						const y = (line.number - 1) * lineH;
						const { indent } = lineMetrics(line.text, tabSize);
						const x = Math.min(
							(indent + (nodeRef.from - line.from)) * CHAR_WIDTH,
							MINIMAP_WIDTH - 4,
						);
						const width = Math.max(
							Math.min(
								(nodeRef.to - nodeRef.from) * CHAR_WIDTH,
								MINIMAP_WIDTH - x,
							),
							1,
						);
						ctx.fillStyle = colors[role] || colors.text;
						ctx.fillRect(x, y, width, Math.max(lineH - 0.4, 0.8));
						return false; // colored leaves are not entered
					},
				});
			} catch {
				/* grammar not ready — the block bars remain */
			}
		}

		slider.style.borderColor = fg;
		syncSlider();
	}

	/** Positions the viewport slider over the canvas. */
	function syncSlider() {
		if (!state.view) return;
		const scrollDOM = state.view.scrollDOM;
		const canvasH = canvas.getBoundingClientRect().height;
		const scrollH = scrollDOM.scrollHeight;
		const clientH = scrollDOM.clientHeight;
		if (scrollH <= clientH || !canvasH) {
			slider.style.display = "none";
			return;
		}
		slider.style.display = "block";
		slider.style.top = `${(scrollDOM.scrollTop / scrollH) * canvasH}px`;
		slider.style.height = `${Math.max(
			Math.min(clientH / scrollH, 1) * canvasH,
			12,
		)}px`;
	}

	function clear() {
		const ctx = canvas.getContext("2d");
		if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
		slider.style.display = "none";
	}

	const onUnsubscribe = onMinimapUpdate((changedView) => {
		// repaint only the instance that owns the changed view
		if (!changedView || changedView === state.view) scheduleRender();
	});
	// scroll repaints are cheap (slider + debounce share the same path)
	const scrollUnsubscribe = () => {};
	state.view = null;

	return {
		un() {
			onUnsubscribe();
			clearTimeout(state.timer);
			window.removeEventListener("pointerup", stopDrag);
			host.remove();
			container.classList.remove("minimap-live");
			void scrollUnsubscribe;
		},
		instance: {
			setView(view) {
				if (state.view === view) return;
				state.view = view;
			},
			refresh,
		},
	};
}

/** True when the css color is darker than mid-gray. */
function isDarkColor(color) {
	const m = /rgba?\(([^)]+)\)/.exec(String(color || ""));
	if (!m) return true;
	const [r, g, b] = m[1].split(",").map((part) => Number.parseFloat(part));
	if ([r, g, b].some((n) => !Number.isFinite(n))) return true;
	return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

export default {
	attachMinimap,
	setEnabled,
	refreshAll,
	destroy,
};
