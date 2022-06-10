import type * as Generic from "api-types-generic";
import { JSX, onCleanup } from "solid-js";
import { Show } from "tmeta-util-solid";
import { navbar } from "../router";
import {
    classes, ToggleColor
} from "../util/utils_solid";
import { CollapseData, getCState } from "./flatten";
import { InternalIcon } from "./Icon";

// ok
// - the plan for fixing scroll:
// - we'll have a single function that is called to collapse a post rather than
//   using cs.setCollapsed
// - oh wait we can put it in cs.setCollapsed
// - anyway the idea is we want to find the top and bottom nodes
// - huh
// - ok I have no plan
// - I guess when we do virtualized scrolling we'll pretty clearly be able to know
//   about all the nodes and stuff
//
// the plan for animations I think will be really boring:
// - don't delete nodes in dom, just set them hidden
// - if a node is hidden, transition it to opacity-0 and on transition end, set
//   display none
// - basically just don't animate height sadly. it looked really nice while we had
//   it but good things cannot last.
// - if this were native, we could probably render the thing to a canvas and do it
//   pretty easily. unfortunately, this is web.

function symbolToString(v: Generic.Link<unknown>): string {
    const wv = window as unknown as {__tc_object_map: Map<Generic.Link<unknown>, number>};
    wv.__tc_object_map ??= new Map();
    let pv = wv.__tc_object_map.get(v);
    if(pv == null) {
        pv = wv.__tc_object_map.size;
        wv.__tc_object_map.set(v, pv);
    }
    return "#"+pv+"#"+v.toString();
}

function idFor(id: Generic.Link<unknown>, state: boolean) {
    return "tc-collapse-button@" + state + ":" + symbolToString(id);
}
export function CollapseButton(props: {
    class?: undefined | string,
    onClick: () => void,
    mode: "fake" | "collapse_only" | "reveal_only",
    cstates?: undefined | CollapseData,
    threaded?: undefined | boolean,
    id?: undefined | Generic.Link<Generic.Post>,
}): JSX.Element {
    let in_hovers = false;
    onCleanup(() => {
        if(!props.id || !props.cstates) return;
        const cst = getCState(props.cstates, props.id);

        if(in_hovers) cst.setHovering(v => v - 1);
        in_hovers = false;
    });
    const collapsed = () => props.mode === "reveal_only";
    const real = () => props.mode !== "fake";
    return <button
        // hmm. there will be a bug with displaying multiple posts from different clients
        // TODO: require that all post ids start with the client id
        // TODO: get rid of symbol ids
        // TODO: get rid of client_id fields in generic
        id={real() && props.id != null ? idFor(props.id, collapsed()) : undefined}
        class={classes(
            "w-15px box-border cursor-pointer min-h-13px",
            "z-1 static outline-default group",
            props.class ?? "",
            props.threaded ?? false ? "threaded-new" : "",
        )}
        draggable={true}
        onClick={e => {
            // 0. check if in view
            let orig_button: HTMLElement | null;
            if(props.id == null) {
                if(real()) {
                    orig_button = e.currentTarget;
                }else orig_button = null;
            }else{
                orig_button = document.getElementById(idFor(props.id, collapsed()));
            }
            let should_scroll = false;
            const navbar_size = navbar.getBoundingClientRect();
            const visualTop = () => 5 + Math.max(
                0, 
                navbar_size.bottom,
                window.visualViewport.offsetTop,
            );
            if(orig_button) {
                const orig_size = orig_button.getBoundingClientRect();
                should_scroll = orig_size.top < visualTop();
            }

            // 1. click
            props.onClick();
            
            // 2. scrollIntoView()
            let new_button: HTMLElement | null;
            if(props.id == null) {
                if(real()) {
                    new_button = e.currentTarget;
                }else new_button = null;
            }else{
                new_button = document.getElementById(idFor(props.id, !collapsed()));
            }
            if(new_button && should_scroll) {
                new_button.scrollIntoView();
                document.documentElement.scrollTop -= visualTop();
            }

            // 3. focus();
            new_button?.focus();
        }}
        aria-label="Collapse"
        aria-pressed={collapsed()}
        tabindex={real() ? undefined : "-1"}
        aria-hidden={real() ? undefined : true}
        onmouseover={() => {
            if(!props.id || !props.cstates) return;
            const cst = getCState(props.cstates, props.id);

            if(!in_hovers) cst.setHovering(v => v + 1);
            in_hovers = true;
        }}
        onmouseleave={() => {
            if(!props.id || !props.cstates) return;
            const cst = getCState(props.cstates, props.id);

            if(in_hovers) cst.setHovering(v => v - 1);
            in_hovers = false;
        }}
    >
        <Show if={!collapsed()} fallback={
            <InternalIcon
                class="mx-auto text-xs text-gray-600 dark:text-blue-400"
                tag={"fa-circle-plus"} filled label={null}
            />
        }>
            <ToggleColor>{(__, i) => <>
                <div class={classes(
                    "w-3px mx-auto h-full",
                    props.cstates && props.id && getCState(props.cstates, props.id).hovering() > 0 ? (
                        "bg-slate-500 dark:bg-zinc-600"
                    ) : (
                        (i % 2 === 1 ? "bg-slate-300" : "bg-slate-400") + " dark:bg-zinc-700"
                    ),
                    "group-hover:bg-slate-500 dark:group-hover:bg-zinc-600",
                )}></div>
            </>}</ToggleColor>
        </Show>
    </button>;
}