import { createEffect, createSignal, JSX, onCleanup } from "solid-js";
import {HideshowProvider, ClientProvider, getClient, getIsVisible} from "./utils_solid";
import { render } from "solid-js/web";
import { hideshow, HideShowCleanup } from "../app";
import type { ThreadClient } from "../clients/base";

export function vanillaToSolidBoundary<U, T extends (props: U) => JSX.Element>(
    client: ThreadClient, frame: HTMLElement, SolidNode: T, props: U,
): HideShowCleanup<undefined> {
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
}

export function SolidToVanillaBoundary(props: {
    getValue: (hsc: HideShowCleanup<undefined>,
    client: () => ThreadClient) => HTMLElement,
}): JSX.Element {
    const client = getClient();
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