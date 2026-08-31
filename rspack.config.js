/**
 * Rspack configuration for XCoder.
 *
 * Outputs a single-file IIFE bundle into `www/` so the app can run both:
 *   - inside the Android WebView (Cordova serves `www/`)
 *   - directly in a desktop browser (open `www/index.html`)
 *
 * Static assets (HTML, CSS, language JSON) are copied verbatim.
 */
const { defineConfig } = require('@rspack/cli');
const config = require('./rspack.env');

module.exports = defineConfig({
  context: __dirname,
  entry: {
    xcoder: './src/main.ts'
  },
  output: {
    path: __dirname + '/www',
    filename: 'js/[name].js',
    clean: true,
    library: { type: 'iife', name: 'XCoderBundle' }
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    alias: {
      '@api': __dirname + '/src/api',
      '@core': __dirname + '/src/core',
      '@lib': __dirname + '/src/lib',
      '@ui': __dirname + '/src/ui',
      '@lang': __dirname + '/src/lang',
      '@types-app': __dirname + '/src/types'
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [/node_modules/],
        type: 'javascript/auto',
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: { syntax: 'typescript', decorators: false },
              target: 'es2021',
              loose: false
            },
            module: { type: 'es6' }
          }
        }
      }
    ]
  },
  plugins: config.plugins,
  devtool: 'source-map',
  optimization: {
    minimize: process.env.NODE_ENV === 'production',
    splitChunks: false
  },
  performance: {
    maxAssetSize: 4 * 1024 * 1024,
    maxEntrypointSize: 4 * 1024 * 1024,
    hints: false
  },
  stats: { preset: 'errors-warnings', assets: true }
});
