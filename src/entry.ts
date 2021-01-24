import {bodytop} from "./app";

type HotModule = {
    accept: (filename: string | string[], cb: () => void) => void,
};
declare let module: {hot: HotModule | undefined};
const hot = module.hot;
if(hot) {
    hot.accept("./src/app.ts", () => {
        let alertel = el("div").clss("alert");
        alertel.atxt("Page is out of date, needs reload!");
        bodytop.adch(alertel);
    });
    hot.accept(["./src/clients/reddit.ts", "./src/clients/mastodon.ts"], () => {
        console.log("hot reloaded reddit");
        // if it were possible, retransform the input json and rerender the page
    });
}