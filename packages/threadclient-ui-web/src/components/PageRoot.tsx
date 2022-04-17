import type * as Generic from "api-types-generic";
import { readLink } from "api-types-generic";
import {
    createMemo,
    createSignal,
    For, JSX, untrack
} from "solid-js";
import { Show } from "tmeta-util-solid";
import { DefaultErrorBoundary, getWholePageRootContext, size_lt } from "../util/utils_solid";
import { createMergeMemo } from "./createMergeMemo";
import { CollapseData, flatten } from "./flatten";
import LandingPage from "./LandingPage";
import PageFlatItem from "./PageFlatItem";
import { array_key } from "./symbols";

type SpecialCallback = () => JSX.Element;
const full_page_special_callbacks: Record<string, SpecialCallback> = {
    'LandingPage@-N-ry9qt3N1VTG0iKMHy': (): JSX.Element => {
        return <LandingPage />;
    },
};

export type ClientPageProps = {
    pivot: Generic.Link<Generic.Post>,
};
export default function ClientPage(props: ClientPageProps): JSX.Element {
    const hprc = getWholePageRootContext();

    const specialCB = (): null | SpecialCallback => {
        const value = readLink(hprc.content(), props.pivot);
        if(value.value == null) return null;
        const v = value.value;
        if(v.kind !== "post" || v.content.kind !== "special") return null;
        const fpsc = full_page_special_callbacks[v.content.tag_uuid];
        if(fpsc == null) return null;
        return fpsc;
    };
    
    return <DefaultErrorBoundary data={props}><Show when={specialCB()} fallback={
        <ClientPageMain pivot={props.pivot} />
    }>{cb => <>
        {untrack(cb)}
    </>}</Show></DefaultErrorBoundary>;
}
function ClientPageMain(props: ClientPageProps): JSX.Element {
    // [!] we'll want to fix this up and make it observable and stuff
    // now that page2 is ready to be properly observable, flatten should be too.

    const collapse_data: CollapseData = {
        map: new Map(),
    };

    const hprc = getWholePageRootContext();

    const view = createMergeMemo(() => {
        console.log("Reloading data!");
        return flatten(props.pivot, {
            collapse_data,
            content: hprc.content(),
        });
    }, {key: array_key, merge: true});

    // 320px sidebar

    const tabbed = createMemo(() => size_lt.lg() && view.data.sidebar != null);

    // alternatively, we can have the sidebar be guarenteed to have a url and then the "sidebar" button would
    // repivot to the parent sidebar node. this could be nice because it would allow navigation with the
    // browser back button and stuff.
    const [tab, setTab] = createSignal<"content" | "sidebar">("content");

    return <div class="flex flex-col gap-4 max-w-6xl mx-auto p-4 <sm:px-0">
        <Show if={view.data.header != null}>
            <div class="flex-1">
                TODO show header
            </div>
        </Show>
        <Show if={tabbed()}>
            <div>
                <button
                    class="bg-gray-200 rounded-md p-2 px-3"
                    onClick={() => setTab(v => v === "content" ? "sidebar" : "content")}
                >
                    {tab() === "content" ? "Sidebar" : "Content"}
                </button>
            </div>
        </Show>
        <div class="flex flex-row gap-4 justify-center">
            <Show if={tabbed() ? tab() === "content" : true}>
                <div class="max-w-4xl w-full">
                    <For each={view.data.body}>{item => (
                        <PageFlatItem
                            item={item}
                            collapse_data={collapse_data}
                        />
                    )}</For>
                </div>
            </Show>
            <Show if={view.data.sidebar != null && (tabbed() ? tab() === "sidebar" : true)}>
                <div class="max-w-320px w-full">
                    <For each={view.data.sidebar}>{item => (
                        <PageFlatItem
                            item={item}
                            collapse_data={collapse_data}
                        />
                    )}</For>
                </div>
            </Show>
        </div>
    </div>;
}