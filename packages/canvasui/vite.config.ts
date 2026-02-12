import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  plugins: [solidPlugin()],
  build: {
    target: "esnext",
  },
  publicDir: "public",

  server: {
    host: "0.0.0.0",
    port: 5072,
    fs: {
      strict: true,
    },
  },
});
