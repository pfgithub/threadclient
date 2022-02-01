import { createReaction } from "solid-js";
import { createStore, reconcile } from "solid-js/store";

export function createMergeMemo<T>(getValue: () => T, opts: {key: string | null, merge: boolean}): {data: T} {
    const [value, setValue] = createStore<{data: T | null}>({data: null});

    const track = createReaction(() => {
        track(() => setValue(reconcile<{data: T}>({data: getValue()}, {
            merge: opts.merge,
            key: opts.key,
        })));
    });
    
    track(() => {
        setValue(reconcile<{data: T}>({data: getValue()}));
    });

    // using createReaction/track in order to make sure the effect is guarenteed
    // to happen before the function returns.

    // with createEffect, the effect will be run for the first time after component
    // mount, which we don't want.

    return value as {data: T};
}