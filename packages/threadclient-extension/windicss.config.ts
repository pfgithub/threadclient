import {resolve} from "path";
import { defineConfig } from "windicss/helpers";

export default defineConfig({
    extract: {
        include: [
            // vite puts its cwd in the wrong place so we have to do this hack
            // (actually, because we don't have an index.html file, we might be
            // able to use src: "." in vite instead of src: r("src"))
            resolve(__dirname, 'src/**/*')
        ],
    },
});