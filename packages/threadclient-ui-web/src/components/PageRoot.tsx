import type * as Generic from "api-types-generic";
import { readLink } from "api-types-generic";
import {
    createMemo,
    createSignal,
    For, JSX, untrack, useContext
} from "solid-js";
import { Show } from "tmeta-util-solid";
import FullscreenSnapView from "../experiments/fullscreen_snap_view/FullscreenSnapView";
import ReaderView from "../experiments/reader_view/ReaderView";
import { collapse_data_context, getWholePageRootContext, provide, size_lt } from "../util/utils_solid";
import { useFlatten } from "./flatten2";
import LandingPage from "./LandingPage";
import PageFlatItem from "./PageFlatItem";
import ToggleButton from "./ToggleButton";

type SpecialCallback = () => PageRes;
const full_page_special_callbacks: Record<string, SpecialCallback> = {
    'LandingPage@-N-ry9qt3N1VTG0iKMHy': (): PageRes => {
        return {url: null, title: "ThreadClient", children: <LandingPage />};
    },
};

export type ClientPageProps = {
    pivot: Generic.Link<Generic.Post>,
};
type PageRes = {children: JSX.Element, url: string | null, title: string};
export default function ClientPage(props: ClientPageProps & {query: string}): PageRes {
    const hprc = getWholePageRootContext();

    const specialCB = createMemo((): null | SpecialCallback => {
        const value = readLink(hprc.content(), props.pivot);
        if(value == null) return null;
        if(value.value == null) return null;
        const v = value.value;
        if(v.kind !== "post" || v.content.kind !== "special") return null;
        const fpsc = full_page_special_callbacks[v.content.tag_uuid];
        if(fpsc == null) return null;
        return fpsc;
    });
    
    const res = createMemo((): PageRes => {
        const tc_view = (new URLSearchParams(props.query)).get("--tc-view");
        if(tc_view === "fullscreen") {
            return untrack((): PageRes => ({
                url: null, // TODO
                title: "TODO fullscreen title",
                children: FullscreenSnapView({
                    get pivot() {return props.pivot},
                }),
            }));
        }
        if(tc_view === "reader") {
            return untrack((): PageRes => ({
                url: null, // TODO
                title: "TODO reader title",
                children: ReaderView({
                    get pivot() {return props.pivot},
                }),
            }));
        }

        const scb = specialCB();
        return untrack((): PageRes => {
            return provide(collapse_data_context, {
                map: new Map(),
            }, () => {
                if(scb) {
                    return scb();
                }else{
                    // collapse_data_context.Provider({
                    //     value: {
                    //         map: new Map(),
                    //     },
                    // });

                    // I want a provide(v => …) => v

                    return ClientPageMain({
                        get pivot() {return props.pivot},
                    });
                }
            });
        });
    });
    return {
        get url() {return res().url},
        get title() {return res().title},
        get children() {return res().children},
    };
}
function ClientPageMain(props: ClientPageProps): PageRes {
    // [!] we'll want to fix this up and make it observable and stuff
    // now that page2 is ready to be properly observable, flatten should be too.

    const collapse_data = useContext(collapse_data_context)!;

    const view = {data: useFlatten(() => props.pivot)};

    // const view = createMergeMemo(() => {
    //     console.log("Reloading data!");
    //     const fres = flatten(props.pivot, {
    //         collapse_data,
    //         content: hprc.content(),
    //     });
    //     console.log("Reloaded. New data:", fres);

    //     // function findCycle(obj, path, parents) {
    //     //     if(obj != null && typeof obj === "object") {
    //     //         const np = new Map(parents);
    //     //         np.set(obj, path);
    //     //         for(const [key, value] of Object.entries(obj)) {
    //     //             const subpath = [...path, key];
    //     //             const prev = np.get(value);
    //     //             if(prev != null) {
    //     //                 console.log("ECYCLIC. value", prev, "repeated at", subpath);
    //     //                 continue;
    //     //             }
    //     //             findCycle(value, subpath, np);
    //     //         }
    //     //     }
    //     // }

    //     return fres;
    // }, {key: array_key, merge: true});

    // 320px sidebar

    const tabbed = createMemo(() => size_lt.lg() && view.data.sidebar != null);

    // alternatively, we can have the sidebar be guarenteed to have a url and then the "sidebar" button would
    // repivot to the parent sidebar node. this could be nice because it would allow navigation with the
    // browser back button and stuff.
    const [tab, setTab] = createSignal<"content" | "sidebar">("content");

    return {get url() {
        return view.data.url;
    }, get title() {
        return view.data.title;
    }, children: <div class="flex flex-col gap-4 max-w-6xl mx-auto p-4 <sm:px-0">
        <Show if={view.data.aboveBody.length !== 0}>
            <div>
                <For each={view.data.aboveBody}>{item => (
                    <PageFlatItem
                        item={item}
                        collapse_data={collapse_data}
                    />
                )}</For>
            </div>
        </Show>
        <Show if={tabbed()}>
            <div class={
                "flex flex-col items-center justify-center p-1 bg-slate-100 dark:bg-zinc-800 "
                +(tab() === "sidebar" ? "sticky top-0 left-0 right-0 shadow-md z-2" : "")
            }>
                <ToggleButton
                    value={tab()}
                    setValue={v => v ? setTab(v) : void 0}
                    choices={[
                        ["content" as const, <>Content</>],
                        ["sidebar" as const, <>Sidebar</>],
                    ]}
                />
            </div>
        </Show>
        <div class="flex flex-row gap-8 justify-center">
            <Show if={tabbed() ? tab() === "content" : true}>
                <div class="sm:max-w-4xl w-full">
                    <For each={view.data.body}>{item => (
                        <PageFlatItem
                            item={item}
                            collapse_data={collapse_data}
                        />
                    )}</For>
                </div>
            </Show>
            <Show if={view.data.sidebar != null && (tabbed() ? tab() === "sidebar" : true)}>
                <div class="sm:max-w-320px w-full h-max" ref={stickySidebar}>
                    <For each={view.data.sidebar}>{item => (
                        <PageFlatItem
                            item={item}
                            collapse_data={collapse_data}
                        />
                    )}</For>
                </div>
            </Show>
        </div>
    </div>};
}

function stickySidebar(el: HTMLDivElement) {
    // css was so close to getting this right
    // unfortunately, position:sticky doesn't scroll down as you scroll down the page
    // https://stackoverflow.com/questions/47618271/position-sticky-scrollable-when-longer-than-viewport
    // look at how much of a mess you have to make to work around this

    // this feels like when they added 'background-attachment: fixed' but didn't add
    // percentages to enable parallax

    // el.style.position = "sticky";
    // el.style.top = "0";
}