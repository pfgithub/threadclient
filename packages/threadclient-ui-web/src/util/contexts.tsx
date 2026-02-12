import { createContext } from "solid-js";
import { PageRootContext } from "./utils_solid";
import { PerPostData } from "../components/flatten";

export const hideshow_context = createContext<{visible: () => boolean}>();
export const page_root_context = createContext<PageRootContext>();
export const per_post_context = createContext<PerPostData>();
export const allow_threading_override_ctx = createContext<() => boolean>();

if(import.meta.hot) {
    // TODO move const nodecontext into its own file and only do this there
    import.meta.hot.accept((new_module) => {
        alert("cannot reload symbols.");
    });
}