import type * as Generic from "api-types-generic";
import { readLink } from "api-types-generic";
import {
    createMemo,
    createSignal,
    For, JSX, untrack
} from "solid-js";
import { Show } from "tmeta-util-solid";
import { getWholePageRootContext, size_lt } from "../util/utils_solid";
import { createMergeMemo } from "./createMergeMemo";
import { CollapseData, flatten } from "./flatten";
import LandingPage from "./LandingPage";
import PageFlatItem from "./PageFlatItem";
import { array_key } from "./symbols";
import ToggleButton from "./ToggleButton";

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
        if(value == null) return null;
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

    const tabbed = createMemo(() => size_lt.lg() && view.data.sidebar != null);

    // alternatively, we can have the sidebar be guarenteed to have a url and then the "sidebar" button would
    // repivot to the parent sidebar node. this could be nice because it would allow navigation with the
    // browser back button and stuff.
    const [tab, setTab] = createSignal<"content" | "sidebar">("content");

    return {get title() {
        return view.data.title;
    }, children: <div class="flex flex-col gap-4 max-w-6xl mx-auto p-4 <sm:px-0">
        <Show if={view.data.header != null}>
            <div class="flex-1">
                TODO show header
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
                <div class="sm:max-w-320px w-full">
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