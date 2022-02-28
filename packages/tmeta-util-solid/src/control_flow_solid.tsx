import { Accessor, createMemo, createSignal, JSX, onCleanup, untrack } from "solid-js";
import { MatchFn, switchKindCB } from "tmeta-util";

export { default as Debugtool } from "./debugtool";
export { Key } from "./Key";

export function SwitchKind<T extends {kind: string}>(props: {
    item: T,
    children: {[Key in T["kind"]]: MatchFn<T, Key, JSX.Element>},
}): JSX.Element {
    return createMemo(() => {
        const match = switchKindCB<JSX.Element>(props.item, props.children);
        return untrack(() => match());
    });
}

export function Show<T>(props: {
    if: boolean,
    children: JSX.Element,
    fallback?: undefined | JSX.Element,
} | {
    if?: never | boolean,
    when: T | undefined | null,
    children: (item: T) => JSX.Element,
    fallback?: undefined | JSX.Element,
}): JSX.Element {
    const ifcond = createMemo(() => ('if' in props ? (props.if ?? false) : true));
    return createMemo(() => {
        if (
            ifcond() &&
            ('when' in props ? props.when != null : true)
        ) {
            const child = props.children;
            return typeof child === "function" ? untrack(() => child((props as unknown as {when: T}).when)) : child;
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
export function timeAgoText(
    start_ms: number, now: number, opts: {short?: undefined | boolean} = {},
): [string, number] {
    const ms = now - start_ms;
    if(ms < 0) return [
        opts.short ?? false ? "later" : "in the future "+new Date(start_ms).toISOString(),
        -ms,
    ];
    if(ms < 60 * 1000) return [
        opts.short ?? false ? "now" : "just now",
        60 * 1000 - ms,
    ];

    let step = 60 * 1000;
    let next_step = 60;
    if(ms < next_step * step) {
        const minutes = ms / step |0;
        return [
            opts.short ?? false ? minutes+"m" : s(minutes, " minutes")+" ago",
            step - (ms - minutes * step),
        ];
    }
    step *= next_step;
    next_step = 24;
    if(ms < next_step * step) {
        const hours = ms / step |0;
        return [
            opts.short ?? false ? hours+"h" : s(hours, " hours")+" ago",
            step - (ms - hours * step),
        ];
    }
    step *= next_step;
    next_step = 30;
    if(ms < next_step * step) {
        const days = ms / step |0;
        return [
            opts.short ?? false ? days+"d" : s(days, " days")+" ago",
            step - (ms - days * step),
        ];
    }
    const year = new Date(start_ms).getFullYear();
    if(year === new Date(now).getFullYear()) {
        return [
            opts.short ?? false ?
            new Date(start_ms).toLocaleString(undefined, {month: "short"}) :
            "in "+new Date(start_ms).toLocaleString(undefined, {month: "long"}),
            -1, // will break if you keep the page open until the next year
            // I could technically return the time until next year in ms
            // but setTimeout can only wait a maximum of like one month anyway
            // so who cares
        ];
    }
    return [
        opts.short ?? false ? "" + year : "in " + year,
        -1,
    ];
}

export function timeAgoTextWatchable(
    start_ms: number, opts: {short?: undefined | boolean} = {},
): Accessor<string> {
    const [now, setNow] = createSignal(Date.now());
    const label = createMemo(() => {
        const res_text = timeAgoText(start_ms, now(), opts);
        if(res_text[1] > 0) {
            const timeout = setTimeout(() => setNow(Date.now()), Math.min(res_text[1] + 10, 0x7fffffff));
            onCleanup(() => clearTimeout(timeout));
        }
        return res_text[0];
    });
    return label;
}

export function TimeAgo(props: {start: number}): JSX.Element {

    return <time datetime={new Date(props.start).toString()} title={"" + new Date(props.start)}>
        {timeAgoTextWatchable(props.start)}
    </time>;
}

export function localStorageSignal(key: string): [Accessor<string | null>, (nv: string | null) => void] {
    const [value, setValue] = createSignal<string | null>(localStorage.getItem(key));

    const onStorage = (e: StorageEvent) => {
        if(e.key === key) {
            setValue(e.newValue);
        }
    };
    window.addEventListener("storage", onStorage);
    onCleanup(() => window.removeEventListener("storage", onStorage));

    return [value, (new_value: string | null) => {
        if(new_value == null) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, new_value);
        }
        setValue(new_value);
    }];
}