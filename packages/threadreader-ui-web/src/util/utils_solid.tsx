import {
    Accessor, createContext, createEffect, createMemo,
    createRoot,
    createSignal, ErrorBoundary, JSX, onCleanup, untrack, useContext,
} from "solid-js";
import { render } from "solid-js/web";
import { link_styles_v } from "../app";
import type { ThreadClient } from "threadreader-client-base";
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

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ColorDepthContext = createContext<{i: number}>();

// !! TODO test in page1, make sure link previews work !!!!
export function ToggleColor(props: {children: (color: string, i: number) => JSX.Element}): JSX.Element {
    const parent_color = useContext(ColorDepthContext);
    const this_color = parent_color?.i ?? 0;
    const next_color = this_color + 1;
    return <ColorDepthContext.Provider value={{i: next_color}}>
        {props.children(this_color % 2 === 0 ? "bg-postcolor-100" : "bg-body", this_color)}
    </ColorDepthContext.Provider>;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const ClientContext = createContext<{client: ThreadClient}>();
export function ClientProvider(props: {client: ThreadClient, children: JSX.Element}): JSX.Element {
    return <ClientContext.Provider value={{client: props.client}}>{props.children}</ClientContext.Provider>;
}
export function getClient(): (() => ThreadClient) { // TODO getClient: (): ThreadClient =}
    const client = useContext(ClientContext);
    if(!client) throw new Error("A client is required to render this component");
    return createMemo(() => client.client); // turns out you can't update provider values? weird
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const HideshowContext = createContext<{visible: () => boolean}>();

export function HideshowProvider(props: {visible: () => boolean, children: JSX.Element}): JSX.Element {
    const parent_state = useContext(HideshowContext);
    const selfVisible = createMemo(() => {
        const parent_v = parent_state?.visible() ?? true;
        const props_v = props.visible();
        return parent_v ? props_v : false;
    });
    return <HideshowContext.Provider value={{visible: selfVisible}}>{props.children}</HideshowContext.Provider>;
}

export function getIsVisible(): (() => boolean) {
    const visible_state = useContext(HideshowContext);
    return visible_state?.visible ?? (() => true);
}

// versions of built in control flow with strict booleans

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

export type ComputeProperty<T> = {
    value: () => T,
    compute: {
        base: () => T,
        override: () => T | undefined,
        setOverride(value: T | undefined): void,
    },
};
export type ColorScheme = "light" | "dark";
export type AuthorPfp = "on" | "off";
export type UpdateNotifications = "on" | "off";
export type CustomVideoControls = "browser" | "custom";
export type PageVersion = "1" | "2";
export type LinkHelpers = "show" | "hide";
export type CorsProxy = "on" | "off";
export type GalleryDisplay = "fullscreen" | "inline"; // if the gallery view prefers fullscreen when available
export type Motion = "full" | "reduce";
export type AnimationDevMode = "none" | "shift_slow";
export type Settings = {
    color_scheme: ComputeProperty<ColorScheme>,
    author_pfp: ComputeProperty<AuthorPfp>,
    update_notifications: ComputeProperty<UpdateNotifications>,
    custom_video_controls: ComputeProperty<CustomVideoControls>,
    page_version: ComputeProperty<PageVersion>,
    link_helpers: ComputeProperty<LinkHelpers>,
    cors_proxy: ComputeProperty<CorsProxy>,
    gallery_display: ComputeProperty<GalleryDisplay>,
    motion: ComputeProperty<Motion>,
    animation_time: ComputeProperty<number>,
    animation_dev_mode: ComputeProperty<AnimationDevMode>,
};

type SerializerDeserializer<T> = {
    serialize(v: T): string,
    deserialize(v: string | undefined): T | undefined,
};
function localStorageProperty<
    T, Serializer extends (T extends string ? Partial<SerializerDeserializer<T>> : SerializerDeserializer<T>),
>(ls_key: string, accessBase: Accessor<T>, serializer: Serializer): ComputeProperty<T> {
    const getLocalStorageValue = (): T | undefined => {
        const lsv = localStorage.getItem(ls_key) ?? undefined;
        return serializer.deserialize ? serializer.deserialize(lsv) : lsv as unknown as T;
    };

    const [override, internalSetOverride] = createSignal(getLocalStorageValue());
    const onStorageUpdate = () => {
        internalSetOverride(getLocalStorageValue() as unknown as undefined);
        // as unknown as undefined is needed because typescript allows T to be a function
        // for some reason (no way to restrict it to just string) and set fns are overloaded
        // using some messy types to allow setCounter(v => v + 1)
        // also, interestingly this was introduced in a patch update (1.0.3) but listed
        // as a breaking change.
    };
    window.addEventListener("storage", onStorageUpdate);

    return {
        value: () => override() ?? accessBase(),
        compute: {
            base: accessBase,
            override,
            setOverride: (value) => {
                if(value == null) {
                    localStorage.removeItem(ls_key);
                }else{
                    localStorage.setItem(ls_key,
                        serializer.serialize
                        ? serializer.serialize(value)
                        : value as unknown as string,
                    );
                }
                onStorageUpdate();
            },
        },
    };
}

function signalFromMatchMedia<True extends string, False extends string>(
    query: string, when_true: True, when_false: False,
): Accessor<True | False> {
    const reduce_motion = window.matchMedia(query);
    const [motionBase, setMotionBase] = createSignal<True | False>(reduce_motion.matches ? when_true : when_false);
    const evtl = () => {
        setMotionBase(() => reduce_motion.matches ? when_true : when_false);
    };
    reduce_motion.addEventListener("change", evtl);
    onCleanup(() => {
        reduce_motion.removeEventListener("change", evtl);
    });

    return motionBase;
}

const global_settings = createRoot((): Settings => {
    const res: Settings = {
        color_scheme: localStorageProperty("color-scheme",
            signalFromMatchMedia("(prefers-color-scheme: dark)", "dark", "light"),
        {}),
        author_pfp: localStorageProperty("pfp-cfg", () => "on", {}),
        update_notifications: localStorageProperty("update_notices", () => "on", {}),
        custom_video_controls: localStorageProperty("custom_video_controls", () => "browser", {}),
        page_version: localStorageProperty("page_version", () => "1", {}),
        link_helpers: localStorageProperty("link_helpers", () => "show", {}),
        cors_proxy: localStorageProperty("cors_proxy", () => "off", {}),
        gallery_display: localStorageProperty("gallery_display", () => "fullscreen", {}),
        motion: localStorageProperty("motion",
            signalFromMatchMedia("(prefers-reduced-motion: reduce)", "reduce", "full"),
        {}), // can do a hacky * {transition-duration: 0s !important} if I want to
        animation_time: localStorageProperty("animation_time", () => 0.2, {
            serialize: (value) => JSON.stringify(value),
            deserialize: (str) => str != null && str !== "" ? JSON.parse(str) as number : undefined,
        }),
        animation_dev_mode: localStorageProperty("animation_dev_mode", () => "none", {}),
    };

    createEffect(() => {
        document.documentElement.classList.toggle("dark", res.color_scheme.value() === "dark");
    });

    return res;
});

render(() => <ShowBool when={getSettings().author_pfp.value() === "off"}>
    <style>{".cfg-reddit-pfp {display: none;}"}</style>
</ShowBool>, el("div").adto(document.head));

export function getSettings(): Settings { // TODO getClient: (): ThreadClient =}
    return global_settings;
}

const [screenWidth, setScreenWidth] = createSignal(window.innerWidth);
window.addEventListener("resize", () => {
    setScreenWidth(window.innerWidth);
});
export {screenWidth};

// https://windicss.org/utilities/variants.html
export const screen_size = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    xl2: 1536,
} as const;

type Classes = string | Classes[];
export function classes(...items: Classes[]): string {
    return items.flat().join(" ");
}

export function Icon(props: {
    size: string,
    icon: {
        label: string,
        class: string,
    },
}): JSX.Element {
    return <div class="block">
        <div class="w-22px h-22px flex items-center justify-center">
            <i class={props.icon.class + " " + props.size} aria-label={props.icon.label} />
        </div>
    </div>;
}

export function DefaultErrorBoundary(props: {data: unknown, children: JSX.Element}): JSX.Element {
    const [showContent, setShowContent] = createSignal(true);
    return <ErrorBoundary fallback={(err: unknown, reset) => {
        console.log(err);
        return <div>
            <pre><code textContent={err instanceof Error ? (
                err.toString() + "\n\n" + err.stack ?? "*no stack*"
            ) : "Something went wrong"} /></pre>
            <button
                class={link_styles_v["outlined-button"]}
                on:click={() => console.log(err, props.data)}
            >Code</button>{" / "}
            <button
                class={link_styles_v["outlined-button"]}
                on:click={() => {
                    setShowContent(false);
                    setTimeout(() => setShowContent(true), 200);
                    reset();
                }}
            >Retry</button>
        </div>;
    }}>
        <ShowBool when={showContent()} fallback={
            <>Retrying...</>
        }>
            {props.children}
        </ShowBool>
    </ErrorBoundary>;
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