import fsOperation from "fileSystem";
import appSettings from "./settings";
import helpers from "utils/helpers";

export interface ReplacedFile {
        url: string;
        text: string;
        name?: string;
}

export interface ReplaceFailure {
        url: string;
        error: string;
}

export interface PersistSummary {
        saved: string[];
        updated: string[];
        failed: ReplaceFailure[];
}

type EditorManagerLike = {
        getFile?: (url: string, type: string) => any;
};

/**
 * Gets the editor manager singleton without importing the module
 * (avoids loading the whole editor stack from workers/tests).
 * @returns {EditorManagerLike|undefined}
 */
function getEditorManager(): EditorManagerLike {
        return (window as any).editorManager;
}

/**
 * Persists batch replacement results to disk and refreshes open editor tabs.
 *
 * Files are written with the encoding of the open tab when possible, falling
 * back to the user's default file encoding. Tabs that are already open are
 * kept in sync with the saved content and marked as saved, so they do not
 * show a false "unsaved" state after the batch operation.
 *
 * A failed write never aborts the whole batch: the error is recorded in the
 * summary so the caller can report how many files could not be saved.
 *
 * @param {ReplacedFile[]} files Replaced files (only files whose content changed)
 * @param {(done: number, total: number) => void} [onProgress] Progress callback
 * @returns {Promise<PersistSummary>} Written/updated/failed summary
 */
export async function persistReplacedFiles(
        files: ReplacedFile[],
        onProgress?: (done: number, total: number) => void,
): Promise<PersistSummary> {
        const summary: PersistSummary = { saved: [], updated: [], failed: [] };
        const total = files.length;
        let done = 0;

        for (const item of files) {
                const { url, text } = item || ({} as ReplacedFile);
                if (url && typeof text === "string") {
                        try {
                                const manager = getEditorManager();
                                const openFile = manager?.getFile?.(url, "uri");
                                const encoding =
                                        openFile?.encoding || appSettings.value.defaultFileEncoding;
                                const fs = fsOperation(url);
                                await fs.writeFile(text, encoding);
                                summary.saved.push(url);

                                if (openFile?.loaded) {
                                        openFile.session?.setValue?.(text);
                                        const stat = await fs.stat().catch(() => null);
                                        openFile.markSaved?.({
                                                mtime: helpers.getStatMtime(stat),
                                                savedDoc: openFile.session?.doc || null,
                                        });
                                        summary.updated.push(url);
                                }
                        } catch (error) {
                                summary.failed.push({
                                        url,
                                        error: (error as Error)?.message || String(error),
                                });
                        }
                }

                done += 1;
                onProgress?.(done, total);
        }

        return summary;
}
