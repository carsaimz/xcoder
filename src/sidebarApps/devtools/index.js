import "./style.scss";
import fsOperation from "fileSystem";
import toast from "components/toast";
import { applyToEditor } from "lib/ai/editorBridge";
import editorManager from "lib/editorManager";
import {
	cardSnippet,
	gradientCSS,
	placeholderSnippet,
	shadowCSS,
} from "lib/webdevTools";
import Url from "utils/Url";

/**
 * Dev Tools sidebar app — quick webdev utilities that generate ready-to-
 * paste code: box-shadow, gradients, cards and SVG placeholder images.
 * Generators live in lib/devTools.js (pure, unit-tested); this file is
 * only the UI layer: controls → live preview → copy/insert/save.
 */

const TOOL_TABS = [
	["shadow", "dev tools shadow", "Shadow"],
	["gradient", "dev tools gradient", "Gradient"],
	["card", "dev tools card", "Card"],
	["placeholder", "dev tools placeholder", "Placeholder"],
];

const state = {
	shadow: {
		x: 0,
		y: 8,
		blur: 24,
		spread: -4,
		color: "rgba(0, 0, 0, 0.45)",
		inset: false,
	},
	gradient: {
		type: "linear",
		angle: 135,
		stops: [
			{ color: "#7c3aed", at: 0 },
			{ color: "#22d3ee", at: 100 },
		],
	},
	card: {
		background: "#ffffff",
		color: "#1f1f1f",
		radius: 16,
		padding: 24,
		borderWidth: 0,
		borderColor: "#e0e0e0",
		shadow: "medium",
		title: "Card title",
		subtitle: "Card subtitle",
	},
	placeholder: {
		width: 640,
		height: 360,
		background: "#e2e8f0",
		color: "#64748b",
		text: "",
	},
};

let activeTool = "shadow";
/** @type {HTMLElement} */
let $panel = null;
/** @type {HTMLElement} */
let $preview = null;
/** @type {HTMLElement} */
let $output = null;
/** @type {Array<[HTMLElement, string]>} */
const $tabs = [];

/** Short texts resolved at render time (language can change mid-session). */
function t(key, fallback) {
	return strings[key] || fallback;
}

/**
 * Copies generated code to the clipboard (Cordova + browser).
 * @param {string} text
 */
function copyText(text) {
	const cordova = globalThis.cordova;
	if (cordova?.plugins?.clipboard) {
		cordova.plugins.clipboard.copy(text);
		toast(t("dev tools copied", "Copied to clipboard"));
		return;
	}
	navigator.clipboard
		.writeText(text)
		.then(() => toast(t("dev tools copied", "Copied to clipboard")))
		.catch((error) => toast(`clipboard: ${error.message || error}`));
}

/** Inserts generated code at the editor cursor. */
function insertText(text) {
	const result = applyToEditor(editorManager, {
		action: "insert",
		text,
	});
	if (result.ok) {
		toast(t("dev tools inserted", "Inserted at cursor"));
	} else {
		toast(result.message);
	}
}

/**
 * Saves the placeholder SVG next to the active file (or in app storage).
 * @param {string} svg raw SVG markup
 */
async function savePlaceholder(svg) {
	try {
		const file = editorManager.activeFile;
		let dir = globalThis.DATA_STORAGE || "";
		if (file?.uri) {
			dir = Url.dirname(file.uri);
		}
		const ph = state.placeholder;
		const name = `placeholder-${ph.width}x${ph.height}.svg`;
		const fileUrl = Url.join(dir, name);
		await fsOperation(fileUrl).writeFile(svg);
		toast(t("dev tools saved", "Saved: {file}").replace(/\{file\}/g, name));
	} catch (error) {
		toast(`save: ${error.message || error}`);
	}
}

/** Rebuilds preview + output for the active tool. */
function refresh() {
	if (!$panel?.isConnected) return;
	$preview.textContent = "";
	$output.textContent = "";
	delete $preview.dataset.svg;

	if (activeTool === "shadow") {
		const css = shadowCSS(state.shadow);
		const box = <div className="devtools-shadow-box" />;
		box.style.boxShadow = shadowCSS(state.shadow).match(
			/box-shadow: ([^;]+);/,
		)[1];
		box.style.borderRadius = "12px";
		$preview.append(box);
		$output.textContent = css;
	} else if (activeTool === "gradient") {
		const css = gradientCSS(state.gradient);
		const box = <div className="devtools-gradient-box" />;
		box.style.background = gradientCSS(state.gradient).match(
			/background: ([^;]+);/,
		)[1];
		$preview.append(box);
		$output.textContent = css;
	} else if (activeTool === "card") {
		const { css } = cardSnippet(state.card);
		const card = (
			<div className="devtools-card-preview">
				<h2>{state.card.title}</h2>
				<p>{state.card.subtitle}</p>
			</div>
		);
		card.style.background = state.card.background;
		card.style.color = state.card.color;
		card.style.borderRadius = `${state.card.radius}px`;
		card.style.padding = `${state.card.padding}px`;
		if (state.card.borderWidth > 0) {
			card.style.border = `${state.card.borderWidth}px solid ${state.card.borderColor}`;
		}
		card.style.boxShadow =
			cardSnippet(state.card).css.match(/box-shadow: ([^;]+);/)?.[1] || "none";
		$preview.append(card);
		$output.textContent = `${css}\n\n${cardSnippet(state.card).html}`;
	} else if (activeTool === "placeholder") {
		const { svg, dataUri, imgTag } = placeholderSnippet(state.placeholder);
		const img = <img src={dataUri} alt="placeholder preview" />;
		$preview.append(img);
		$output.textContent = imgTag;
		// keep the raw SVG reachable for the save action
		$preview.dataset.svg = svg;
	}
}

/** Builds a labeled range slider row. */
function rangeRow(label, min, max, value, oninput, step = 1) {
	const $value = <span className="devtools-range-value">{String(value)}</span>;
	const $range = (
		<input
			type="range"
			min={min}
			max={max}
			step={step}
			value={value}
			aria-label={label}
		/>
	);
	$range.oninput = () => {
		$value.textContent = String($range.value);
		oninput(Number($range.value));
		refresh();
	};
	return (
		<label className="devtools-row">
			<span className="devtools-label">{label}</span>
			{$range}
			{$value}
		</label>
	);
}

/** #rrggbb fallback for rgba() values (color input needs hex). */
function toHex(color) {
	if (/^#[0-9a-f]{6}$/i.test(color || "")) return color;
	return "#000000";
}

/** Builds a labeled color row. */
function colorRow(label, value, oninput) {
	const $color = <input type="color" value={toHex(value)} aria-label={label} />;
	$color.oninput = () => {
		oninput($color.value);
		refresh();
	};
	return (
		<label className="devtools-row">
			<span className="devtools-label">{label}</span>
			{$color}
		</label>
	);
}

/** Builds a labeled checkbox row. */
function checkRow(label, value, oninput) {
	const $check = <input type="checkbox" aria-label={label} />;
	$check.checked = value;
	$check.onchange = () => {
		oninput($check.checked);
		refresh();
	};
	return (
		<label className="devtools-row">
			<span className="devtools-label">{label}</span>
			{$check}
		</label>
	);
}

/** Builds a labeled text row. */
function textRow(label, value, oninput) {
	const $text = <input type="text" value={value} aria-label={label} />;
	$text.oninput = () => {
		oninput($text.value);
		refresh();
	};
	return (
		<label className="devtools-row">
			<span className="devtools-label">{label}</span>
			{$text}
		</label>
	);
}

/** Builds a labeled select row. */
function selectRow(label, value, options, oninput) {
	const $select = (
		<select aria-label={label}>
			{options.map(([val, text]) => (
				<option value={val} selected={val === value}>
					{text}
				</option>
			))}
		</select>
	);
	$select.onchange = () => {
		oninput($select.value);
		refresh();
	};
	return (
		<label className="devtools-row">
			<span className="devtools-label">{label}</span>
			{$select}
		</label>
	);
}

/** #rrggbb → rgba(r, g, b, alpha) for the shadow color row. */
function hexToRgba(hex, alpha) {
	const match = /^#?([0-9a-f]{6})$/i.exec(hex || "");
	if (!match) return hex;
	const int = Number.parseInt(match[1], 16);
	const r = (int >> 16) & 255;
	const g = (int >> 8) & 255;
	const b = int & 255;
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Control rows for the active tool. */
function buildControls() {
	if (activeTool === "shadow") {
		const s = state.shadow;
		return [
			rangeRow(
				t("dev tools offset x", "Offset X"),
				-60,
				60,
				s.x,
				(v) => (s.x = v),
			),
			rangeRow(
				t("dev tools offset y", "Offset Y"),
				-60,
				60,
				s.y,
				(v) => (s.y = v),
			),
			rangeRow(
				t("dev tools blur", "Blur"),
				0,
				120,
				s.blur,
				(v) => (s.blur = v),
			),
			rangeRow(
				t("dev tools spread", "Spread"),
				-30,
				50,
				s.spread,
				(v) => (s.spread = v),
			),
			colorRow(
				t("dev tools color", "Color"),
				/^#/.test(s.color) ? s.color : "#000000",
				(v) => {
					s.color = hexToRgba(v, 0.45);
				},
			),
			checkRow(
				t("dev tools inset", "Inset shadow"),
				s.inset,
				(v) => (s.inset = v),
			),
		];
	}
	if (activeTool === "gradient") {
		const g = state.gradient;
		const rows = [
			selectRow(
				t("dev tools type", "Type"),
				g.type,
				[
					["linear", "Linear"],
					["radial", "Radial"],
					["conic", "Conic"],
				],
				(v) => (g.type = v),
			),
		];
		if (g.type !== "radial") {
			rows.push(
				rangeRow(
					t("dev tools angle", "Angle"),
					0,
					360,
					g.angle,
					(v) => (g.angle = v),
				),
			);
		}
		rows.push(
			colorRow(t("dev tools stops", "Color stops"), g.stops[0].color, (v) => {
				g.stops[0].color = v;
			}),
			colorRow(t("dev tools stops", "Color stops"), g.stops[1].color, (v) => {
				g.stops[1].color = v;
			}),
		);
		return rows;
	}
	if (activeTool === "card") {
		const c = state.card;
		return [
			textRow(t("dev tools title", "Title"), c.title, (v) => (c.title = v)),
			textRow(
				t("dev tools subtitle", "Subtitle"),
				c.subtitle,
				(v) => (c.subtitle = v),
			),
			colorRow(
				t("dev tools background", "Background"),
				c.background,
				(v) => (c.background = v),
			),
			colorRow(
				t("dev tools text color", "Text color"),
				c.color,
				(v) => (c.color = v),
			),
			rangeRow(
				t("dev tools radius", "Corner radius"),
				0,
				40,
				c.radius,
				(v) => (c.radius = v),
			),
			rangeRow(
				t("dev tools padding", "Padding"),
				0,
				64,
				c.padding,
				(v) => (c.padding = v),
			),
			rangeRow(
				t("dev tools border", "Border"),
				0,
				12,
				c.borderWidth,
				(v) => (c.borderWidth = v),
			),
			colorRow(
				t("dev tools border", "Border"),
				c.borderColor,
				(v) => (c.borderColor = v),
			),
			selectRow(
				t("dev tools shadow preset", "Shadow"),
				c.shadow,
				[
					["none", "None"],
					["soft", "Soft"],
					["medium", "Medium"],
					["hard", "Hard"],
				],
				(v) => (c.shadow = v),
			),
		];
	}
	const p = state.placeholder;
	return [
		rangeRow(
			t("dev tools width", "Width"),
			64,
			2048,
			p.width,
			(v) => (p.width = v),
			16,
		),
		rangeRow(
			t("dev tools height", "Height"),
			64,
			2048,
			p.height,
			(v) => (p.height = v),
			16,
		),
		colorRow(
			t("dev tools background", "Background"),
			p.background,
			(v) => (p.background = v),
		),
		colorRow(t("dev tools color", "Color"), p.color, (v) => (p.color = v)),
		textRow(t("dev tools label", "Label"), p.text, (v) => (p.text = v)),
	];
}

/** Action buttons for the active tool. */
function buildActions() {
	const copy = () => $output.textContent;
	const buttons = [
		<button className="devtools-btn" onclick={() => copyText(copy())}>
			{t("copy", "Copy")}
		</button>,
		<button className="devtools-btn primary" onclick={() => insertText(copy())}>
			{t("dev tools insert", "Insert")}
		</button>,
	];
	if (activeTool === "placeholder") {
		buttons.push(
			<button
				className="devtools-btn"
				onclick={() => savePlaceholder($preview.dataset.svg || "")}
			>
				{t("dev tools save svg", "Save SVG")}
			</button>,
		);
	}
	return <div className="devtools-actions">{buttons}</div>;
}

/** Switches tool and re-renders the panel. */
function setTool(id) {
	activeTool = id;
	for (const [$tab, tool] of $tabs) {
		$tab.classList.toggle("active", tool === id);
	}
	renderPanel();
}

/** Rebuilds controls + preview + output for the active tool. */
function renderPanel() {
	if (!$panel?.isConnected) return;
	$panel.textContent = "";
	$preview = <div className="devtools-preview" />;
	$output = <pre className="devtools-output scroll" />;
	$panel.append(
		<div className="devtools-controls scroll">{buildControls()}</div>,
		$preview,
		$output,
		buildActions(),
	);
	refresh();
}

/** Builds the tab strip. */
function buildTabs() {
	const $strip = <div className="devtools-tabs" role="tablist" />;
	for (const [id, key, fallback] of TOOL_TABS) {
		const $tab = (
			<button className="devtools-tab" role="tab">
				{t(key, fallback)}
			</button>
		);
		$tab.onclick = () => setTool(id);
		$tabs.push([$tab, id]);
		$strip.append($tab);
	}
	return $strip;
}

/** Retranslates tab labels when the language changes. */
function onLangChange() {
	for (const [$tab, id] of $tabs) {
		const tab = TOOL_TABS.find(([toolId]) => toolId === id);
		if (tab) $tab.textContent = t(tab[1], tab[2]);
	}
	renderPanel();
}

/** Sidebar app init — runs once at install. */
function initApp(el) {
	el.classList.add("devtools-app");
	el.append(
		<div className="devtools-root">
			{buildTabs()}
			<div className="devtools-panel" />
		</div>,
	);
	$panel = el.get(".devtools-panel");
	setTool(activeTool);

	document.addEventListener("langchange", onLangChange);
	return () => {
		document.removeEventListener("langchange", onLangChange);
	};
}

function onSelected(el) {
	el?.querySelector(".devtools-output")?.scrollTo?.(0, 0);
}

export default [
	"svg:palette",
	"devtools",
	strings["dev tools"] || "Dev Tools",
	initApp,
	false,
	onSelected,
	{ titleKey: "dev tools" },
];
