import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import WindiCSS from "vite-plugin-windicss";
import virtual from "vite-plugin-virtual";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
    plugins: [
        solidPlugin(),
        WindiCSS({
            scan: {
                fileExtensions: ["html", "js", "ts", "jsx", "tsx"],
            },
        }),
        virtual({
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            'virtual:_variables': "export const variables = " + JSON.stringify(require("./src/_variables.js")) + ";",
        }),
        VitePWA(),
    ],
    build: {
        target: "esnext",
        polyfillDynamicImport: false,
        // rollupOptions: {
        //     treeshake: {
        //         moduleSideEffects: [
        //             "/node_modules/refractor/*"
        //         ],
        //     },
        // },
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
        port: 3004,
        hmr: true, // to turn this on I have to clean out app.tsx :/
        fs: {
            strict: true,
        },
    },
});