// generate stub index.html files for dev entry
import { execSync } from "child_process";
import fs from "fs-extra";
import chokidar from "chokidar";
import { r, port, is_dev, log } from "./utils";

/**
 * Stub index.html to use Vite in development
 */
async function stubIndexHtml() {
    const views = [
        "options",
        "popup",
        "background",
    ];

    for (const view of views) {
        await fs.ensureDir(r(`extension/dist/${view}`));
        const data = (await fs.readFile(r(`src/${view}/index.html`), "utf-8"))
            .replace(/src=".\/(.+?)"/, `src="http://localhost:${port}/${view}/$1"`)
            .replace('<div id="app"></div>', '<div id="app">Vite server did not start</div>')
        ;
        await fs.writeFile(r(`extension/dist/${view}/index.html`), data, "utf-8");
        log("PRE", `stub ${view}`);
    }
}

function writeManifest() {
    execSync("npx esno ./src/scripts/manifest.ts", { stdio: "inherit" });
}

function copyAssets() {
    execSync("mkdir -p ./extension && cp -r ./src/assets ./extension/assets", { stdio: "inherit" });
    log("PRE", `copy assets`);
}

writeManifest();
copyAssets();

if (is_dev) {
    void stubIndexHtml();
    chokidar.watch(r("src/**/*.html")).on("change", () => {
        void stubIndexHtml();
    });
    chokidar.watch([r("src/manifest.ts"), r("package.json")]).on("change", () => {
        writeManifest();
    });
    chokidar.watch(r("src/assets/**/*")).on("change", () => {
        copyAssets();
    });
}