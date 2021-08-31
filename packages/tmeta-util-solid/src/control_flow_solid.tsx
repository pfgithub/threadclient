import { createMemo, createSignal, JSX, onCleanup, untrack } from "solid-js";
import { MatchFn, switchKindCB } from "tmeta-util";

export function SwitchKind<T extends {kind: string}>(props: {
    item: T,
    children: {[Key in T["kind"]]: MatchFn<T, Key, JSX.Element>},
}): JSX.Element {
    return createMemo(() => {
        const match = switchKindCB<JSX.Element>(props.item, props.children);
        return match();
    });
}

export function ShowBool(props: {
    when: boolean,
    fallback?: undefined | JSX.Element,
    children: JSX.Element,
}): JSX.Element {
    const condition = createMemo(() => props.when, undefined, {
        equals: (a: boolean, b: boolean) => !a === !b,
    });
    return createMemo(() => {
        if(condition()) return props.children;
        return props.fallback;
    });
}
export function ShowCond<T>(props: {
    // if: boolean, // would be nice for this to be optional but not allow undefined
    if?: undefined | [boolean],
    when: T | undefined | null,
    fallback?: undefined | JSX.Element,
    children: (item: T) => JSX.Element,
}): JSX.Element {
    return createMemo(() => {
        if ((props.if?.[0] ?? true) && props.when != null) {
            const child = props.children;
            return untrack(() => child(props.when!));
        }
        return props.fallback;
    });
}

// TODO export function Show<T>{
//    if?: never | boolean,
//    when?: never | T,
//    fallback?: undefined | JSX.Element,
//    children: T exists ? (item: T) => JSX.Element : JSX.Element,
// }


export function allowedToAcceptClick(target: Node, frame: Node): boolean {
    // don't click if any text is selected
    const selection = document.getSelection();
    if(selection?.isCollapsed === false) return false;
    // don't accept click if any of the click target parent nodes look like they might be clickable
    let target_parent = target as Node | null;
    while(target_parent && target_parent !== frame) {
        if(target_parent instanceof HTMLElement && (false
            || target_parent.nodeName === "A"
            || target_parent.nodeName === "BUTTON"
            || target_parent.nodeName === "VIDEO"
            || target_parent.nodeName === "AUDIO"
            || target_parent.nodeName === "INPUT"
            || target_parent.nodeName === "TEXTAREA"
            || target_parent.nodeName === "IFRAME"
            || target_parent.classList.contains("resizable-iframe")
            || target_parent.classList.contains("handles-clicks")
        )) return false;
        target_parent = target_parent.parentNode;
    }
    return true;
}

function s(number: number, text: string) {
    if(!text.endsWith("s")) throw new Error("!s");
    if(number === 1) return number + text.substring(0, text.length - 1);
    return number + text;
}

// TODO replace this with a proper thing that can calculate actual "months ago" values
// returns [time_string, time_until_update]
export function timeAgoText(start_ms: number, now: number): [string, number] {
    const ms = now - start_ms;
    if(ms < 0) return ["in the future "+new Date(start_ms).toISOString(), -ms];
    if(ms < 60 * 1000) return ["just now", 60 * 1000 - ms];

    let step = 60 * 1000;
    let next_step = 60;
    if(ms < next_step * step) {
        const minutes = ms / step |0;
        return [s(minutes, " minutes")+" ago", step - (ms - minutes * step)];
    }
    step *= next_step;
    next_step = 24;
    if(ms < next_step * step) {
        const hours = ms / step |0;
        return [s(hours, " hours")+" ago", step - (ms - hours * step)];
    }
    step *= next_step;
    next_step = 30;
    if(ms < next_step * step) {
        const days = ms / step |0;
        return [s(days, " days")+" ago", step - (ms - days * step)];
    }
    return [new Date(start_ms).toISOString(), -1];
}

export function TimeAgo(props: {start: number}): JSX.Element {
    const [now, setNow] = createSignal(Date.now());
    const label = createMemo(() => {
        const res_text = timeAgoText(props.start, now());
        if(res_text[1] > 0) {
            const timeout = setTimeout(() => setNow(Date.now()), Math.min(res_text[1] + 10, 0x7fffffff));
            onCleanup(() => clearTimeout(timeout));
        }
        return res_text[0];
    });
    return <time datetime={new Date(props.start).toString()} title={"" + new Date(props.start)}>
        {label}
    </time>;
}