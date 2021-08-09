import { createMemo, createSignal, JSX, onCleanup } from "solid-js";
import type * as Generic from "../types/generic";
import { CounterState, getPointsText, watchCounterState } from "../app";

export function CounterCount(props: {counter: Generic.CounterAction}): JSX.Element {
    const [res, setRes] = createSignal<CounterState>(null as unknown as CounterState);
    createMemo(() => {
        const hscv = watchCounterState(props.counter.unique_id, {
            count: props.counter.count_excl_you,
            you: props.counter.you,
            time: props.counter.time
        });
        onCleanup(() => {
            hscv.cleanup();
        });

        const {state, onupdate} = hscv.associated_data;
        setRes({...state});
        onupdate(() => setRes({...state}));

        return 0;
    })();
    const ptTxt = () => {
        return getPointsText(res());
    };
    return <span title={ptTxt().raw}>{ptTxt().text} {"point" + "s"}</span>;
    // TODO make that "points" text customizable
    // eg in mastodon this would be for a star
    // counter thing
}