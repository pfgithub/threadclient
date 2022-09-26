import * as Generic from "api-types-generic";
import { batch, createSignal, JSX } from "solid-js";
import { Show } from "tmeta-util-solid";
import { fetchClient } from "../clients";
import { getWholePageRootContext } from "../util/utils_solid";
import { addAction } from "./action_tracker";
import DevCodeButton from "./DevCodeButton";
import { ReadLink } from "./page2";

export default function OneLoader<T>(props: {
    loader: Generic.OneLoader<T>,
    children: (value: T) => JSX.Element,
}): JSX.Element {
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal<null | string>(null);
    const hprc = getWholePageRootContext();

    const doLoad = () => {
        if(loading()) return;
        setLoading(true);

        const loader = props.loader;

        const pgin = hprc.pgin();

        // TODO: make sure there are never two loaders with the same request loading at once
        addAction(
            (async () => {
                if(error() != null) await new Promise(r => setTimeout(r, 200));

                const request = Generic.readLink(hprc.content(), loader.request);
                if(request == null) throw new Error("e-request-null: "+loader.request.toString());
                if(request.error != null) throw new Error(request.error);
                const client = await fetchClient(loader.client_id);
                return await client!.loader!(request.value);
            })(),
        ).then(r => {
            batch(() => {
                setLoading(false);
                setError(null);
                console.log("adding content", r.content, props.loader);
                hprc.addContent(pgin, r.content);
            });
        }).catch((e: Error) => {
            console.log("Error loading; ", e);
            batch(() => {
                setLoading(false);
                setError(e.toString());
            });
        });
    };

    return <ReadLink link={props.loader.key} fallback={
        <div>
            <button
                class="text-blue-500 hover:underline"
                disabled={loading()}
                onClick={doLoad}
            >{
                loading()
                ? "Loading…"
                : (error() != null ? "Retry Load" : "Load Header")
            }</button><DevCodeButton data={props} /><Show when={error()}>{err => (
                <p class="text-red-600 dark:text-red-500">
                    Error loading; {err}
                </p>
            )}</Show>
        </div>
    }>{props.children}</ReadLink>;
}