import type * as Generic from "api-types-generic";
import { JSX, onCleanup } from "solid-js";
import { Show } from "tmeta-util-solid";
import {
    classes
} from "../util/utils_solid";
import { CollapseData, getCState } from "./flatten";

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

export function CollapseButton(props: {
    class?: undefined | string,
    collapsed_raw: boolean,
    collapsed_anim: boolean,
    onClick: () => void,
    real: boolean,
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
    return <button
        class={classes(
            "w-15px box-border cursor-pointer min-h-13px pl-6px pr-6px",
            "z-1 static outline-default",
            props.class ?? "",
            props.collapsed_anim ? "bgimg-collapse-btn-collapsed" : "",
            props.threaded ?? false ? "threaded-new" : "",
        )}
        draggable={true}
        onClick={() => props.onClick()}
        aria-label="Collapse"
        aria-pressed={props.collapsed_raw}
        tabindex={props.real ? undefined : "-1"}
        aria-hidden={props.real ? true : undefined}
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
        <Show if={!props.collapsed_anim}>
            <div class={classes(
                "w-3px h-full",
                props.cstates && props.id && getCState(props.cstates, props.id).hovering() > 0 ?
                "bg-$collapse-line-color-hover" : 
                "bg-$collapse-line-color",
            )}></div>
        </Show>
    </button>;
}