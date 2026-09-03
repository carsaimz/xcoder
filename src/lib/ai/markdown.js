import DOMPurify from "dompurify";
import markdownIt from "markdown-it";
import markdownItTaskLists from "markdown-it-task-lists";
import { highlightCodeBlock, initHighlighting } from "utils/codeHighlight";

/**
 * Markdown rendering for AI chat messages.
 *
 * Supports: headings, bold/italic/strike, inline code, links, images,
 * fenced code blocks (with editor-theme syntax highlighting), lists
 * (incl. task lists), tables, blockquotes and horizontal rules.
 *
 * The HTML is produced by markdown-it with html:false (raw HTML in model
 * output is escaped) and additionally passed through DOMPurify, so even a
 * prompt-injected answer cannot inject markup.
 */

let md = null;

/**
 * Lazily built shared markdown-it instance.
 * @returns {markdownIt}
 */
function getMarkdownIt() {
	if (md) return md;
	md = new markdownIt({
		html: false, // never trust model HTML
		linkify: true,
		breaks: true, // chat-style line breaks
	}).use(markdownItTaskLists, { enabled: false });

	// links open externally; mark them so the click handler finds them
	const defaultLinkOpen =
		md.renderer.rules.link_open ||
		((tokens, idx, options, env, self) =>
			self.renderToken(tokens, idx, options));
	md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
		tokens[idx].attrSet("class", "ai-md-link");
		tokens[idx].attrSet("data-href", tokens[idx].attrGet("href") || "");
		return defaultLinkOpen(tokens, idx, options, env, self);
	};
	return md;
}

/** @param {string} text */
function escapeHtml(text) {
	return String(text)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/**
 * Renders model text to sanitized markdown HTML.
 * @param {string} text
 * @returns {string} safe HTML
 */
export function markdownToHtml(text) {
	const source = String(text ?? "");
	const raw = getMarkdownIt().render(source);
	return DOMPurify.sanitize(raw, {
		USE_PROFILES: { html: true },
		ADD_ATTR: ["data-href", "data-lang", "class", "type", "disabled"],
		FORBID_TAGS: ["style", "input", "form", "script", "iframe"],
	});
}

/**
 * Upgrades plain code blocks with editor-theme syntax highlighting.
 * Safe to call repeatedly; swaps innerHTML only when highlighting yields
 * a result.
 * @param {HTMLElement} root element containing pre.ai-md-code blocks
 */
export async function highlightMarkdownCode(root) {
	if (!root) return;
	initHighlighting();
	const blocks = root.querySelectorAll("pre.ai-md-code[data-lang]");
	for (const block of blocks) {
		if (block.dataset.highlighted === "1") continue;
		block.dataset.highlighted = "1";
		const lang = block.dataset.lang || "";
		const code = block.textContent || "";
		try {
			const highlighted = await highlightCodeBlock(code, lang);
			if (highlighted && highlighted !== code) {
				const $code = block.querySelector("code");
				if ($code) {
					$code.innerHTML = DOMPurify.sanitize(highlighted, {
						USE_PROFILES: { html: true },
						ADD_ATTR: ["class", "style"],
					});
					$code.classList.add("cm-highlighted");
				}
			}
		} catch {
			/* keep plain code */
		}
	}
}

/**
 * Renders model text into a styled element (markdown), wiring:
 *  - external links → system browser
 *  - async code highlighting (editor theme)
 * @param {string} text
 * @returns {HTMLElement}
 */
export function renderMarkdownElement(text) {
	const $el = <div className="ai-md" />;
	$el.innerHTML = markdownToHtml(text);

	for (const $link of $el.querySelectorAll("a.ai-md-link")) {
		$link.addEventListener("click", (event) => {
			event.preventDefault();
			const href = $link.dataset.href || $link.getAttribute("href") || "";
			if (/^https?:\/\//i.test(href)) {
				try {
					system.openInBrowser(href);
				} catch {
					window.open(href, "_blank");
				}
			}
		});
	}

	// tables scroll horizontally instead of breaking the layout
	for (const $table of $el.querySelectorAll("table")) {
		const $wrap = <div className="ai-md-table-wrap" />;
		$table.parentNode.insertBefore($wrap, $table);
		$wrap.append($table);
	}

	// code blocks: class + language tag + tap hint
	for (const $pre of $el.querySelectorAll("pre")) {
		let lang = "";
		const $code = $pre.querySelector("code");
		if ($code) {
			for (const cls of ($code.className || "").split(/\s+/)) {
				if (cls.startsWith("language-")) {
					lang = cls.slice(9);
					break;
				}
			}
		}
		$pre.classList.add("ai-md-code", "tappable");
		$pre.dataset.lang = lang;
		$pre.title = strings["ai code actions"] || "Tap for code actions";
		$pre.dataset.hint = strings["ai tap hint"] || "tap for actions";
		$pre.addEventListener("click", () => {
			const code = $pre.textContent || "";
			// lazy import avoids a circular dependency at startup
			import("sidebarApps/ai/index")
				.then(({ codeBlockActions }) => codeBlockActions(code))
				.catch(() => {});
		});
	}

	highlightMarkdownCode($el);
	return $el;
}
