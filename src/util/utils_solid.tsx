import { createContext, createMemo, JSX, useContext } from "solid-js";
import { ThreadClient } from "../clients/base";

export type Include<T, U> = T extends U ? T : never;

export function kindIs<K extends string, T extends {kind: string}>(value: T, key: K): Include<T, {kind: K}> | null {
    return value.kind === key ? value as unknown as null : null;
}

type MatchFn<T, Key> = (value: Include<T, {kind: Key}>) => JSX.Element;
export const SwitchKind = <T extends {kind: string}>(props: {item: T, children: {[Key in T["kind"]]: MatchFn<T, Key>}}): JSX.Element => {
    // <Switch children={/*@once*/} />
    return <>{createMemo(() => {
        const match = props.children[props.item.kind as T["kind"]] as MatchFn<T, T["kind"]> | undefined;
        if(!match) throw new Error("condition "+props.item.kind+" was not handled");
        return match(props.item as Include<T, {kind: T["kind"]}>);
    })}</>;
};

// TODO disable this rule in _solid.tsx files
// eslint-disable-next-line @typescript-eslint/naming-convention
const ClientContext = createContext<{client: ThreadClient}>();
export const ClientProvider = (props: {client: ThreadClient, children: JSX.Element}): JSX.Element => {
    return <ClientContext.Provider value={{client: props.client}}>{props.children}</ClientContext.Provider>;
};
export const getClient = (): (() => ThreadClient) => {
    const client = useContext(ClientContext);
    if(!client) throw new Error("A client is required to render this component");
    return createMemo(() => client.client);
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