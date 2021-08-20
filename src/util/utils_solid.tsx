import {
    Accessor, createContext, createEffect, createMemo,
    createRoot,
    createSignal, JSX, onCleanup, untrack, useContext,
} from "solid-js";
import { render } from "solid-js/web";
import type { ThreadClient } from "../clients/base";

export type Include<T, U> = T extends U ? T : never;

export function kindIs<K extends string, T extends {kind: string}>(value: T, key: K): Include<T, {kind: K}> | null {
    return value.kind === key ? value as unknown as null : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function switchKindCB<U>(item: {kind: string}, choices: {[key: string]: (item: any) => U}): () => U {
    const match = choices[item.kind] ?? choices["unsupported"] ?? (() => {
        throw new Error("condition "+match+" was not handled and no unsupported branch");
    });
    return () => match(item);
}
export function switchKind<T extends {kind: string}, U>(
    item: T,
    choices: {[Key in T["kind"]]: MatchFn<T, Key, U>},
): U {
    return switchKindCB<U>(item, choices)();
}

type MatchFn<T, Key, R> = (value: Include<T, {kind: Key}>) => R;
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
    fallback?: JSX.Element,
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
    if?: [boolean],
    when: T | undefined | null,
    fallback?: JSX.Element,
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
};

function localStorageProperty<T extends string>(ls_key: string, accessBase: Accessor<T>): ComputeProperty<T> {
    const getLocalStorageValue = (): T | undefined => {
        return (localStorage.getItem(ls_key) ?? undefined) as T | undefined;
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
                    localStorage.setItem(ls_key, value);
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
        ),
        author_pfp: localStorageProperty("pfp-cfg", () => "on"),
        update_notifications: localStorageProperty("update_notices", () => "on"),
        custom_video_controls: localStorageProperty("custom_video_controls", () => "browser"),
        page_version: localStorageProperty("page_version", () => "1"),
        link_helpers: localStorageProperty("link_helpers", () => "show"),
        cors_proxy: localStorageProperty("cors_proxy", () => "off"),
        gallery_display: localStorageProperty("gallery_display", () => "fullscreen"),
        motion: localStorageProperty("motion",
            signalFromMatchMedia("(prefers-reduced-motion: reduce)", "reduce", "full"),
        ), // can do a hacky * {transition-duration: 0s !important} if I want to
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