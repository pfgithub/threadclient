import { createContext, createMemo, JSX, untrack, useContext } from "solid-js";
import { ThreadClient } from "../clients/base";

export type Include<T, U> = T extends U ? T : never;

export function kindIs<K extends string, T extends {kind: string}>(value: T, key: K): Include<T, {kind: K}> | null {
    return value.kind === key ? value as unknown as null : null;
}

type MatchFn<T, Key> = (value: Include<T, {kind: Key}>) => JSX.Element;
export const SwitchKind = <T extends {kind: string}>(props: {item: T, children: {[Key in T["kind"]]: MatchFn<T, Key>}}): JSX.Element => {
    // <Switch children={/*@once*/} />
    return createMemo(() => {
        const match = props.children[props.item.kind as T["kind"]] as MatchFn<T, T["kind"]> | undefined;
        if(!match) throw new Error("condition "+props.item.kind+" was not handled");
        const arg = props.item as Include<T, {kind: T["kind"]}>;
        return untrack(() => match(arg)); // untrack in order to treat the function as a widget (dependencies accessed don't cause this to reexec)
    });
};

// TODO disable this rule in _solid.tsx files
// eslint-disable-next-line @typescript-eslint/naming-convention
const ClientContext = createContext<{client: ThreadClient}>();
export const ClientProvider = (props: {client: ThreadClient, children: JSX.Element}): JSX.Element => {
    return <ClientContext.Provider value={{client: props.client}}>{props.children}</ClientContext.Provider>;
};
export const getClient = (): (() => ThreadClient) => { // TODO getClient: (): ThreadClient => {}
    const client = useContext(ClientContext);
    if(!client) throw new Error("A client is required to render this component");
    return createMemo(() => client.client); // turns out you can't update provider values? weird
};

// eslint-disable-next-line @typescript-eslint/naming-convention
const HideshowContext = createContext<{visible: () => boolean}>();

export const HideshowProvider = (props: {visible: () => boolean, children: JSX.Element}): JSX.Element => {
    const parent_state = useContext(HideshowContext);
    const selfVisible = createMemo(() => {
        const parent_v = parent_state?.visible() ?? true;
        const props_v = props.visible();
        return parent_v ? props_v : false;
    });
    return <HideshowContext.Provider value={{visible: selfVisible}}>{props.children}</HideshowContext.Provider>;
};

export const getIsVisible = (): (() => boolean) => {
    const visible_state = useContext(HideshowContext);
    return visible_state?.visible ?? (() => true);
};

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