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
    publicDir: "static",
});