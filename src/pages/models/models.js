import "./style.scss";
import fsOperation from "fileSystem";
import Page from "components/page";
import toast from "components/toast";
import confirm from "dialogs/confirm";
import loader from "dialogs/loader";
import actionStack from "lib/actionStack";
import { formatBytes, modelsByKind } from "lib/ai/localModels";
import {
	cancelDownload,
	deleteLocalModel,
	downloadModel,
	isDownloading,
	isModelDownloaded,
	localStorageUsage,
} from "lib/ai/modelDownloads";
import { setProviderModel } from "lib/ai/providers";
import appSettings from "lib/settings";
import helpers from "utils/helpers";

const KINDS = [
	{
		id: "llm",
		icon: "🤖",
		label: strings["local models tab llm"] || "Assistentes",
	},
	{
		id: "stt",
		icon: "🎙️",
		label: strings["local models tab stt"] || "Voz → texto",
	},
	{
		id: "tts",
		icon: "🔊",
		label: strings["local models tab tts"] || "Texto → voz",
	},
];

/**
 * Local models screen — browse, download, use and delete on-device AI
 * models (LLM assistants, speech-to-text and text-to-speech).
 */
export default function modelsPage() {
	const $page = Page(strings["local models title"] || "Modelos locais");
	$page.classList.add("models-page");

	actionStack.push({
		id: "modelsPage",
		action: () => {
			$page.hide();
		},
	});
	$page.onhide = () => {
		actionStack.remove("modelsPage");
	};

	let kind = "llm";
	const $tabs = <div className="models-tabs"></div>;
	const $storage = <div className="models-storage"></div>;
	const $list = <div className="main list models-list"></div>;

	renderTabs();
	renderStorage();

	$page.body = (
		<div className="models-body">
			<p className="models-intro">
				{strings["local models intro"] ||
					"Baixe modelos para conversar, transcrever voz e gerar fala sem internet — dos leves (~56MB) aos completos (~1,2GB)."}
			</p>
			{$tabs}
			{$storage}
			{$list}
		</div>
	);

	app.append($page);
	renderList();

	function renderTabs() {
		$tabs.content = "";
		for (const entry of KINDS) {
			const $tab = (
				<button
					className={`models-tab${entry.id === kind ? " active" : ""}`}
					onclick={() => {
						if (kind === entry.id) return;
						kind = entry.id;
						renderTabs();
						renderList();
					}}
				>
					<span className="models-tab-icon">{entry.icon}</span>
					<span>{entry.label}</span>
				</button>
			);
			$tabs.append($tab);
		}
	}

	async function renderStorage() {
		try {
			const { bytes, count } = await localStorageUsage();
			$storage.textContent =
				count > 0
					? `${strings["local models used"] || "Usado"}: ${formatBytes(bytes)} · ${count} ${
							strings["local models count"] || "modelo(s)"
						}`
					: strings["local models storage empty"] || "Nenhum modelo instalado";
		} catch {
			$storage.textContent = "";
		}
	}

	async function renderList() {
		$list.content = "";
		const cards = modelsByKind(kind).map((model) =>
			ModelCard(model, () => {
				renderList();
				renderStorage();
			}),
		);
		for (const $card of cards) {
			$list.append($card);
		}
	}
}

/**
 * One model card with its live state (download progress / installed).
 */
function ModelCard(model, onChange) {
	const size = formatBytes(model.sizeBytes);
	const langLabel =
		model.lang === "pt" ? "PT" : model.lang === "en" ? "EN" : "PT/EN+";
	const desc =
		window.strings?.__lang === "en"
			? model.descEn
			: model.descPt || model.descEn;

	const $title = <div className="models-card-title">{model.name}</div>;
	const $meta = (
		<div className="models-card-meta">
			<span className="models-chip">{size}</span>
			<span className="models-chip">{langLabel}</span>
		</div>
	);
	const $desc = <div className="models-card-desc">{desc}</div>;
	const $action = <div className="models-card-action"></div>;
	const $progress = (
		<div className="models-progress" style="display:none">
			<div className="models-progress-bar"></div>
		</div>
	);

	const $card = (
		<div className="models-card">
			<div className="models-card-head">
				{$title}
				{$meta}
			</div>
			{$desc}
			{$progress}
			{$action}
		</div>
	);

	refresh();

	async function refresh() {
		const installed = await isModelDownloaded(model.id);
		if (installed) {
			showInstalled();
			return;
		}
		if (isDownloading(model.id)) {
			// download started elsewhere — show indeterminate bar
			showProgress(0, model.sizeBytes);
			return;
		}
		showIdle();
	}

	function showIdle() {
		$progress.style.display = "none";
		$action.content = "";
		const $btn = (
			<button className="models-btn primary" onclick={() => startDownload()}>
				{strings["local models download"] || "Baixar"}
			</button>
		);
		$action.append($btn);
	}

	function showInstalled() {
		$progress.style.display = "none";
		$action.content = "";
		const $state = (
			<span className="models-chip ok">
				{strings["local models installed"] || "✓ Instalado"}
			</span>
		);
		const $use =
			model.kind === "llm" ? (
				<button className="models-btn primary" onclick={useInChat}>
					{strings["local models use"] || "Usar no chat"}
				</button>
			) : null;
		const $del = (
			<button className="models-btn danger" onclick={remove}>
				{strings["local models delete"] || "Apagar"}
			</button>
		);
		$action.append($state, $use, $del);
	}

	function showProgress(loaded, total) {
		$progress.style.display = "block";
		const pct =
			total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
		$progress.get(".models-progress-bar").style.width = `${pct}%`;
		$action.content = "";
		const $cancel = (
			<button
				className="models-btn"
				onclick={() => {
					cancelDownload(model.id);
					toast(strings["local models cancelled"] || "Download cancelado");
				}}
			>
				{strings["cancel"] || "Cancelar"} · {pct}%
			</button>
		);
		$action.append($cancel);
	}

	async function startDownload() {
		showProgress(0, model.sizeBytes);
		const result = await downloadModel(model, {
			onEvent: (event) => {
				if (event.status === "downloading") {
					showProgress(event.loaded, event.total || model.sizeBytes);
				} else if (event.status === "done") {
					toast(
						`${strings["local models done"] || "Modelo instalado"}: ${model.name}`,
					);
					onChange();
				} else if (event.status === "cancelled") {
					onChange();
				} else if (event.status === "error") {
					toast(
						`${strings["local models failed"] || "Falha no download"}: ${event.error}`,
						4000,
					);
					onChange();
				}
			},
		});
		if (!result.ok && !result.cancelled && result.error) {
			helpers.error(new Error(result.error));
		}
	}

	async function useInChat() {
		try {
			await setProviderModel("local", model.id);
			await appSettings.update({ aiProvider: "local" });
			toast(
				`${strings["local models using"] || "Ativo no chat"}: ${model.name}`,
			);
		} catch (error) {
			helpers.error(error);
		}
	}

	async function remove() {
		const ok = await confirm(
			strings["local models delete title"] || "Apagar modelo",
			`${model.name} · ${size}`,
		);
		if (!ok) return;
		try {
			loader.showTitleLoader();
			await deleteLocalModel(model.id);
			toast(strings["local models deleted"] || "Modelo apagado");
			onChange();
		} catch (error) {
			helpers.error(error);
		} finally {
			loader.removeTitleLoader();
		}
	}

	return $card;
}
