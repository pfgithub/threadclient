import type * as Generic from "api-types-generic";
import { readLink } from "api-types-generic";
import { Dialog, DialogOverlay, DialogTitle, Transition, TransitionChild } from "solid-headless";
import {
    createEffect,
    createMemo,
    createSignal,
    For, JSX, on, onCleanup, untrack
} from "solid-js";
import { Portal } from "solid-js/web";
import { Show } from "tmeta-util-solid";
import { getWholePageRootContext, size_lt } from "../util/utils_solid";
import { createMergeMemo } from "./createMergeMemo";
import { CollapseData, flatten } from "./flatten";
import { InternalIconRaw } from "./Icon";
import LandingPage from "./LandingPage";
import PageFlatItem from "./PageFlatItem";
import { array_key } from "./symbols";

type SpecialCallback = () => PageRes;
const full_page_special_callbacks: Record<string, SpecialCallback> = {
    'LandingPage@-N-ry9qt3N1VTG0iKMHy': (): PageRes => {
        return {title: "ThreadClient", children: <LandingPage />};
    },
};

export type ClientPageProps = {
    pivot: Generic.Link<Generic.Post>,
};
type PageRes = {children: JSX.Element, title: string};
export default function ClientPage(props: ClientPageProps): PageRes {
    const hprc = getWholePageRootContext();

    const specialCB = createMemo((): null | SpecialCallback => {
        const value = readLink(hprc.content(), props.pivot);
        if(value.value == null) return null;
        const v = value.value;
        if(v.kind !== "post" || v.content.kind !== "special") return null;
        const fpsc = full_page_special_callbacks[v.content.tag_uuid];
        if(fpsc == null) return null;
        return fpsc;
    });
    
    const res = createMemo((): PageRes => {
        // unfortunately have to manually code this stuff because typescript doesn't support returning
        // custom stuff from a jsx component without losing type safety
        const scb = specialCB();
        return untrack((): PageRes => {
            if(scb) {
                return scb();
            }else{
                return ClientPageMain({
                    get pivot() {return props.pivot},
                });
            }
        });
    });
    return {
        get title() {return res().title},
        get children() {return res().children},
    };
}
function ClientPageMain(props: ClientPageProps): PageRes {
    // [!] we'll want to fix this up and make it observable and stuff
    // now that page2 is ready to be properly observable, flatten should be too.

    const collapse_data: CollapseData = {
        map: new Map(),
    };

    const hprc = getWholePageRootContext();

    const view = createMergeMemo(() => {
        console.log("Reloading data!");
        const fres = flatten(props.pivot, {
            collapse_data,
            content: hprc.content(),
        });
        console.log("Data is:", fres);
        return fres;
    }, {key: array_key, merge: true});

    // 320px sidebar

    const hasSidebar = createMemo(() => size_lt.lg() && view.data.sidebar != null);

    // alternatively, we can have the sidebar be guarenteed to have a url and then the "sidebar" button would
    // repivot to the parent sidebar node. this could be nice because it would allow navigation with the
    // browser back button and stuff.
    const [showSidebar, setShowSidebar] = createSignal(false);

    createEffect(on([() => props.pivot], () => setShowSidebar(false), {defer: true}));

    return {get title() {
        return view.data.title;
    }, children: <div class="flex flex-col gap-4 max-w-6xl mx-auto p-4 <sm:px-0">
        <Show if={view.data.header != null}>
            <div class="flex-1">
                TODO show header
            </div>
        </Show>
        <Show if={hasSidebar()}>
            <div class="<sm:px-4">
                <button
                    class="bg-gray-200 rounded-md p-2 px-3"
                    onClick={() => setShowSidebar(v => !v)}
                >
                    Sidebar
                </button>
            </div>
        </Show>
        <div class="flex flex-row gap-8 justify-center">
            <div class="max-w-4xl w-full">
                <For each={view.data.body}>{item => (
                    <PageFlatItem
                        item={item}
                        collapse_data={collapse_data}
                    />
                )}</For>
            </div>
            <Show if={view.data.sidebar != null && !hasSidebar()}>
                <div class="max-w-320px w-full">
                    <For each={view.data.sidebar}>{item => (
                        <PageFlatItem
                            item={item}
                            collapse_data={collapse_data}
                        />
                    )}</For>
                </div>
            </Show>
            <Show if={hasSidebar() && showSidebar()}>
                {untrack(() => {
                    // ios doesn't support "overscroll-contain"
                    document.documentElement.style.overflow = "hidden";
                    onCleanup(() => document.documentElement.style.overflow = "");
                    return undefined;
                })}
                <Portal mount={el("div").adto(document.body)}>
                    <Dialog isOpen onClose={() => setShowSidebar(false)}>
                        <div class="
                            fixed inset-0 flex h-full flex-row flex-wrap
                            overflow-y-scroll overscroll-contain justify-start
                            bg-slate-500 dark:bg-zinc-700 bg-opacity-75 dark:bg-opacity-75
                        " style={{'-webkit-overflow-scrolling': "touch"}}>
                            <DialogOverlay class="flex-1" />
                            <button
                                type="button"
                                class="
                                    flex
                                    text-slate-900 dark:text-zinc-100
                                    rounded-md  hover:text-black
                                    focus:outline-none focus:ring-2
                                "
                                onClick={() => setShowSidebar(false)}
                            ><div>
                                <div class="sticky top-0 left-0 right-0 p-4">
                                    <InternalIconRaw class="fa-solid fa-x" label="Close panel" />
                                </div>
                            </div></button>
                            <div class="
                                bg-slate-300 dark:bg-zinc-900 shadow-lg py-6 max-w-320px
                                w-max
                            ">
                                <div class="px-4 sm:px-6">
                                    <DialogTitle class="text-lg font-medium text-gray-900">Sidebar</DialogTitle>
                                </div>
                                <div class="relative mt-6 flex-1 sm:px-6">
                                    <For each={view.data.sidebar}>{item => (
                                        <PageFlatItem
                                            item={item}
                                            collapse_data={collapse_data}
                                        />
                                    )}</For>
                                </div>
                            </div>
                        </div>
                    </Dialog>
                </Portal>
            </Show>
        </div>
    </div>};
}