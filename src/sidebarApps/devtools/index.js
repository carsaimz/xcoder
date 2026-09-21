import "./style.scss";
import fsOperation from "fileSystem";
import toast from "components/toast";
import { applyToEditor } from "lib/ai/editorBridge";
import editorManager from "lib/editorManager";
import {
	base64Convert,
	boilerplateSnippet,
	cardSnippet,
	colorConvert,
	ctaSnippet,
	formatJson,
	loremText,
	placeholderSnippet,
	sectionSnippet,
	shadowCSS,
	slugText,
	tableSnippet,
	timestampConvert,
	uuidIds,
} from "lib/webdevTools";
import Url from "utils/Url";

/**
 * Dev Tools sidebar app — quick webdev/programmer utilities that
 * generate ready-to-paste code: box-shadow, gradients, cards, SVG
 * placeholders, JSON, Base64, IDs, timestamps, colors, lorem and slugs.
 * Generators live in lib/webdevTools.js (pure, unit-tested); this file
 * is only the UI layer: controls → live preview → copy/insert/save.
 */

const TOOL_LIST = [
	[
		"shadow",
		"dev tools shadow",
		"Shadow",
		"dev tools shadow desc",
		"Box-shadow generator with live preview",
	],
	[
		"gradient",
		"dev tools gradient",
		"Gradient",
		"dev tools gradient desc",
		"Linear, radial and conic CSS gradients",
	],
	[
		"card",
		"dev tools card",
		"Card",
		"dev tools card desc",
		"Card component (HTML + CSS)",
	],
	[
		"placeholder",
		"dev tools placeholder",
		"Placeholder",
		"dev tools placeholder desc",
		"SVG placeholder images by size",
	],
	[
		"cta",
		"dev tools cta",
		"CTA",
		"dev tools cta desc",
		"Call-to-action button (HTML + CSS)",
	],
	[
		"section",
		"dev tools section",
		"Section",
		"dev tools section desc",
		"Hero/section block with optional gradient",
	],
	[
		"form",
		"dev tools form",
		"Form",
		"dev tools form desc",
		"Contact form scaffold",
	],
	[
		"table",
		"dev tools table",
		"Table",
		"dev tools table desc",
		"Data table scaffold (striped/bordered)",
	],
	[
		"boilerplate",
		"dev tools boilerplate",
		"Boilerplate",
		"dev tools boilerplate desc",
		"HTML5 document starter",
	],
	[
		"json",
		"dev tools json",
		"JSON",
		"dev tools json desc",
		"Format, minify and validate JSON",
	],
	[
		"base64",
		"dev tools base64",
		"Base64",
		"dev tools base64 desc",
		"Encode and decode UTF-8-safe Base64",
	],
	[
		"ids",
		"dev tools ids",
		"IDs / UUID",
		"dev tools ids desc",
		"UUID v4 and short ids in bulk",
	],
	[
		"timestamp",
		"dev tools timestamp",
		"Timestamp",
		"dev tools timestamp desc",
		"Unix ↔ ISO 8601 converter",
	],
	[
		"color",
		"dev tools color",
		"Color",
		"dev tools color desc",
		"Hex ↔ RGB ↔ HSL converter",
	],
	[
		"lorem",
		"dev tools lorem",
		"Lorem ipsum",
		"dev tools lorem desc",
		"Filler text generator",
	],
	[
		"slug",
		"dev tools slug",
		"Slug / URL",
		"dev tools slug desc",
		"Slugify titles and links",
	],
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
	cta: {
		text: "Get started",
		url: "#",
		background: "#7c3aed",
		color: "#ffffff",
		radius: 12,
		paddingX: 32,
		paddingY: 14,
		fontSize: 17,
		block: false,
	},
	section: {
		title: "Hero title",
		subtitle: "A short description of your product or service.",
		buttonText: "Learn more",
		buttonUrl: "#",
		background: "#1e293b",
		background2: "#4c1d95",
		gradient: true,
		color: "#f8fafc",
		align: "center",
		padding: 64,
	},
	form: {
		title: "Contact us",
		buttonText: "Send",
		includePhone: false,
		includeSubject: false,
		includeMessage: true,
	},
	table: {
		columns: 3,
		rows: 4,
		striped: true,
		bordered: false,
	},
	boilerplate: {
		title: "My page",
		lang: "pt",
		viewport: true,
		reset: true,
	},
	json: {
		text: '{\n  "app": "XCoder",\n  "version": 1\n}',
		mode: "format",
		indent: "2",
	},
	base64: {
		text: "XCoder",
		mode: "encode",
	},
	ids: {
		count: 5,
		length: 10,
		format: "both",
	},
	timestamp: {
		text: "",
		mode: "auto",
	},
	color: {
		text: "#7c3aed",
	},
	lorem: {
		paragraphs: 3,
		sentences: 5,
	},
	slug: {
		text: "XCoder — editor de código!",
	},
};

let activeTool = "shadow";
/** @type {HTMLElement} */
let $panel = null;
/** @type {HTMLElement} */
let $preview = null;
/** @type {HTMLElement} */
let $output = null;

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
	} else if (activeTool === "cta") {
		const { css, html } = ctaSnippet(state.cta);
		const link = (
			<a
				className="devtools-cta-preview"
				href="#"
				onclick={(event) => event.preventDefault()}
			>
				{state.cta.text}
			</a>
		);
		link.style.background = state.cta.background;
		link.style.color = state.cta.color;
		link.style.borderRadius = `${state.cta.radius}px`;
		link.style.padding = `${state.cta.paddingY}px ${state.cta.paddingX}px`;
		link.style.fontSize = `${state.cta.fontSize}px`;
		if (state.cta.block) {
			link.style.display = "block";
			link.style.textAlign = "center";
		}
		$preview.append(link);
		$output.textContent = `${css}\n\n${html}`;
	} else if (activeTool === "section") {
		const { css, html } = sectionSnippet(state.section);
		const hero = (
			<div className="devtools-section-preview">
				<div className="devtools-section-inner">
					<h2>{state.section.title}</h2>
					<p>{state.section.subtitle}</p>
					{state.section.buttonText ? (
						<a href="#" onclick={(event) => event.preventDefault()}>
							{state.section.buttonText}
						</a>
					) : null}
				</div>
			</div>
		);
		hero.style.background = state.section.gradient
			? `linear-gradient(135deg, ${state.section.background}, ${state.section.background2})`
			: state.section.background;
		hero.style.color = state.section.color;
		hero.style.padding = `${state.section.padding}px 16px`;
		hero.style.textAlign = state.section.align;
		$preview.append(hero);
		$output.textContent = `${css}\n\n${html}`;
	} else if (activeTool === "form") {
		const { html, css } = formSnippet(state.form);
		const holder = <div className="devtools-form-preview" />;
		holder.innerHTML = html;
		const $form = holder.querySelector("form");
		if ($form) $form.onsubmit = (event) => event.preventDefault();
		$preview.append(holder);
		$output.textContent = `${html}\n\n${css}`;
	} else if (activeTool === "table") {
		const { html, css } = tableSnippet(state.table);
		const holder = <div className="devtools-table-preview" />;
		holder.innerHTML = html;
		$preview.append(holder);
		$output.textContent = `${html}\n\n${css}`;
	} else if (activeTool === "boilerplate") {
		const { html } = boilerplateSnippet(state.boilerplate);
		const doc = (
			<div className="devtools-doc-hint">
				<span className="devtools-doc-icon">{"</>"}</span>
				<span>{`index.html — ${state.boilerplate.title}`}</span>
			</div>
		);
		$preview.append(doc);
		$output.textContent = html;
	} else if (activeTool === "placeholder") {
		const { svg, dataUri, imgTag } = placeholderSnippet(state.placeholder);
		const img = <img src={dataUri} alt="placeholder preview" />;
		$preview.append(img);
		$output.textContent = imgTag;
		// keep the raw SVG reachable for the save action
		$preview.dataset.svg = svg;
	} else if (activeTool === "json") {
		const result = formatJson(
			state.json.text,
			state.json.mode,
			state.json.indent,
		);
		$output.textContent = result.ok
			? result.output
			: `${t("dev tools error", "Erro")}: ${result.error}`;
	} else if (activeTool === "base64") {
		const result = base64Convert(state.base64.text, state.base64.mode);
		$output.textContent = result.ok
			? result.output
			: `${t("dev tools error", "Erro")}: ${result.error}`;
	} else if (activeTool === "ids") {
		const { uuids, shortIds } = uuidIds(state.ids.count, state.ids.length);
		if (state.ids.format === "uuid") {
			$output.textContent = uuids.join("\n");
		} else if (state.ids.format === "short") {
			$output.textContent = shortIds.join("\n");
		} else {
			$output.textContent = uuids
				.map((uuid, index) => `${uuid}  ${shortIds[index]}`)
				.join("\n");
		}
	} else if (activeTool === "timestamp") {
		if (!String(state.timestamp.text || "").trim()) {
			$output.textContent = t(
				"dev tools timestamp hint",
				"Digite um timestamp (unix ou ISO 8601) para converter.",
			);
		} else {
			const result = timestampConvert(
				state.timestamp.text,
				state.timestamp.mode,
			);
			$output.textContent = result.ok
				? result.output
				: `${t("dev tools error", "Erro")}: ${result.error}`;
		}
	} else if (activeTool === "color") {
		const result = colorConvert(state.color.text);
		$output.textContent = result.ok
			? result.output
			: `${t("dev tools error", "Erro")}: ${result.error}`;
	} else if (activeTool === "lorem") {
		$output.textContent = loremText(
			state.lorem.paragraphs,
			state.lorem.sentences,
		);
	} else if (activeTool === "slug") {
		$output.textContent = slugText(state.slug.text);
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

/** Builds a labeled multi-line text row (JSON, Base64, slugs...). */
function textareaRow(label, value, oninput, rows = 5) {
	const $area = (
		<textarea className="devtools-textarea" rows={rows} aria-label={label} />
	);
	$area.value = value ?? "";
	$area.oninput = () => {
		oninput($area.value);
		refresh();
	};
	return (
		<label className="devtools-row devtools-row-stack">
			<span className="devtools-label">{label}</span>
			{$area}
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
	if (activeTool === "cta") {
		const c = state.cta;
		return [
			textRow(t("dev tools text", "Text"), c.text, (v) => (c.text = v)),
			textRow(t("dev tools url", "URL"), c.url, (v) => (c.url = v)),
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
				t("dev tools padding x", "Padding X"),
				4,
				64,
				c.paddingX,
				(v) => (c.paddingX = v),
			),
			rangeRow(
				t("dev tools padding y", "Padding Y"),
				2,
				40,
				c.paddingY,
				(v) => (c.paddingY = v),
			),
			rangeRow(
				t("dev tools font size", "Font size"),
				10,
				32,
				c.fontSize,
				(v) => (c.fontSize = v),
			),
			checkRow(
				t("dev tools block", "Full width"),
				c.block,
				(v) => (c.block = v),
			),
		];
	}
	if (activeTool === "section") {
		const s = state.section;
		return [
			textRow(t("dev tools title", "Title"), s.title, (v) => (s.title = v)),
			textRow(
				t("dev tools subtitle", "Subtitle"),
				s.subtitle,
				(v) => (s.subtitle = v),
			),
			textRow(
				t("dev tools button text", "Button text"),
				s.buttonText,
				(v) => (s.buttonText = v),
			),
			textRow(t("dev tools url", "URL"), s.buttonUrl, (v) => (s.buttonUrl = v)),
			colorRow(
				t("dev tools background", "Background"),
				s.background,
				(v) => (s.background = v),
			),
			checkRow(
				t("dev tools gradient bg", "Gradient background"),
				s.gradient,
				(v) => (s.gradient = v),
			),
			colorRow(
				t("dev tools background 2", "Gradient color"),
				s.background2,
				(v) => (s.background2 = v),
			),
			colorRow(
				t("dev tools text color", "Text color"),
				s.color,
				(v) => (s.color = v),
			),
			selectRow(
				t("dev tools align", "Align"),
				s.align,
				[
					["center", "Center"],
					["left", "Left"],
				],
				(v) => (s.align = v),
			),
			rangeRow(
				t("dev tools padding", "Padding"),
				16,
				160,
				s.padding,
				(v) => (s.padding = v),
			),
		];
	}
	if (activeTool === "form") {
		const f = state.form;
		return [
			textRow(t("dev tools title", "Title"), f.title, (v) => (f.title = v)),
			textRow(
				t("dev tools button text", "Button text"),
				f.buttonText,
				(v) => (f.buttonText = v),
			),
			checkRow(
				t("dev tools field phone", "Phone field"),
				f.includePhone,
				(v) => (f.includePhone = v),
			),
			checkRow(
				t("dev tools field subject", "Subject field"),
				f.includeSubject,
				(v) => (f.includeSubject = v),
			),
			checkRow(
				t("dev tools field message", "Message field"),
				f.includeMessage,
				(v) => (f.includeMessage = v),
			),
		];
	}
	if (activeTool === "table") {
		const table = state.table;
		return [
			rangeRow(
				t("dev tools columns", "Columns"),
				1,
				8,
				table.columns,
				(v) => (table.columns = v),
			),
			rangeRow(
				t("dev tools rows", "Rows"),
				1,
				20,
				table.rows,
				(v) => (table.rows = v),
			),
			checkRow(
				t("dev tools striped", "Striped rows"),
				table.striped,
				(v) => (table.striped = v),
			),
			checkRow(
				t("dev tools bordered", "Borders"),
				table.bordered,
				(v) => (table.bordered = v),
			),
		];
	}
	if (activeTool === "boilerplate") {
		const b = state.boilerplate;
		return [
			textRow(t("dev tools title", "Title"), b.title, (v) => (b.title = v)),
			selectRow(
				t("dev tools lang", "Language"),
				b.lang,
				[
					["pt", "Português"],
					["en", "English"],
				],
				(v) => (b.lang = v),
			),
			checkRow(
				t("dev tools viewport", "Viewport meta"),
				b.viewport,
				(v) => (b.viewport = v),
			),
			checkRow(
				t("dev tools reset", "Include reset CSS"),
				b.reset,
				(v) => (b.reset = v),
			),
		];
	}
	if (activeTool === "json") {
		const j = state.json;
		return [
			textareaRow(
				t("dev tools input", "Input"),
				j.text,
				(v) => (j.text = v),
				8,
			),
			selectRow(
				t("dev tools mode", "Mode"),
				j.mode,
				[
					["format", t("dev tools format", "Formatar")],
					["minify", t("dev tools minify", "Minificar")],
				],
				(v) => (j.mode = v),
			),
			selectRow(
				t("dev tools indent", "Indentação"),
				j.indent,
				[
					["2", "2 espaços"],
					["4", "4 espaços"],
					["tab", "Tab"],
				],
				(v) => (j.indent = v),
			),
		];
	}
	if (activeTool === "base64") {
		const b = state.base64;
		return [
			textareaRow(
				t("dev tools input", "Input"),
				b.text,
				(v) => (b.text = v),
				6,
			),
			selectRow(
				t("dev tools mode", "Mode"),
				b.mode,
				[
					["encode", t("dev tools encode", "Codificar")],
					["decode", t("dev tools decode", "Decodificar")],
				],
				(v) => (b.mode = v),
			),
		];
	}
	if (activeTool === "ids") {
		const i = state.ids;
		return [
			rangeRow(
				t("dev tools count", "Quantidade"),
				1,
				50,
				i.count,
				(v) => (i.count = v),
			),
			rangeRow(
				t("dev tools id length", "Tamanho do id curto"),
				6,
				32,
				i.length,
				(v) => (i.length = v),
			),
			selectRow(
				t("dev tools mode", "Mode"),
				i.format,
				[
					["both", "UUID + curto"],
					["uuid", "UUID"],
					["short", t("dev tools short only", "Só curto")],
				],
				(v) => (i.format = v),
			),
		];
	}
	if (activeTool === "timestamp") {
		const ts = state.timestamp;
		return [
			textRow(
				t("dev tools timestamp input", "Timestamp / data"),
				ts.text,
				(v) => (ts.text = v),
			),
			selectRow(
				t("dev tools input type", "Tipo de entrada"),
				ts.mode,
				[
					["auto", "Auto"],
					["unix-s", "Unix (s)"],
					["unix-ms", "Unix (ms)"],
					["iso", "ISO 8601"],
				],
				(v) => (ts.mode = v),
			),
		];
	}
	if (activeTool === "color") {
		const c = state.color;
		return [
			textRow(
				t("dev tools color input", "Cor (hex / rgb / hsl)"),
				c.text,
				(v) => (c.text = v),
			),
		];
	}
	if (activeTool === "lorem") {
		const l = state.lorem;
		return [
			rangeRow(
				t("dev tools paragraphs", "Parágrafos"),
				1,
				10,
				l.paragraphs,
				(v) => (l.paragraphs = v),
			),
			rangeRow(
				t("dev tools sentences", "Frases por parágrafo"),
				2,
				10,
				l.sentences,
				(v) => (l.sentences = v),
			),
		];
	}
	if (activeTool === "slug") {
		const s = state.slug;
		return [textRow(t("dev tools text", "Text"), s.text, (v) => (s.text = v))];
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
	if (activeTool === "ids") {
		buttons.push(
			<button className="devtools-btn" onclick={() => refresh()}>
				{t("dev tools regenerate", "Gerar novamente")}
			</button>,
		);
	}
	return <div className="devtools-actions">{buttons}</div>;
}

/** Switches tool and re-renders the panel. */
function setTool(id) {
	activeTool = id;
	const $list = document.querySelector(".devtools-tool-list");
	const $header = document.querySelector(".devtools-tool-header");
	if ($list) {
		$list.classList.remove("open");
		$list.get?.(".active")?.classList.remove("active");
		$list.get?.(`[data-tool="${id}"]`)?.classList.add("active");
	}
	if ($header) fillToolHeader($header);
	renderPanel();
}

/** Fills the collapsed picker header with the active tool's info. */
function fillToolHeader($header) {
	const entry = TOOL_LIST.find(([id]) => id === activeTool) || TOOL_LIST[0];
	$header.get(".devtools-tool-title").textContent = t(entry[1], entry[2]);
	$header.get(".devtools-tool-desc").textContent = t(entry[3], entry[4]);
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

/**
 * Builds the tool picker: a collapsed header (active tool title +
 * description) that expands into a VERTICAL list where every tool
 * shows its own title and short description — easier to scan than the
 * old horizontal tab strip on narrow screens.
 */
function buildToolPicker() {
	const $header = (
		<button className="devtools-tool-header" aria-expanded="false">
			<span className="devtools-tool-texts">
				<span className="devtools-tool-title"></span>
				<span className="devtools-tool-desc"></span>
			</span>
			<span className="icon chevron_right devtools-tool-chevron"></span>
		</button>
	);

	const $list = <div className="devtools-tool-list" role="listbox" />;
	for (const [id, key, fallback, descKey, descFallback] of TOOL_LIST) {
		const $row = (
			<div
				className={`devtools-tool-item${id === activeTool ? " active" : ""}`}
				role="option"
				data-tool={id}
				tabindex="0"
			>
				<span className="devtools-tool-item-title">{t(key, fallback)}</span>
				<span className="devtools-tool-item-desc">
					{t(descKey, descFallback)}
				</span>
			</div>
		);
		$row.onclick = () => setTool(id);
		$row.onkeydown = (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				setTool(id);
			}
		};
		$list.append($row);
	}

	$header.onclick = () => {
		const open = $list.classList.toggle("open");
		$header.setAttribute("aria-expanded", String(open));
		$header.get(".devtools-tool-chevron").classList.toggle("open", open);
		if (open) {
			$list.get(".active")?.scrollIntoView?.({ block: "nearest" });
		}
	};
	fillToolHeader($header);

	return (
		<div className="devtools-picker">
			{$header}
			{$list}
		</div>
	);
}

/** Retranslates picker + panel labels when the language changes. */
function onLangChange() {
	const $header = document.querySelector(".devtools-tool-header");
	if ($header) fillToolHeader($header);
	for (const [id, key, fallback, descKey, descFallback] of TOOL_LIST) {
		const $row = document.querySelector(
			`.devtools-tool-item[data-tool="${id}"]`,
		);
		if (!$row) continue;
		$row.get(".devtools-tool-item-title").textContent = t(key, fallback);
		$row.get(".devtools-tool-item-desc").textContent = t(descKey, descFallback);
	}
	renderPanel();
}

/** Sidebar app init — runs once at install. */
function initApp(el) {
	el.classList.add("devtools-app");
	el.append(
		<div className="devtools-root">
			{buildToolPicker()}
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
