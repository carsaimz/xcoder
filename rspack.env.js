/**
 * Static asset copies shared by all build modes.
 * Kept in a separate file so `rspack.config.js` stays readable.
 */
const { rspack } = require('@rspack/core');

module.exports = {
  plugins: [
    new rspack.CopyRspackPlugin({
      patterns: [
        { from: 'src/ui/index.html', to: 'index.html' },
        { from: 'src/ui/styles', to: 'css' },
        { from: 'src/ui/icons', to: 'icons' },
        { from: 'src/lang', to: 'lang' },
        { from: 'node_modules/@xterm/xterm/css/xterm.css', to: 'css/xterm.css' },
        { from: 'LICENSE', to: 'LICENSE.txt' }
      ]
    })
  ]
};
