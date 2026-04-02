import * as Generic from "api-types-generic";
import { createMemo, JSX, onCleanup } from "solid-js";
import { Show } from "tmeta-util-solid";
import { LoadStateError } from "../util/Page2ContentManager";
import { getSettings, getWholePageRootContext } from "../util/utils_solid";
import DevCodeButton from "./DevCodeButton";
import { intersectionObserverObserve } from "./intersection_observer";
import ReadLink from "./ReadLink";

export default function OneLoader<T>(props: {
    loader: Generic.BaseLoader & {key: Generic.Link<T>},
    label: string,
    children: (value: T) => JSX.Element,
}): JSX.Element {
    return <ReadLink link={props.loader.key} fallback={
        <UnfilledLoader loader={props.loader} label={props.label} />
    }>{props.children}</ReadLink>;
}
export function UnfilledLoader(props: {
    loader: Generic.BaseLoader,
    label: string,
}): JSX.Element {
    const hprc = getWholePageRootContext();
    const settings = getSettings();
    const loadState = createMemo(() => hprc.content.viewLoadStatus(props.loader));

    return <div ref={self => {
        if (props.loader.autoload && settings.dev.allowAutoload() === "on") {
            const unregister = intersectionObserverObserve(self, upds => {
                if (upds.isIntersecting) {
                    unregister();
                    hprc.content.load(props.loader);
                }
            });
            onCleanup(() => unregister());
        }
    }}>
        <button
            class="text-blue-500 hover:underline"
            disabled={loadState().kind === "progress"}
            onClick={() => hprc.content.load(props.loader)}
        >{
            loadState().kind === "progress"
            ? "Loading…"
            : (loadState().kind === "error" ? "Retry Load" : props.label)
            + (props.loader.load_count != null ? " ("+props.loader.load_count+")" : "")
        }</button><DevCodeButton data={props} /><Show if={loadState().kind === "error"}>{(
            <p class="text-red-600 dark:text-red-500">
                Error loading; {(loadState() as LoadStateError).msg ?? "?"}
            </p>
        )}</Show>
    </div>;
}