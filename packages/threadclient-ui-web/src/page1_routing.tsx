import type * as Generic from "api-types-generic";
import { createEffect, createSignal, untrack } from "solid-js";
import { render } from "solid-js/web";
import { UUID } from "tmeta-util";
import { Debugtool, Show } from "tmeta-util-solid";
import ClientPage from "./components/PageRoot";
import { hideshow, renderPath } from "./page1";
import {
    current_nav_history_key, navigate_event_handlers,
    nav_history_map, page2mainel, rootel, setCurrentHistoryKey, uuid
} from "./router";
import { vanillaToSolidBoundary } from "./util/interop_solid";
import { DefaultErrorBoundary, getSettings, PageRootProvider } from "./util/utils_solid";


export type MutablePage2HistoryNode = {
    page: Generic.Page2,
    query: string,
};
function addLayer(node: Generic.Page2, new_layer: Generic.Page2Content): Generic.Page2 {
    console.log("!ADDDING LAYER", node, new_layer);
    return {...node, content: {...node.content, ...new_layer}};
}

export let showPage2!: (page: MutablePage2HistoryNode, first_show: boolean) => void;
export let hidePage2!: () => void;

{
    const [pgin, setPgin] = createSignal<MutablePage2HistoryNode>(null as unknown as MutablePage2HistoryNode, {
        equals: (a, b) => false, // so if you click two loaders at once, both update the same pgin
    });
    let page2_viewer_initialized = false;

    const initializePage2Viewer = () => {
        if(page2_viewer_initialized) return;
        page2_viewer_initialized = true;

        // TODO: set page title in here
        vanillaToSolidBoundary(page2mainel, () => <DefaultErrorBoundary data={pgin}>
            <PageRootProvider
                pgin={pgin()}
                addContent={(upd_pgin, content) => {
                    upd_pgin.page = addLayer(upd_pgin.page, content);
                    if(pgin() === upd_pgin) {
                        setPgin(pgin()); // the pgin that was updated is currently being viewed; refresh
                    }
                }}
            >
                {untrack(() => {
                    const  res = ClientPage({
                        get pivot() {
                            return pgin().page.pivot;
                        },
                        get query() {
                            return pgin().query;
                        },
                    });
                    createEffect(() => {
                        document.title = res.title + " | " + "ThreadClient";
                    });
                    // TODO: createEffect(() => history.replaceState(res.url));

                    return () => res.children;
                })}
            </PageRootProvider>
        </DefaultErrorBoundary>);
    };
    showPage2 = (new_pgin: MutablePage2HistoryNode, first_show: boolean) => {
        console.log("showing page2", new_pgin.page);
        page2mainel.style.display = "";

        setPgin(new_pgin);
        console.log("SHOWPAGE2 CALLED ON", new_pgin);

        initializePage2Viewer();

        if(first_show) {
            const pivot = document.querySelector(".\\@\\@IS_PIVOT\\@\\@") ?? document.body;
            pivot.scrollIntoView();
        }
    };
    hidePage2 = () => {
        page2mainel.style.display = "none";
    };
}


export type NavigationEntryNode = {
    kind: "t1",
    removeSelf: () => void, hide: () => void, show: () => void,
} | {
    kind: "t2",
    page2: MutablePage2HistoryNode,
};
export type NavigationEntry = {url: string, node: NavigationEntryNode};

export type HistoryState = {key: UUID};

export function navigate({path, page, mode}: {
    path: string,
    page?: undefined | Generic.Page2,
    mode?: undefined | "navigate" | "replace",
}): void {
    if(path.startsWith("/")) path = path.replace("/", "#") || "#/";
    const hstate: HistoryState = {key: uuid()};
    console.log("Appending history state index", hstate, path);
    if(mode === "replace") {
        history.replaceState(hstate, "", path);
    }else{
        history.pushState(hstate, "", path);
    }
    // TODO: work differently for replacestate
    onNavigate(hstate.key, location, page);
}


export type URLLike = {search: string, pathname: string, hash: string};


export function onNavigate(to_key: UUID, url_in: URLLike, page: undefined | Generic.Page2): void {
    const url = url_in.pathname === "/" && url_in.search === "" && url_in.hash.length > 2 ? (() => {
        try {
            return new URL("https://thread.pfg.pw/"+url_in.hash.substring(1));
        }catch(e) {
            return url_in;
        }
    })() : url_in;

    console.log("Navigating", to_key, url, to_key, page, [...nav_history_map.keys()]);

    document.title = "ThreadClient";
    navigate_event_handlers.forEach(evh => evh(url));
    const thisurl = url.pathname + url.search;

    const prev_key = current_nav_history_key;
    setCurrentHistoryKey(to_key);

    // hide all history
    hidePage2();
    [...nav_history_map.values()].forEach(item => {
        if(item.node.kind === "t1") {
            item.node.hide();
        }
    });

    const historyitem = nav_history_map.get(to_key);
    if(historyitem) {
        // show the current history
        if(historyitem.node.kind === "t1") historyitem.node.show();
        else showPage2(historyitem.node.page2, false);
        return; // done
    } else {
        // remove
        const ordered_keys = [...nav_history_map.keys()].sort();
        for(let i = ordered_keys.length - 1; i >= 0; i--) {
            const key = ordered_keys[i]!;
            if(key <= prev_key) break;
            const value = nav_history_map.get(key)!;
            nav_history_map.delete(key);
            if(value.node.kind === "t1") value.node.removeSelf();
        }
    }

    if(page) {
        const page2 = page;
        const pagemut: MutablePage2HistoryNode = {page: page2, query: url.search};

        showPage2(pagemut, true);
        nav_history_map.set(to_key, {node: {
            kind: "t2",
            page2: pagemut,
        }, url: thisurl});

        return;
    }

    const hsc = hideshow();
    const node = renderPath(url.pathname, url.search).defer(hsc).adto(rootel);
    hsc.on("cleanup", () => node.remove());
    hsc.on("hide", () => node.style.display = "none");
    hsc.on("show", () => node.style.display = "");

    const naventry: NavigationEntryNode = {
        kind: "t1",
        removeSelf: () => hsc.cleanup(),
        hide: () => hsc.setVisible(false),
        show: () => hsc.setVisible(true),
    };

    nav_history_map.set(to_key, {node: naventry, url: thisurl});
}


export function startDebugTool(root: HTMLElement) {
    const belowbody = document.createElement("div");
    document.body.appendChild(belowbody);

    const settings = getSettings();

    render(() => <Show if={settings.dev.highlightUpdates() === "on"}>
        <Debugtool observe_root={root} />
    </Show>, belowbody);
    // <Show when={enabled in settings}>
    //     <Lazy v={import("").debugtool}>
}