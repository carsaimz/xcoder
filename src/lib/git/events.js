/**
 * Git change bus — keeps the Source Control sidebar, the AI terminal and
 * any other git consumer in sync (VS Code behaviour: every mutation from
 * ANY surface refreshes the Source Control view).
 *
 * Producers: the git sidebar actions and the `git` vshell command both
 * call emitGitChange(). Consumers subscribe with onGitChange().
 */

const listeners = new Set();

/**
 * @typedef {{root: string, action: string, detail?: any}} GitEvent
 */

/**
 * Broadcasts a git mutation so open views can refresh.
 * @param {string} root workspace root url
 * @param {string} action e.g. "commit", "push", "checkout"
 * @param {object} [detail]
 */
export function emitGitChange(root, action, detail = {}) {
	const event = { root, action, detail, at: Date.now() };
	for (const listener of listeners) {
		try {
			listener(event);
		} catch (error) {
			window.log?.("error", "git listener failed:", error);
		}
	}
}

/**
 * Subscribes to git mutations.
 * @param {(event: GitEvent) => void} listener
 * @returns {() => void} unsubscribe
 */
export function onGitChange(listener) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** Removes every listener (tests / hot reload). */
export function resetGitListeners() {
	listeners.clear();
}
