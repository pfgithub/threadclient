import { createContext, createMemo, createSignal, JSX, untrack, useContext } from "solid-js";
import {render} from "solid-js/web";
import { ThreadClient } from "../clients/base";

export type Include<T, U> = T extends U ? T : never;

export function kindIs<K extends string, T extends {kind: string}>(value: T, key: K): Include<T, {kind: K}> | null {
    return value.kind === key ? value as unknown as null : null;
}

type MatchFn<T, Key> = (value: Include<T, {kind: Key}>) => JSX.Element;
export function SwitchKind<T extends {kind: string}>(props: {
    item: T,
    children: {[Key in T["kind"]]: MatchFn<T, Key>},
}): JSX.Element {
    // <Switch children={/*@once*/} />
    return createMemo(() => {
        const match = props.children[props.item.kind as T["kind"]] as MatchFn<T, T["kind"]> | undefined;
        if(!match) throw new Error("condition "+props.item.kind+" was not handled");
        const arg = props.item as Include<T, {kind: T["kind"]}>;
        return untrack(() => match(arg)); // untrack in order to treat the function as a widget (dependencies accessed don't cause this to reexec)
    });
}

// TODO disable this rule in _solid.tsx files
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
    when: T | undefined | null,
    fallback?: JSX.Element,
    children: (item: T) => JSX.Element,
}): JSX.Element {
    return createMemo(() => {
        if (props.when != null) {
            const child = props.children;
            return untrack(() => child(props.when!));
        }
        return props.fallback;
    });
}

type ComputeProperty<T> = {
    value: () => T,
    compute: {
        base: () => T,
        override: () => T | undefined,
        setOverride(value: T | undefined): void,
    },
};
type ColorScheme = "light" | "dark";
type AuthorPfp = "on" | "off";
type Settings = {
    color_scheme: ComputeProperty<ColorScheme>,
    author_pfp: ComputeProperty<AuthorPfp>,
};

type SchemeInfo = [scheme: "light" | "dark" | "system", system: boolean];
declare function getColorScheme(): SchemeInfo;
declare function onColorSchemeChange(cb: (...info: SchemeInfo) => void): () => void;
declare function setColorScheme(ncs: "light" | "dark" | "system"): void;
const global_settings = ((): Settings => {
    const color_scheme = ((): ComputeProperty<ColorScheme> => {
        const initial = getColorScheme();

        const getBase = ([, initial_system]: SchemeInfo): ColorScheme => {
            return initial_system ? "dark" : "light";
        };
        const getOverride = ([initial_scheme]: SchemeInfo): ColorScheme | undefined => {
            return initial_scheme === "system" ? undefined : initial_scheme;
        };

        const [base, internalSetBase] = createSignal(getBase(initial));
        const [override, internalSetOverride] = createSignal(getOverride(initial));
        const value = () => override() ?? base();

        onColorSchemeChange(() => {
            const updated = getColorScheme();
            internalSetBase(getBase(updated));
            internalSetOverride(getOverride(updated));
        });

        return {
            value,
            compute: {
                base,
                override,
                setOverride: (v) => setColorScheme(v ?? "system"),
            },
        };
    })();
    const author_pfp = ((): ComputeProperty<AuthorPfp> => {
        const getOverride = (): AuthorPfp | undefined => {
            const res = localStorage.getItem("pfp-cfg") as "on" | "off" | undefined;
            if(res === "on") return "on";
            if(res === "off") return "off";
            return undefined;
        };

        const base = (): AuthorPfp => "on";
        const [override, internalSetOverride] = createSignal(getOverride());

        window.addEventListener("storage", () => {
            internalSetOverride(getOverride());
        });

        const value = () => override() ?? base();

        return {
            value,
            compute: {
                base,
                override,
                setOverride: (newv) => {
                    const lsres: "on" | "off" | undefined = newv;
                    if(lsres == null) {
                        localStorage.removeItem("pfp-cfg");
                    }else{
                        localStorage.setItem("pfp-cfg", lsres);
                    }
                    internalSetOverride(getOverride());
                },
            },
        };
    })();

    return {
        color_scheme,
        author_pfp,
    };
})();

render(() => <ShowBool when={getSettings().author_pfp.value() === "off"}>
    <style>{".cfg-reddit-pfp {display: none;}"}</style>
</ShowBool>, el("div").adto(document.head));

export function getSettings(): Settings { // TODO getClient: (): ThreadClient =}
    return global_settings;
}