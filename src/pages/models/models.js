import "./style.scss";
import Page from "components/page";
import toast from "components/toast";
import confirm from "dialogs/confirm";
import loader from "dialogs/loader";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import actionStack from "lib/actionStack";
import { onCustomModelsChanged, removeCustomModel } from "lib/ai/customModels";
import { importModelFromLink } from "lib/ai/hfImport";
import { formatBytes, modelsByKind } from "lib/ai/localModels";
import {
	cancelDownload,
	deleteLocalModel,
	downloadModel,
	isDownloading,
	isModelDownloaded,
	localStorageUsage,
} from "lib/ai/modelDownloads";
import { findModelFolders, importModelFromFolder } from "lib/ai/modelImport";
import { setProviderModel } from "lib/ai/providers";
import { getRoot } from "lib/ai/vshell";
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

/** Language filter chips (model.lang values). */
const LANGS = [
	{ id: "all", label: strings["local models lang all"] || "Todos" },
	{ id: "pt", label: "PT" },
	{ id: "multi", label: strings["local models lang multi"] || "Multi" },
	{ id: "en", label: "EN" },
];

/** Sort modes — catalog order is lightest-first (the historical default). */
const SORTS = [
	{
		id: "default",
		label: strings["local models sort default"] || "Mais leve primeiro",
	},
	{
		id: "size-desc",
		label: strings["local models sort size desc"] || "Tamanho: maior primeiro",
	},
	{
		id: "name-asc",
		label: strings["local models sort name"] || "Nome (A–Z)",
	},
];

/**
 * Local models screen — browse, filter, sort, download, use and delete
 * on-device AI models (LLM assistants, speech-to-text and text-to-speech).
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
	let query = "";
	let lang = "all";
	let sort = "default";

	const $tabs = <div className="models-tabs"></div>;
	const $filters = <div className="models-filters"></div>;
	const $storage = <div className="models-storage"></div>;
	const $list = <div className="main list models-list"></div>;

	renderTabs();
	renderFilters();
	renderStorage();
	renderImportRow();

	// imported models (files/link) appear as soon as they are registered
	onCustomModelsChanged(() => {
		if ($page.isConnected) renderList();
	});

	$page.body = (
		<div className="models-body">
			<p className="models-intro">
				{strings["local models intro"] ||
					"Baixe modelos para conversar, transcrever voz e gerar fala sem internet — dos leves (~56MB) aos completos (~1,4GB)."}
			</p>
			{$tabs}
			{$filters}
			{$storage}
			{$list}
		</div>
	);

	app.append($page);
	renderList();

	/** Buttons: baixar via link + importar arquivos do aparelho. */
	function renderImportRow() {
		const $row = <div className="models-import-row"></div>;
		$row.append(
			<button className="models-import-btn" onclick={importByLink}>
				<span className="icon link"></span>
				{strings["local models import link"] || "Baixar via link"}
			</button>,
			<button className="models-import-btn" onclick={importFromFiles}>
				<span className="icon folder_open"></span>
				{strings["local models import files"] || "Importar arquivos"}
			</button>,
		);
		$filters.after($row);
	}

	/** Adds a Hugging Face model by link and offers to download it now. */
	async function importByLink() {
		const input = await prompt(
			strings["local models link prompt"] ||
				"Link do modelo (https://huggingface.co/org/repo)",
			"",
			"text",
		);
		if (!input) return;
		const hide = await loader.create(
			strings["local models importing"] || "Importando modelo…",
			input,
			{ timeout: 0 },
		);
		let entry;
		try {
			({ entry } = await importModelFromLink(input));
		} catch (error) {
			hide.destroy();
			helpers.error(error);
			return;
		}
		hide.destroy();
		const size = entry.sizeBytes > 0 ? formatBytes(entry.sizeBytes) : "?";
		const ok = await confirm(
			entry.name,
			`${strings["local models link found"] || "Modelo detectado"}: ${entry.dtype.toUpperCase()} · ${size}. ${
				strings["local models link download"] || "Baixar agora?"
			}`,
		);
		if (!ok) {
			renderList();
			return;
		}
		await downloadWithLoader(entry);
	}

	/** Copies model files from a workspace folder into the model store. */
	async function importFromFiles() {
		const root = getRoot();
		const folders = await findModelFolders(root);
		if (!folders.length) {
			toast(
				strings["local models no folders"] ||
					"Nenhuma pasta de modelo encontrada. Abra no editor a pasta que contém config.json + onnx/ e tente de novo.",
				5000,
			);
			return;
		}
		const chosen = await select(
			strings["local models pick folder"] || "Pasta do modelo",
			folders.map((folder) => ({
				value: folder.url,
				text: folder.name,
				icon: "folder",
			})),
		);
		if (!chosen) return;
		const hide = await loader.create(
			strings["local models importing"] || "Importando modelo…",
			chosen,
			{ timeout: 0 },
		);
		try {
			const { entry } = await importModelFromFolder(chosen);
			toast(
				`${strings["local models imported"] || "Modelo importado"}: ${entry.name}`,
				4000,
			);
		} catch (error) {
			helpers.error(error);
		} finally {
			try {
				hide.destroy();
			} catch {
				/* noop */
			}
			renderList();
			renderStorage();
		}
	}

	/** Shared loader-driven download (used by the link import flow). */
	async function downloadWithLoader(entry) {
		const $loader = await loader.create(entry.name, "", { timeout: 0 });
		const result = await downloadModel(entry, {
			onEvent: (event) => {
				if (event.status === "downloading") {
					const pct =
						event.total > 0
							? Math.round((event.loaded / event.total) * 100)
							: 0;
					$loader.setMessage(`${pct}%`);
				} else if (event.status === "done") {
					toast(
						`${strings["local models done"] || "Modelo instalado"}: ${entry.name}`,
					);
				} else if (event.status === "error") {
					toast(
						`${strings["local models failed"] || "Falha no download"}: ${event.error}`,
						4000,
					);
				}
			},
		});
		try {
			$loader.destroy();
		} catch {
			/* noop */
		}
		renderList();
		renderStorage();
		if (!result.ok && !result.cancelled && result.error) {
			helpers.error(new Error(result.error));
		}
	}

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

	function renderFilters() {
		$filters.content = "";

		const $search = (
			<input
				type="text"
				className="models-search"
				placeholder={strings["local models search"] || "Procurar modelo…"}
				spellcheck="false"
				oninput={(event) => {
					query = event.target.value || "";
					renderList();
				}}
			/>
		);

		const $chips = (
			<div className="models-lang">
				{LANGS.map((entry) => (
					<button
						className={`models-lang-chip${lang === entry.id ? " active" : ""}`}
						onclick={() => {
							if (lang === entry.id) return;
							lang = entry.id;
							renderFilters();
							renderList();
						}}
					>
						{entry.label}
					</button>
				))}
			</div>
		);

		const sortLabel =
			SORTS.find((entry) => entry.id === sort)?.label || SORTS[0].label;
		const $sort = (
			<button
				className="models-sort"
				onclick={async () => {
					const choice = await select(
						strings["local models sort title"] || "Ordenar por",
						SORTS.map((entry) => ({
							value: entry.id,
							text: entry.label,
						})),
					);
					if (!choice || choice === sort) return;
					sort = choice;
					renderFilters();
					renderList();
				}}
			>
				<span className="icon swap_vert"></span>
				<span className="models-sort-label">{sortLabel}</span>
			</button>
		);

		$filters.append($search, $chips, $sort);
	}

	function renderStorage() {
		localStorageUsage()
			.then(({ bytes, count }) => {
				$storage.textContent =
					count > 0
						? `${strings["local models used"] || "Usado"}: ${formatBytes(bytes)} · ${count} ${
								strings["local models count"] || "modelo(s)"
							}`
						: strings["local models storage empty"] ||
							"Nenhum modelo instalado";
			})
			.catch(() => {
				$storage.textContent = "";
			});
	}

	/** Applies search + language filter + sort to the catalog of `kind`. */
	function visibleModels() {
		let list = modelsByKind(kind);
		if (lang !== "all") {
			list = list.filter((model) => (model.lang || "multi") === lang);
		}
		const needle = query.trim().toLowerCase();
		if (needle) {
			list = list.filter((model) =>
				`${model.name} ${model.descPt} ${model.descEn}`
					.toLowerCase()
					.includes(needle),
			);
		}
		if (sort === "size-desc") {
			list = [...list].sort((a, b) => b.sizeBytes - a.sizeBytes);
		} else if (sort === "name-asc") {
			list = [...list].sort((a, b) => a.name.localeCompare(b.name));
		} else if (sort === "size-asc") {
			list = [...list].sort((a, b) => a.sizeBytes - b.sizeBytes);
		}
		return list;
	}

	async function renderList() {
		$list.content = "";
		const models = visibleModels();
		if (!models.length) {
			$list.append(
				<div className="models-empty">
					{strings["local models empty"] ||
						"Nenhum modelo corresponde aos filtros."}
				</div>,
			);
			return;
		}
		for (const model of models) {
			$list.append(
				ModelCard(model, () => {
					renderList();
					renderStorage();
				}),
			);
		}
	}
}

/**
 * One model card with its live state (download progress / installed).
 */
function ModelCard(model, onChange) {
	const size = formatBytes(model.sizeBytes);
	const langLabel =
		model.lang === "pt"
			? "PT"
			: model.lang === "en"
				? "EN"
				: strings["local models lang badge"] || "PT/EN+";
	const desc =
		window.strings?.__lang === "en"
			? model.descEn
			: model.descPt || model.descEn;

	const $title = <div className="models-card-title">{model.name}</div>;
	const $meta = (
		<div className="models-card-meta">
			<span className="models-chip">{size}</span>
			<span className="models-chip">{langLabel}</span>
			{model.custom ? (
				<span className="models-chip">
					{model.source === "link"
						? strings["local models source link"] || "Link HF"
						: strings["local models source files"] || "Importado"}
				</span>
			) : null}
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
			if (model.custom) await removeCustomModel(model.id);
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
