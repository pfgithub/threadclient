import type * as Generic from "api-types-generic";
import {
    Accessor, createContext, createEffect, createMemo,
    createRoot, createSignal, ErrorBoundary, JSX, onCleanup, useContext
} from "solid-js";
import { render } from "solid-js/web";
import { localStorageSignal, Show } from "tmeta-util-solid";
import { link_styles_v, MutablePage2HistoryNode } from "../app";

export { localStorageSignal };
export { screenWidth };

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ColorDepthContext = createContext<{i: number}>();

export const bg_colors = [
    "bg-slate-100 dark:bg-zinc-800",
    "bg-slate-300 dark:bg-zinc-900",
] as const;
export function ToggleColor(props: {children: (color: string, i: number) => JSX.Element}): JSX.Element {
    const parent_color = useContext(ColorDepthContext);
    const this_color = parent_color?.i ?? 0;
    const next_color = this_color + 1;
    return <ColorDepthContext.Provider value={{i: next_color}}>
        {props.children(bg_colors[this_color % bg_colors.length]!, this_color)}
    </ColorDepthContext.Provider>;
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

export type PageRootContext = {
    pgin: () => MutablePage2HistoryNode,
    content: () => Generic.Page2Content,
    addContent: (node: MutablePage2HistoryNode, content: Generic.Page2Content) => void,
};
// eslint-disable-next-line @typescript-eslint/naming-convention
const PageRootContext = createContext<PageRootContext>();

export function PageRootProvider(props: {
    pgin: MutablePage2HistoryNode,
    addContent: (node: MutablePage2HistoryNode, content: Generic.Page2Content) => void,
    // refocus: (focus: Generic.Link<Generic.Post>) => void, // this should be a navigation
    // event thing
    children: JSX.Element,
}): JSX.Element {
    return <PageRootContext.Provider value={{
        pgin: () => props.pgin,
        content: () => props.pgin.page.content,
        addContent: props.addContent,
    }}>{props.children}</PageRootContext.Provider>;
}

export function getPageRootContext(): () => Generic.Page2Content {
    const page_root_context = useContext(PageRootContext);
    if(!page_root_context) throw new Error("no page root context here.");
    return page_root_context.content;
}
export function getWholePageRootContextOpt(): undefined | PageRootContext {
    return useContext(PageRootContext);
}
export function getWholePageRootContext(): PageRootContext {
    const page_root_context = getWholePageRootContextOpt();
    if(!page_root_context) throw new Error("no page root context here.");
    return page_root_context;
}

type ComputePropertyFn<T> = (() => T);
type ComputePropertyOpts<T> = {
    base: () => T,
    override: () => T | undefined,
    setOverride(value: T | undefined): void,
};
export type ComputeProperty<T> = ComputePropertyFn<T> & ComputePropertyOpts<T>;
export type ColorScheme = "light" | "dark";
export type AuthorPfp = "on" | "off";
export type UpdateNotifications = "on" | "off";
export type CustomVideoControls = "browser" | "custom";
export type PageVersion = "1" | "2";
export type LinkHelpers = "show" | "hide";
export type DeveloperMode = "on" | "off";
export type GalleryDisplay = "fullscreen" | "inline";
export type Motion = "full" | "reduce";
export type AnimationDevMode = "none" | "shift_slow";
export type LinkTarget = "new_tab" | "same_tab";
export type Changelog = "show" | "hide";
export type Settings = {
    colorScheme: ComputeProperty<ColorScheme>,
    authorPfp: ComputeProperty<AuthorPfp>,
    updateNotifications: ComputeProperty<UpdateNotifications>,
    customVideoControls: ComputeProperty<CustomVideoControls>,
    pageVersion: ComputeProperty<PageVersion>,
    linkHelpers: ComputeProperty<LinkHelpers>,
    galleryDisplay: ComputeProperty<GalleryDisplay>,
    motion: ComputeProperty<Motion>,
    animationTime: ComputeProperty<number>,
    animationDevMode: ComputeProperty<AnimationDevMode>,
    signature: ComputeProperty<string>,
    links: ComputeProperty<LinkTarget>,
    changelog: ComputeProperty<Changelog>,

    dev: {
        showLogButtons: ComputeProperty<"on" | "off">,
        highlightUpdates: ComputeProperty<"on" | "off">,
        mockRequests: ComputeProperty<string | null>,
    },
};

type SerializerDeserializer<T> = {
    serialize(v: T): string,
    deserialize(v: string | undefined): T | undefined,
};

function localStorageProperty<
    T, Serializer extends (T extends string | null ? Partial<SerializerDeserializer<T>> : SerializerDeserializer<T>),
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

    const fn: ComputePropertyFn<T> = () => override() ?? accessBase();
    const opts: ComputePropertyOpts<T> = {
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
    };
    return Object.assign(fn, opts);
}

export function signalFromMatchMedia<True, False>(
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
        colorScheme: localStorageProperty("color-scheme",
            signalFromMatchMedia("(prefers-color-scheme: dark)", "dark", "light"),
        {}),
        authorPfp: localStorageProperty("pfp-cfg", () => "on", {}),
        updateNotifications: localStorageProperty("update_notices", () => "on", {}),
        customVideoControls: localStorageProperty("custom_video_controls", () => "browser", {}),
        pageVersion: localStorageProperty("page_version", () => "1", {}),
        linkHelpers: localStorageProperty("link_helpers",
            signalFromMatchMedia("(pointer: coarse)", "show", "hide"), {},
        ),
        galleryDisplay: localStorageProperty("gallery_display", () => "fullscreen", {}),
        motion: localStorageProperty("motion",
            signalFromMatchMedia("(prefers-reduced-motion: reduce)", "reduce", "full"),
        {}), // can do a hacky * {transition-duration: 0s !important} if I want to
        animationTime: localStorageProperty("animation_time", () => 0.2, {
            serialize: (value) => JSON.stringify(value),
            deserialize: (str) => str != null && str !== "" ? JSON.parse(str) as number : undefined,
        }),
        animationDevMode: localStorageProperty("animation_dev_mode", () => "none", {}),
        signature: localStorageProperty("signature", () => "", {}),
        links: localStorageProperty("links", () => "new_tab", {}),
        changelog: localStorageProperty("changelog", () => "show", {}),

        dev: {
            showLogButtons: localStorageProperty("dev.show-log-buttons", () => "off", {}),
            highlightUpdates: localStorageProperty("dev.highlight-updates", () => "off", {}),
            mockRequests: localStorageProperty("--use-mock", () => null, {}),
        },
    };

    const isDarkMode = createMemo(() => res.colorScheme() === "dark");
    // vv this is fun but it lags too much (transitions the colors of every element when changing to dark mode)
    // createEffect(on([isDarkMode], () => {
    //     // on a scale of 1 to 10, how bad of an idea is this?
    //     const styltxt = `* {
    //         transition: 0.2s all !important;
    //     }`;
    //     const stylel = el("style").atxt(styltxt).adto(document.head);
    //     setTimeout(() => stylel.remove(), 400);
    // }, {defer: true}));
    createEffect(() => {
        const styltxt = `* {
            transition: none !important;
        }`;
        const stylel = el("style").atxt(styltxt).adto(document.head);
        document.documentElement.classList.toggle("dark", isDarkMode());
        document.documentElement.offsetHeight;
        stylel.remove();
    });

    const canHover = signalFromMatchMedia("(hover: hover)", true, false);
    createEffect(() => {
        document.documentElement.classList.toggle("atmedia-hover-hover", canHover());
    });

    return res;
});

render(() => <Show if={getSettings().authorPfp() === "off"}>
    <style>{".cfg-reddit-pfp {display: none;}"}</style>
</Show>, el("div").adto(document.head));

export function getSettings(): Settings { // TODO getClient: (): ThreadClient =}
    return global_settings;
}

// [!] consider exporting different stops rather than the screen width
// so we don't have thousands of items listening to resize, just items listening
// to the stops they care about
const [screenWidth, setScreenWidth] = createSignal(window.innerWidth);
window.addEventListener("resize", () => {
    setScreenWidth(window.innerWidth);
});

// https://windicss.org/utilities/variants.html
export const size_lt = createRoot((dispose) => {
    // dispose this if the module is reloaded or something

    return {
        sm: createMemo(() => screenWidth() < 640),
        // md: 768,
        lg: createMemo(() => screenWidth() < 1024),
        // xl: 1280,
        // xl2: 1536,
    } as const;
});

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
                onclick={() => console.log(err, props.data)}
            >Code</button>{" / "}
            <button
                class={link_styles_v["outlined-button"]}
                onclick={() => {
                    setShowContent(false);
                    setTimeout(() => setShowContent(true), 200);
                    reset();
                }}
            >Retry</button>
        </div>;
    }}>
        <Show if={showContent()} fallback={
            <>Retrying...</>
        }>
            {props.children}
        </Show>
    </ErrorBoundary>;
}

if(import.meta.hot) {
    import.meta.hot.accept(() => {
        alert("cannot reload utils_solid.tsx, please refresh page.");
    });
}