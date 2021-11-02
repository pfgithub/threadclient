import fs from "fs-extra";
import { getManifest } from "../manifest";
import { r, log } from "./utils";

export async function writeManifest(): Promise<void> {
    await fs.writeJSON(r("extension/manifest.json"), await getManifest(), { spaces: 2 });
    log("PRE", "write manifest.json");
}

void writeManifest();