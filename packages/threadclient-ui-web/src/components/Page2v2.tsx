import {createContext, JSX, useContext} from "solid-js";
import Page2ContentManager from "../util/Page2ContentManager";

// ignores history management for now
export function Page2v2(props: {

}): JSX.Element {

}

const content_manager = createContext<Page2ContentManager>();
function getContent(): Page2ContentManager {
    const ctxres = useContext(content_manager);
    if(ctxres == null) throw new Error("No content here");
    return ctxres;
}