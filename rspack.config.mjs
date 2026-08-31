import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@rspack/cli';
import { rspack } from '@rspack/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV !== 'development';

export default defineConfig({
  context: __dirname,
  entry: {
    bundle: './src/main.ts',
  },
  output: {
    path: resolvePath(__dirname, './www'),
    filename: 'bundle.js',
    clean: false, // keep committed www/index.html
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [/node_modules/],
        use: [
          {
            loader: 'builtin:swc-loader',
            options: {
              jsc: {
                parser: { syntax: 'typescript' },
                target: 'es2022',
              },
            },
          },
        ],
      },
      {
        test: /\.css$/,
        type: 'css/auto',
      },
    ],
  },
  experiments: {
    css: true,
  },
  plugins: [],
  mode: isProd ? 'production' : 'development',
  devtool: isProd ? false : 'source-map',
  devServer: {
    static: ['./www'],
    port: 8080,
    hot: true,
    historyApiFallback: true,
  },
  performance: {
    maxAssetSize: 3_000_000,
    maxEntrypointSize: 3_000_000,
  },
  rspack(rspackOptions, { webpack }) {
    // silence critical dep warnings for dynamic imports (prettier, pyodide)
    return rspackOptions;
  },
});
