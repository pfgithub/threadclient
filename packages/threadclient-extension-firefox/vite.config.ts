import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import WindiCSS from "vite-plugin-windicss";

export default defineConfig({
    root: __dirname + "/src/",
    plugins: [
        solidPlugin(),
        WindiCSS({
            scan: {
                fileExtensions: ["html", "js", "ts", "jsx", "tsx"],
            },
        }),
        {
            name: 'assets-rewrite',
            enforce: 'post',
            apply: 'build',
            transformIndexHtml(html) {
                return html.replace(/"\/assets\//g, '"../assets/')
            },
        },
    ],
    build: {
        target: "esnext",
        polyfillDynamicImport: false,
        // https://developer.chrome.com/docs/webstore/program_policies/#:~:text=Code%20Readability%20Requirements
        terserOptions: {
            mangle: false,
        },
        rollupOptions: {
            input: {
                background: __dirname + "/src/background/index.html",
                options: __dirname + "/src/options/index.html",
                popup: __dirname + "/src/popup/index.html",
            },
        },
    },
    esbuild: {
        tsconfigRaw: {
            compilerOptions: {
                importsNotUsedAsValues: "remove"
            },
        },
    },
    publicDir: "static",

    server: {
        port: 3023,
        fs: {
            strict: true,
        },
        host: true,
    },
});