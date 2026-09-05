import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);
// Same JSX transform the production bundle uses (rspack loader) — lets
// unit tests render real JSX modules (profile page, support dialog…).
const htmlTagJsxLoader = require("./utils/custom-loaders/html-tag-jsx-loader.js");

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

/** Vite plugin wrapper around the rspack JSX loader (sync callback shim). */
const xcoderJsxPlugin = {
        name: "xcoder-html-tag-jsx",
        enforce: "pre",
        transform(code, id) {
                if (!/[\\/]src[\\/]/.test(id)) return null;
                if (!/\.(js|jsx|ts|tsx)$/.test(id) || /\.d\.ts$/.test(id)) return null;
                if (!/<\/?[A-Za-z][^>]*>/.test(code)) return null;
                return new Promise((resolve, reject) => {
                        const context = {
                                resourcePath: id,
                                cacheable() {},
                                query: "",
                                async() {
                                        return (err, result) =>
                                                err ? reject(err) : resolve({ code: result, map: null });
                                },
                        };
                        try {
                                htmlTagJsxLoader.call(context, code);
                        } catch (error) {
                                reject(error);
                        }
                });
        },
};

// Mirror the bundler resolution (rspack `resolve.modules: ["node_modules", "src"]`
// and tsconfig `paths: { "*": ["./src/*"] }`) so unit tests can import app
// modules via bare paths like `utils/version` or `lib/settings`.
const srcAliases = fs
        .readdirSync(srcDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => ({
                find: new RegExp(`^${entry.name}(?:/(.*))?$`),
                replacement: `${path.join(srcDir, entry.name)}/$1`,
        }));

export default defineConfig({
        plugins: [xcoderJsxPlugin],
        // Handlebars templates are inlined as source by the production build
        // (rspack `type: 'asset/source'`) — same behavior in tests.
        assetsInclude: ["**/*.hbs"],
        resolve: {
                alias: srcAliases,
        },
        test: {
                // Vitest unit tests live ONLY under `tests/`.
                // `src/test/` is XCoder's in-app runtime test harness: it runs on-device
                // inside the WebView (launched from the app commands) and depends on
                // cordova/editorManager globals, so it must never be collected here.
                include: ["tests/**/*.test.{js,ts}"],
                exclude: [
                        ...configDefaults.exclude,
                        "src/test/**",
                        "www/**",
                        "platforms/**",
                ],
        },
});
