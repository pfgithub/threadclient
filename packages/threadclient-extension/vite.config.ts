import { dirname, relative } from "path";
import { defineConfig, UserConfig, Plugin } from "vite";
import solidPlugin from "vite-plugin-solid";
import WindiCSS from "vite-plugin-windicss";
import windi_config from "./windicss.config";
import { is_dev, port, r } from "./src/scripts/utils";

export const shared_config: UserConfig = {
    root: r("src"),
    resolve: {
        alias: {
            '~/': `${r("src")}/`,
        },
    },
    define: {
        __DEV__: JSON.stringify(is_dev),
    },
    plugins: [
        solidPlugin(),

        WindiCSS({
            scan: {
                fileExtensions: ["html", "js", "ts", "jsx", "tsx"],
            },
            config: windi_config,
            // it took me 30 minutes to figure out why windi css wasn't working and it was because:
            // 1. vite root is set to src/ so its pwd is in src/ (clued in by how vite was talking
            //    about "../extension/" instead of "extension/" like I'd expect it to)
            // 2. when I tried re-exporting windicss.config.ts in src/ it was using the wrong path
            //    because I set it to include a relative path to src/
            // anyway now that I've figured it out, there's one last bug to fix
            // I wonder what it is
            // https://user-images.githubusercontent.com/6010774/139969444-eccc4867-4083-4a9c-a856-493b18453906.png
        }),

        // rewrite assets to use relative path (iffe should not be necessary
        //, there was a weird eslint issue probably caused by mixed ts versions
        // that needs to be resolved)
        ((): Plugin => ({
            name: "assets-rewrite",
            enforce: "post",
            apply: "build",
            transformIndexHtml(html, {path}) {
                return html.replace(/"\/assets\//g, `"${relative(dirname(path), "/assets")}/`);
            },
        }))(),
    ],
    optimizeDeps: {
        include: [
            "webextension-polyfill",
        ],
        // https://github.com/vitejs/vite/pull/4716
        // once I upgrade vite this can be removed
        exclude: ["@vite/client", "@vite/env"],
    },
    esbuild: {
        tsconfigRaw: {
            compilerOptions: {
                importsNotUsedAsValues: "remove"
            },
        },
    },
};

export default defineConfig(({command}) => ({
    ...shared_config,
    base: command === "serve" ? `http://localhost:${port}/` : "/dist/",
    server: {
        port,
        hmr: {
            host: "localhost",
        },
    },
    build: {
        outDir: r("extension/dist"),
        emptyOutDir: false,
        sourcemap: is_dev ? "inline" : false,
        // https://developer.chrome.com/docs/webstore/program_policies/#:~:text=Code%20Readability%20Requirements
        terserOptions: {
            mangle: false,
        },
        rollupOptions: {
            input: {
                background: r("src/background/index.html"),
                options: r("src/options/index.html"),
                popup: r("src/popup/index.html"),
            },
        },
    },
    plugins: [
        ...shared_config.plugins!,
    ],
}));
