import { createContext, createEffect, createSignal, JSX, onCleanup, useContext } from "solid-js";
import { render } from "solid-js/web";
import type { ThreadClient } from "threadclient-client-base";
import { hideshow, HideShowCleanup } from "../app";
import { ColorDepthContext, getIsVisible, HideshowProvider } from "./utils_solid";

// eslint-disable-next-line @typescript-eslint/naming-convention
const TempSVBorderClientContext = createContext<{client: ThreadClient}>();
export function ClientProvider(props: {client: ThreadClient, children: JSX.Element}): JSX.Element {
    return <TempSVBorderClientContext.Provider value={{client: props.client}}>
        {props.children}
    </TempSVBorderClientContext.Provider>;
}
export function getTempBorderClient(): ThreadClient { // TODO getClient: (): ThreadClient =}
    const client = useContext(TempSVBorderClientContext);
    if(!client) throw new Error("A client is required to render this component");
    return client.client; // turns out you can't update provider values? weird
}

export function vanillaToSolidBoundary(
    client: ThreadClient,
    frame: HTMLElement,
    solidNode: () => JSX.Element,
    opts: {color_level: number},
): HideShowCleanup<undefined> {
    const hsc = hideshow();

    const cleanup = render(() => {
        const [cvisible, setCvisible] = createSignal(hsc.visible);
        hsc.on("hide", () => setCvisible(false));
        hsc.on("show", () => setCvisible(true));

        return <HideshowProvider visible={cvisible}>
            <ClientProvider client={client}>
                <ColorDepthContext.Provider value={{i: opts.color_level}}>
                    {solidNode()}
                </ColorDepthContext.Provider>
            </ClientProvider>
        </HideshowProvider>;
    }, frame);
    hsc.on("cleanup", () => cleanup());

    return hsc;
}

export function SolidToVanillaBoundary(props: {
    getValue: (
        hsc: HideShowCleanup<undefined>,
        client: ThreadClient,
    ) => HTMLElement,
}): JSX.Element {
    const client = getTempBorderClient();
    const visible = getIsVisible();
    return <span ref={(div) => {
        createEffect(() => {
            const hsc = hideshow();
            const body = props.getValue(hsc, client).adto(div);
            createEffect(() => {
                hsc.setVisible(visible());
            });
            onCleanup(() => {
                hsc.cleanup();
                body.remove();
            });
        });
    }}></span>;
}