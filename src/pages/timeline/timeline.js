import "./style.scss";
import { focusEditorIfEditable } from "cm/editorReadOnly";
import Page from "components/page";
import alert from "dialogs/alert";
import confirm from "dialogs/confirm";
import actionStack from "lib/actionStack";
import {
	clearSnapshots,
	listSnapshots,
	restoreSnapshot,
} from "lib/fileTimeline";
import helpers from "utils/helpers";

/**
 * Timeline of the active file (VS Code parity): local snapshots taken on
 * every save, restorable without git. Opens from the file menu.
 */
export default function Timeline() {
	const { activeFile } = editorManager;
	if (!activeFile || !activeFile.uri) {
		alert(strings.info, strings["no snapshots"]);
		return;
	}

	const $page = Page(strings["timeline"]);
	const $content = <div id="xc-timeline" />;
	$content.append(
		<p className="xc-timeline-hint">{strings["timeline hint"]}</p>,
	);
	const $list = <div className="xc-timeline-list" />;
	$content.append($list);
	$page.body = $content;
	app.append($page);
	helpers.showAd();

	$page.onhide = () => actionStack.remove("timeline");
	actionStack.push({ id: "timeline", action: $page.hide });

	render();
	bindActions();

	function bindActions() {
		$list.addEventListener("click", onClick);
	}

	async function onClick(e) {
		const $action = e.target.closest("[data-action]");
		if (!$action) return;
		const { action, stamp } = $action.dataset;

		if (action === "restore") {
			const message = strings["restore snapshot"] + "?";
			const ok = await confirm(strings["restore snapshot"], message);
			if (!ok) return;
			try {
				const text = await restoreSnapshot(activeFile.uri, Number(stamp));
				if (text === null) throw new Error("snapshot missing");
				reloadOpenTab(text);
				toast(strings["snapshot restored"]);
				$page.hide();
			} catch (error) {
				helpers.error(error);
			}
			return;
		}

		if (action === "clear") {
			const ok = await confirm(
				strings["clear timeline"],
				strings["clear timeline"] + "?",
			);
			if (!ok) return;
			await clearSnapshots(activeFile.uri);
			$page.hide();
		}
	}

	/** Pushes restored text into an open, loaded tab (checkFiles flow). */
	function reloadOpenTab(text) {
		const file = editorManager.getFile(activeFile.uri, "uri");
		if (!file?.loaded || !file.session?.setValue) return;
		const { editor } = editorManager;
		const cursorPos = editor.getCursorPosition();
		file.makeActive();
		file.markChanged = false;
		try {
			file.session.setValue(text);
			file.markLoaded({});
		} finally {
			file.markChanged = true;
		}
		file.writeToCache?.();
		editor.gotoLine(cursorPos.row, cursorPos.column);
		focusEditorIfEditable(editor);
	}

	async function render() {
		const snapshots = await listSnapshots(activeFile.uri);
		if (!snapshots.length) {
			$list.append(
				<p className="xc-timeline-empty">{strings["no snapshots"]}</p>,
			);
			return;
		}

		const $clear = (
			<button className="xc-timeline-clear" data-action="clear">
				{strings["clear timeline"]}
			</button>
		);
		$list.append($clear);

		snapshots.forEach(({ t, size }) => {
			const date = new Date(t);
			const title = formatStamp(date);
			$list.append(
				<div className="xc-timeline-row" data-stamp={t}>
					<span className="xc-timeline-time">{title}</span>
					<span className="xc-timeline-size">
						{size} {strings["characters"]}
					</span>
					<button
						className="xc-timeline-restore"
						data-action="restore"
						data-stamp={t}
					>
						{strings.restore}
					</button>
				</div>,
			);
		});
	}

	/** @param {Date} date */
	function formatStamp(date) {
		const now = Date.now();
		const diff = Math.floor((now - date.getTime()) / 1000);
		const count = (unit) => Math.floor(diff / unit);

		if (diff < 60) return strings["just now"];

		if (diff < 3600) {
			const val = count(60);
			return strings[val === 1 ? "min singular" : "min plural"].replace(
				/\{count\}/,
				val,
			);
		}

		if (diff < 86400) {
			const val = count(3600);
			return strings[val === 1 ? "hour singular" : "hour plural"].replace(
				/\{count\}/,
				val,
			);
		}

		const val = count(86400);
		return strings[val === 1 ? "day singular" : "day plural"].replace(
			/\{count\}/,
			val,
		);
	}
}
