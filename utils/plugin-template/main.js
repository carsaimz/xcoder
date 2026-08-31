/**
 * __PLUGIN_NAME__ — XCoder plugin entry.
 *
 * The plugin runs inside the XCoder webview. Use xcoder.require(name) to
 * access editor APIs (path, fs, editor, commands, toast, dialog, agents, …).
 */
const xcoder = globalThis.xcoder;
const { toast, commands } = {
  toast: xcoder.require('toast'),
  commands: xcoder.require('commands'),
};

function activate() {
  commands.register({
    id: 'plugin.__PLUGIN_ID__.hello',
    label: '__PLUGIN_NAME__: say hello',
    icon: 'sparkles',
    run() {
      toast('Hello from __PLUGIN_ID__!', 'success');
    },
  });
  console.info('[__PLUGIN_ID__] activated');
}

function deactivate() {
  console.info('[__PLUGIN_ID__] deactivated');
}

activate();

// exported for the plugin host (used on enable/disable cycles)
globalThis.plugin = { onLoad: activate, onUnload: deactivate };
