import { defineConfig } from "vite";
import { shared_config } from "./vite.config";
import { r, is_dev } from "./src/scripts/utils";
import packageJson from "./package.json";

// bundling the content script using Vite
export default defineConfig({
  ...shared_config,
  build: {
    watch: is_dev
      ? {
        include: [
          r("src/content_scripts/**/*"),
          r("src/components/**/*"),
        ],
      }
      : undefined,
    outDir: r("extension/dist/contentScripts"),
    cssCodeSplit: false,
    emptyOutDir: false,
    sourcemap: is_dev ? "inline" : false,
    lib: {
      entry: r("src/content_scripts/content_script.ts"),
      name: packageJson.name,
      formats: ["iife"],
    },
    rollupOptions: {
      output: {
        entryFileNames: "index.global.js",
        extend: true,
      },
    },
  },
  plugins: [
    ...shared_config.plugins!,
  ],
});