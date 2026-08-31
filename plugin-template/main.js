/**
 * XCoder plugin — entry point (classic script, no bundler needed).
 *
 * Lifecycle:
 *   1. XCoder loads this file with a <script> tag when the plugin is enabled.
 *   2. The top level MUST register hooks via xcoder.setPluginInit/Unmount.
 *   3. XCoder then calls init(baseUrl, $page, cache).
 *   4. On disable/restart, unmount() runs — reverse everything init() did.
 *
 * Full guide: docs/plugin-development.md
 */

/**
 * @param {string} baseUrl - absolute URL of this plugin's folder (ends with '/')
 * @param {PluginPage} $page - UI surface reserved for this plugin
 * @param {{ cacheFileUrl: string, cacheFile: FileHandle, firstInit: boolean }} cache
 */
function init(baseUrl, $page, cache) {
  // resolve APIs inside init — never at top level
  const commands = xcoder.require('commands');
  const editorManager = xcoder.require('editorManager');
  const toast = xcoder.require('toast');
  const events = xcoder.require('events');

  // --- 1. a command palette entry with a keybinding -------------------------
  commands.addCommand({
    name: 'my-plugin.stats',
    description: 'Show document statistics',
    bindKey: { win: 'Ctrl-Alt-S', mac: 'Command-Alt-S' },
    exec: () => {
      const editor = editorManager.activeEditor;
      if (!editor) {
        toast.warning('Open a file first');
        return;
      }
      const text = editor.view.state.doc.toString();
      $page.setTitle('Document Stats');
      $page.innerHTML = [
        '<h2>' + editor.title + '</h2>',
        '<ul>',
        '<li>Characters: ' + text.length + '</li>',
        '<li>Words: ' + ((text.match(/\S+/g) || []).length) + '</li>',
        '<li>Lines: ' + (text.split('\n').length) + '</li>',
        '</ul>',
        '<p style="color:#8b8b8b">Cache file: ' + cache.cacheFileUrl + '</p>'
      ].join('');
      $page.show();
    }
  });

  // --- 2. react to app events ------------------------------------------------
  const offSave = events.on('editor:save', ({ url }) => {
    console.log('[my-plugin] saved:', url);
  });

  // --- 3. one-time setup ------------------------------------------------------
  if (cache.firstInit) {
    cache.cacheFile.write(JSON.stringify({ installedAt: Date.now() }));
  }

  // keep cleanup handlers reachable from unmount()
  cleanup = () => {
    commands.removeCommand('my-plugin.stats');
    offSave();
  };
}

let cleanup = () => {};

/** Plugin entry — signature fixed by the plugin contract. */
function unmount() {
  cleanup();
  cleanup = () => {};
}

xcoder.setPluginInit('com.xcoder.my-plugin', init);
xcoder.setPluginUnmount('com.xcoder.my-plugin', unmount);
