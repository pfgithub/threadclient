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
        host: "0.0.0.0",
        port: 3004,
        hmr: true, // need more effort to get this working
        fs: {
            strict: true,
        },
    },
});
