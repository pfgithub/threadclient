import { createSignal, JSX, createMemo, createContext, useContext } from "solid-js";
import {hideshow, HideShowCleanup} from "../app";
import { render } from "solid-js/web";
import { ThreadClient } from "../clients/base";

export const vanillaToSolidBoundary = <U, T extends (props: U) => JSX.Element>(
    client: ThreadClient, frame: HTMLElement, SolidNode: T, props: U,
): HideShowCleanup<undefined> => {
    const hsc = hideshow();

    const cleanup = render(() => {
        const [cvisible, setCvisible] = createSignal(hsc.visible);
        hsc.on("hide", () => setCvisible(false));
        hsc.on("show", () => setCvisible(true));

        return <HideshowProvider visible={cvisible}>
            <ClientProvider client={client}>
                <SolidNode {...props} />
            </ClientProvider>
        </HideshowProvider>;
    }, frame);
    hsc.on("cleanup", () => cleanup());

    return hsc;
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