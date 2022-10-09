import { createContext } from "solid-js";
import { CollapseData } from "../components/flatten";
import { PageRootContext } from "./utils_solid";

export const hideshow_context = createContext<{visible: () => boolean}>();
export const page_root_context = createContext<PageRootContext>();
export const collapse_data_context = createContext<CollapseData>();
export const allow_threading_override_ctx = createContext<() => boolean>();

if(import.meta.hot) {
    // TODO move const nodecontext into its own file and only do this there
    import.meta.hot.accept((new_module) => {
        alert("cannot reload symbols.");
    });
}