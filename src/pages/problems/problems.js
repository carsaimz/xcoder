import "./style.scss";
import { focusEditorIfEditable } from "cm/editorReadOnly";
import { getLspDiagnostics } from "cm/lsp/diagnostics";
import Page from "components/page";
import toast from "components/toast";
import actionStack from "lib/actionStack";
import EditorFile from "lib/editorFile";
import { getLinterDiagnostics } from "lib/linterRegistry";
import { copyText } from "utils/clipboard";
import helpers from "utils/helpers";

export default function Problems() {
	const $page = Page(strings["problems"], {
		tail: (
			<span
				className="icon codicon-copy problems-copy-all"
				title={strings["problems copy all"] || "Copiar problemas"}
				role="button"
				onclick={copyAll}
			/>
		),
	});
	/**@type {EditorFile[]} */
	const files = editorManager.files;
	const $content = <div id="problems"></div>;

	files.forEach((file) => {
		if (file.type !== "editor") return;
		const annotations = collectAnnotations(file);
		if (!annotations.length) return;

		const title = `${file.name} (${annotations.length})`;
		$content.append(
			<details open="true" className="single-file" data-file-name={file.name}>
				<summary>{title}</summary>
				<div className="problems">
					{annotations.map((annotation) => {
						const { type, text, row, column } = annotation;
						const icon = getIconForType(type);

						return (
							<div
								className="problem"
								data-action="goto"
								data-file-id={file.id}
								annotation={annotation}
							>
								<span className={`icon ${icon}`}></span>
								<span data-type={type} className="problem-message">
									{text}
								</span>
								<span className="problem-line">
									{row + 1}:{column + 1}
								</span>
								<span
									className="icon codicon-copy problem-copy"
									data-action="copy"
									title={strings["problems copy one"] || "Copiar problema"}
									annotation={annotation}
									data-file-name={file.name}
								></span>
							</div>
						);
					})}
				</div>
			</details>,
		);
	});

	$content.addEventListener("click", clickHandler);
	$page.body = $content;
	app.append($page);
	helpers.showAd();

	$page.onhide = function () {
		actionStack.remove("problems");
	};

	actionStack.push({
		id: "problems",
		action: $page.hide,
	});

	/**
	 * Click handler for problems page
	 * @param {MouseEvent} e
	 */
	function clickHandler(e) {
		const $copy = e.target.closest("[data-action='copy']");
		if ($copy) {
			copyProblem($copy);
			return;
		}
		const $target = e.target.closest("[data-action='goto']");
		if (!$target) return;
		const { action } = $target.dataset;

		if (action === "goto") {
			const { fileId } = $target.dataset;
			const annotation = $target.annotation;
			if (!annotation) return;
			const row = normalizeIndex(annotation.row);
			const column = normalizeIndex(annotation.column);

			editorManager.switchFile(fileId);
			editorManager.editor.gotoLine(row + 1, column);
			$page.hide();

			setTimeout(() => {
				focusEditorIfEditable(editorManager.editor);
			}, 100);
		}
	}

	/**
	 * Copies a single problem as "file:line:column [severity] message".
	 * @param {HTMLElement} $el the copy icon carrying the annotation
	 */
	function copyProblem($el) {
		const annotation = $el.annotation;
		if (!annotation) return;
		const row = normalizeIndex(annotation.row);
		const column = normalizeIndex(annotation.column);
		const line = `${$el.dataset.fileName || ""}:${row + 1}:${column + 1} [${annotation.type}] ${annotation.text}`;
		copyText(line)
			.then(() => toast(strings["copied"] || "Copiado", 1500))
			.catch(() => {});
	}

	/** Copies every listed problem, grouped by file. */
	function copyAll() {
		const lines = [];
		$content.querySelectorAll("details.single-file").forEach(($file) => {
			const fileName = $file.dataset.fileName || "";
			$file.querySelectorAll(".problem").forEach(($problem) => {
				const annotation = $problem.annotation;
				if (!annotation) return;
				const row = normalizeIndex(annotation.row);
				const column = normalizeIndex(annotation.column);
				lines.push(
					`${fileName}:${row + 1}:${column + 1} [${annotation.type}] ${annotation.text}`,
				);
			});
		});
		if (!lines.length) return;
		copyText(lines.join("\n"))
			.then(() => toast(strings["copied"] || "Copiado", 1500))
			.catch(() => {});
	}

	function collectAnnotations(file) {
		const annotations = [];
		const { session } = file;
		const isActiveFile = editorManager.activeFile?.id === file.id;
		const state =
			isActiveFile && editorManager.editor
				? editorManager.editor.state
				: session;

		if (session && typeof session.getAnnotations === "function") {
			const aceAnnotations = session.getAnnotations() || [];
			for (const item of aceAnnotations) {
				if (!item) continue;
				const row = normalizeIndex(item.row);
				const column = normalizeIndex(item.column);
				annotations.push({
					row,
					column,
					text: item.text || "",
					type: normalizeSeverity(item.type),
				});
			}
		}

		if (state && typeof state.field === "function") {
			annotations.push(...readLspAnnotations(state));
		}
		if (state && typeof state.field === "function") {
			annotations.push(...readLinterAnnotations(state));
		}

		return annotations;
	}

	function readLspAnnotations(state) {
		const diagnostics = getLspDiagnostics(state);
		if (!diagnostics.length) return [];

		const doc = state.doc;
		if (!doc || typeof doc.lineAt !== "function") return [];

		return diagnostics
			.map((diagnostic) => {
				const start = clampPosition(diagnostic.from, doc.length);
				const line = doc.lineAt(start);
				const row = Math.max(0, line.number - 1);
				const column = Math.max(0, start - line.from);

				let message = diagnostic.message || "";
				if (diagnostic.source) {
					message = message
						? `${message} (${diagnostic.source})`
						: diagnostic.source;
				}

				return {
					row: normalizeIndex(row),
					column: normalizeIndex(column),
					text: message,
					type: normalizeSeverity(diagnostic.severity),
				};
			})
			.filter((annotation) => annotation.text);
	}

	function readLinterAnnotations(state) {
		const diagnostics = getLinterDiagnostics(state);
		if (!diagnostics.length) return [];

		const doc = state.doc;
		if (!doc || typeof doc.lineAt !== "function") return [];

		return diagnostics
			.map((diagnostic) => {
				const start = clampPosition(diagnostic.from, doc.length);
				const line = doc.lineAt(start);
				const row = Math.max(0, line.number - 1);
				const column = Math.max(0, start - line.from);

				let message = diagnostic.message || "";
				if (diagnostic.source) {
					message = message
						? `${message} (${diagnostic.source})`
						: diagnostic.source;
				}

				return {
					row: normalizeIndex(row),
					column: normalizeIndex(column),
					text: message,
					type: normalizeSeverity(diagnostic.severity),
				};
			})
			.filter((annotation) => annotation.text);
	}

	function clampPosition(pos, length) {
		if (typeof pos !== "number" || Number.isNaN(pos)) return 0;
		return Math.max(0, Math.min(pos, Math.max(0, length)));
	}

	function normalizeIndex(value) {
		if (typeof value === "number" && Number.isFinite(value)) {
			return Math.max(0, value);
		}
		const parsed = Number(value);
		if (Number.isFinite(parsed)) {
			return Math.max(0, parsed);
		}
		return 0;
	}

	function normalizeSeverity(severity) {
		switch (severity) {
			case "error":
			case "fatal":
				return "error";
			case "warn":
			case "warning":
				return "warning";
			default:
				return "info";
		}
	}

	function getIconForType(type) {
		switch (type) {
			case "error":
				return "cancel";
			case "warning":
				return "warningreport_problem";
			default:
				return "info";
		}
	}
}
