import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

// VS Code "Light+" editor palette — the light counterpart of vscodeDark,
// used by the VS Light+ / VS Light Modern app themes.
export const config = {
	name: "vscodeLight",
	dark: false,
	background: "#fffffe",
	foreground: "#000000",
	selection: "#add6ff",
	selectionMatch: "#e8e8e8",
	cursor: "#000000",
	dropdownBackground: "#f8f8f8",
	dropdownBorder: "#c8c8c8",
	// Keep this translucent: CodeMirror draws selections behind line backgrounds.
	activeLine: "#0000000d",
	lineNumber: "#237893",
	lineNumberActive: "#0b216f",
	matchingBracket: "#00000020",
	keyword: "#0000ff",
	variable: "#001080",
	parameter: "#001080",
	function: "#795e26",
	string: "#a31515",
	constant: "#0070c1",
	type: "#267f99",
	class: "#267f99",
	number: "#098658",
	comment: "#008000",
	heading: "#001080",
	invalid: "#cd3131",
	regexp: "#811f3f",
	tag: "#800000",
	operator: "#000000",
	angleBracket: "#800000",
};

export const vscodeLightTheme = EditorView.theme(
	{
		"&": {
			color: config.foreground,
			backgroundColor: config.background,
		},

		".cm-content": { caretColor: config.cursor },

		".cm-cursor, .cm-dropCursor": { borderLeftColor: config.cursor },
		"&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
			{
				backgroundColor: config.selection,
			},

		".cm-panels": {
			backgroundColor: config.dropdownBackground,
			color: config.foreground,
		},
		".cm-panels.cm-panels-top": {
			borderBottom: `1px solid ${config.dropdownBorder}`,
		},
		".cm-panels.cm-panels-bottom": {
			borderTop: `1px solid ${config.dropdownBorder}`,
		},

		".cm-searchMatch": {
			backgroundColor: "#ffdf8a80",
			outline: `1px solid ${config.dropdownBorder}`,
		},
		".cm-searchMatch.cm-searchMatch-selected": {
			backgroundColor: config.selection,
		},

		".cm-activeLine": { backgroundColor: config.activeLine },
		".cm-selectionMatch": { backgroundColor: config.selectionMatch },

		"&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
			backgroundColor: config.matchingBracket,
			outline: "none",
		},

		".cm-gutters": {
			backgroundColor: config.background,
			color: config.lineNumber,
			border: "none",
		},
		".cm-activeLineGutter": { backgroundColor: config.background },

		".cm-lineNumbers .cm-gutterElement": { color: config.lineNumber },
		".cm-lineNumbers .cm-activeLineGutter": { color: config.lineNumberActive },

		".cm-foldPlaceholder": {
			backgroundColor: "transparent",
			border: "none",
			color: config.foreground,
		},
		".cm-tooltip": {
			border: `1px solid ${config.dropdownBorder}`,
			backgroundColor: config.dropdownBackground,
			color: config.foreground,
		},
		".cm-tooltip .cm-tooltip-arrow:before": {
			borderTopColor: "transparent",
			borderBottomColor: "transparent",
		},
		".cm-tooltip .cm-tooltip-arrow:after": {
			borderTopColor: config.foreground,
			borderBottomColor: config.foreground,
		},
		".cm-tooltip-autocomplete": {
			"& > ul > li[aria-selected]": {
				background: config.selection,
				color: config.foreground,
			},
		},
	},
	{ dark: config.dark },
);

export const vscodeLightHighlightStyle = HighlightStyle.define([
	{
		tag: [t.keyword, t.modifier, t.definitionKeyword, t.self, t.unit],
		color: config.keyword,
	},
	{
		tag: [t.controlKeyword, t.moduleKeyword, t.operatorKeyword],
		color: "#af00db",
	},
	{
		tag: [
			t.name,
			t.deleted,
			t.character,
			t.macroName,
			t.variableName,
			t.labelName,
			t.definition(t.name),
			t.definition(t.variableName),
			t.local(t.variableName),
			t.special(t.variableName),
		],
		color: config.variable,
	},
	{
		tag: [
			t.namespace,
			t.standard(t.name),
			t.standard(t.variableName),
			t.standard(t.propertyName),
		],
		color: config.constant,
	},
	{
		tag: [
			t.propertyName,
			t.attributeName,
			t.definition(t.propertyName),
			t.definition(t.attributeName),
		],
		color: config.variable,
	},
	{ tag: t.heading, fontWeight: "bold", color: config.heading },
	{ tag: [t.typeName, t.className], color: config.type },
	{ tag: [t.tagName, t.standard(t.tagName)], color: config.tag },
	{
		tag: [t.function(t.variableName), t.function(t.propertyName)],
		color: config.function,
	},
	{
		tag: [
			t.literal,
			t.number,
			t.integer,
			t.float,
			t.changed,
			t.annotation,
			t.color,
			t.constant(t.name),
			t.constant(t.variableName),
			t.constant(t.propertyName),
		],
		color: config.number,
	},
	{ tag: [t.bool, t.null, t.atom], color: config.constant },
	{
		tag: [
			t.operator,
			t.derefOperator,
			t.arithmeticOperator,
			t.logicOperator,
			t.bitwiseOperator,
			t.compareOperator,
			t.updateOperator,
			t.definitionOperator,
			t.typeOperator,
			t.controlOperator,
			t.punctuation,
			t.separator,
		],
		color: config.operator,
	},
	{
		tag: [t.bracket, t.paren, t.squareBracket, t.brace],
		color: config.operator,
	},
	{ tag: [t.regexp], color: config.regexp },
	{
		tag: [
			t.special(t.string),
			t.processingInstruction,
			t.string,
			t.docString,
			t.attributeValue,
			t.inserted,
		],
		color: config.string,
	},
	{ tag: [t.url, t.escape], color: config.regexp },
	{ tag: [t.angleBracket], color: config.angleBracket },
	{ tag: t.strong, fontWeight: "bold" },
	{ tag: t.emphasis, fontStyle: "italic" },
	{ tag: t.strikethrough, textDecoration: "line-through" },
	{ tag: [t.monospace], color: config.string },
	{ tag: [t.contentSeparator, t.list], color: config.keyword },
	{ tag: t.quote, color: config.comment, fontStyle: "italic" },
	{
		tag: [
			t.meta,
			t.documentMeta,
			t.comment,
			t.lineComment,
			t.blockComment,
			t.docComment,
		],
		color: config.comment,
	},
	{ tag: t.link, color: "#006ab1", textDecoration: "underline" },
	{ tag: t.invalid, color: config.invalid },
]);

export function vscodeLight() {
	return [vscodeLightTheme, syntaxHighlighting(vscodeLightHighlightStyle)];
}

export default vscodeLight;
