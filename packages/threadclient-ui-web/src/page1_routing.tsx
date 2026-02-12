import type * as Generic from "api-types-generic";
import { batch, createEffect, createSignal, onCleanup, untrack, JSX } from "solid-js";
import { render } from "solid-js/web";
import { UUID } from "tmeta-util";
import { Debugtool, Show } from "tmeta-util-solid";
import Page2v2 from "./components/Page2v2";
import ClientPage from "./components/PageRoot";
import ToggleButton from "./components/ToggleButton";
import { hideshow, HideShowCleanup, renderPath } from "./page1";
import {
    current_nav_history_key, navigate_event_handlers,
    nav_history_map, page2mainel, rootel, setCurrentHistoryKey, uuid
} from "./router";
import { vanillaToSolidBoundary } from "./util/interop_solid";
import Page2ContentManager from "./util/Page2ContentManager";
import { DefaultErrorBoundary, getSettings, getWholePageRootContext, PageRootContext, PageRootProvider } from "./util/utils_solid";

function GlobalPageRootViewer(): JSX.Element {
    const hprc = getWholePageRootContext();
    console.log("%globalPageRootViewer", hprc);
    const wany = window as unknown as {hprc: null | PageRootContext};
    wany.hprc = hprc;
    onCleanup(() => {
        wany.hprc = null;
        console.log("%globalPageRootViewerDc", hprc);
    });
    return <></>;
}


export type NavigationEntryNode = {
    removeSelf: () => void, hide: () => void, show: () => void,
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

    document.title = "ThreadClient";
    navigate_event_handlers.forEach(evh => evh(url));
    const thisurl = url.pathname + url.search;

    const prev_key = current_nav_history_key;
    setCurrentHistoryKey(to_key);

    // hide all history
    [...nav_history_map.values()].forEach(item => {
        item.node.hide();
    });

    const historyitem = nav_history_map.get(to_key);
    if(historyitem) {
        // show the current history
        historyitem.node.show();
        return; // done
    } else {
        // remove
        const ordered_keys = [...nav_history_map.keys()].sort();
        for(let i = ordered_keys.length - 1; i >= 0; i--) {
            const key = ordered_keys[i]!;
            if(key <= prev_key) break;
            const value = nav_history_map.get(key)!;
            nav_history_map.delete(key);
            value.node.removeSelf();
        }
    }

    const hsc = hideshow();

    let node: HTMLDivElement;
    if(page) {
        // * consider for safety doing a check that the url parses to the same pivot link in the client
        node = renderPage2(page, url.search).defer(hsc).adto(rootel);
    }else{
        node = renderPath(url.pathname, url.search).defer(hsc).adto(rootel);
    }

    hsc.on("cleanup", () => node.remove());
    hsc.on("hide", () => node.style.display = "none");
    hsc.on("show", () => node.style.display = "");
    
    const naventry: NavigationEntryNode = {
        removeSelf: () => hsc.cleanup(),
        hide: () => hsc.setVisible(false),
        show: () => hsc.setVisible(true),
    };
    
    nav_history_map.set(to_key, {node: naventry, url: thisurl});
}

export function renderPage2(page: Generic.Page2, query: string): HideShowCleanup<HTMLDivElement> {
    const elem = el("div");
    const hsc = hideshow(elem);

    const content = new Page2ContentManager();
    content.addData(page.content);

    // huh, we could include page1 as a tab here if we wanted
    const [viewMode, setViewMode] = createSignal<"2v1" | "2v2">("2v1");

    vanillaToSolidBoundary(elem, () => {
        return <DefaultErrorBoundary data={content}>
            <PageRootProvider
                content={content}
                addContent={(append_page) => {
                    batch(() => {
                        content.addData(append_page);
                    });
                }}
            >
                <GlobalPageRootViewer />
                <Show if={getSettings().page2v2Toggle() === "on"}><div>
                    <ToggleButton
                        value={viewMode()}
                        setValue={v => v ? setViewMode(v) : void 0}
                        choices={[
                            ["2v1" as const, <>Page2v1</>],
                            ["2v2" as const, <>Page2v2</>],
                        ]}
                    />
                </div></Show>
                <DefaultErrorBoundary data={content}>{viewMode() === "2v1" ? untrack(() => {
                    const res = ClientPage({
                        pivot: page.pivot,
                        query,
                    });
                    createEffect(() => {
                        // TODO: only when visible
                        document.title = res.title + " | " + "ThreadClient";
                    });
                    // TODO: set current url in url bar to the res url but only when visible

                    return () => res.children;
                }) : <Page2v2 pivot={page.pivot} />}</DefaultErrorBoundary>
            </PageRootProvider>
        </DefaultErrorBoundary>;
    }).defer(hsc);
    setTimeout(() => elem.scrollIntoView(), 0);

    return hsc;
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
