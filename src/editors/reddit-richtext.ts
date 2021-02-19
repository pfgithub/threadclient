import { hideshow, HideShowCleanup } from "../app";

import * as dom from "react-dom";

import {main} from "./reddit-richtext/editor";

type Env = {usernames: string[]};
export function richtextEditor(env: Env): HideShowCleanup<HTMLDivElement> {
    const outer_frame = el("div");
    const hsc = hideshow(outer_frame);

    const frame = outer_frame;
    // // shadow dom version. this is unnecessary.
    // const frame = outer_frame.attachShadow({mode: "open"});
    // frame.adch(el("style").atxt(…));

    dom.render(main(), frame);
    hsc.on("cleanup", () => dom.unmountComponentAtNode(frame));

    return hsc;
}
