import { createEffect, createSignal, JSX, onCleanup } from "solid-js";
import { render } from "solid-js/web";
import { hideshow, HideShowCleanup } from "../app";
import { ColorDepthContext, getIsVisible, HideshowProvider } from "./utils_solid";

export function vanillaToSolidBoundary(
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
            <ColorDepthContext.Provider value={{i: opts.color_level}}>
                {solidNode()}
            </ColorDepthContext.Provider>
        </HideshowProvider>;
    }, frame);
    hsc.on("cleanup", () => cleanup());

    return hsc;
}

export function SolidToVanillaBoundary(props: {
    getValue: (
        hsc: HideShowCleanup<undefined>,
    ) => HTMLElement,
}): JSX.Element {
    const visible = getIsVisible();
    return <span ref={(div) => {
        createEffect(() => {
            const hsc = hideshow();
            const body = props.getValue(hsc).adto(div);
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