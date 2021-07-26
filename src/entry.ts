import "./_stdlib";
import {showAlert} from "./app";

type HotModule = {
    accept: ((filename: string | string[], cb: () => void) => void) & ((cb: () => void) => void),
};
declare let module: {hot: HotModule | undefined};
const hot = module.hot;
if(hot) {
    hot.accept(["./src/app.ts", "./src/editors/reddit-richtext.ts"], () => {
        showAlert("Page is out of date, needs reload!");
    });
    hot.accept([
        "./src/clients/base.ts",
        "./src/clients/reddit.ts",
        "./src/clients/mastodon.ts",
        "./src/clients/test.ts",
    ], () => {
        showAlert("Page is out of date, needs reload!");
        // re-transform the input and reload the page or something
    });
    hot.accept(() => {
        showAlert("Page is out of date, needs reload!");
    });
}