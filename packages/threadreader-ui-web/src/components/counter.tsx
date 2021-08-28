import type * as Generic from "api-types-generic";
import { Accessor, createMemo, createSignal, JSX, onCleanup } from "solid-js";
import type { ThreadClient } from "threadreader-client-base";
import { ShowBool, ShowCond } from "tmeta-util-solid";
import { CounterState, getPointsText, link_styles_v, WatchableCounterState, watchCounterState } from "../app";
import { getClient } from "../util/utils_solid";

export function getCounterState(
    counter: Accessor<Generic.CounterAction>,
): [state: Accessor<CounterState>, setState: (news: CounterState) => void] {
    const [res, setRes] = createSignal<CounterState>(null as unknown as CounterState);
    let wcs!: WatchableCounterState;
    createMemo(() => {
        const hscv = watchCounterState(counter().unique_id, {
            count: counter().count_excl_you,
            you: counter().you,
            time: counter().time
        });
        onCleanup(() => {
            hscv.cleanup();
        });

        const {state, onupdate} = hscv.associated_data;
        wcs = hscv.associated_data;
        setRes({...state});
        onupdate(() => setRes({...state}));

        return 0;
    })();

    return [res, (new_state) => {
        Object.assign(wcs.state, new_state);
        wcs.emit();
    }];
}

export function CounterCount(props: {counter: Generic.CounterAction}): JSX.Element {
    const [state] = getCounterState(() => props.counter);
    const ptTxt = () => {
        return getPointsText(state());
    };
    return <>
        <span title={ptTxt().raw}>{ptTxt().text} {"point" + "s"}</span>
        <ShowCond when={props.counter.percent}>{percent => (
            " " + percent.toLocaleString(undefined, {style: "percent"}) + " upvoted"
        )}</ShowCond>
    </>;
    // TODO make that "points" text customizable
    // eg in mastodon this would be for a star
    // counter thing
}

export async function act(
    direction: "increment" | "decrement" | undefined,
    client: ThreadClient,
    counter: Generic.CounterAction,
): Promise<void> {
    if('error' in counter.actions) throw new Error("counter is error: "+counter.actions.error);
    const action_v = counter.actions[direction ?? "reset"];
    if(action_v == null) throw new Error("action "+direction+" requested when it is not available.");
    await client.act!(action_v);
}

export async function actAuto(
    direction: "increment" | "decrement" | undefined,
    client: ThreadClient,
    state: CounterState,
    setState: (s: CounterState) => void,
    counter: Generic.CounterAction,
): Promise<void> {
    setState({...state, loading: true, your_vote: direction});
    try {
        await act(direction, client, counter);
        setState({...state, loading: false, your_vote: direction});
    }catch(e) {
        setState({...state});
        console.log(e);
        alert("Error while voting: "+e); // TODO send notification
    }
}

export function Counter(props: {counter: Generic.CounterAction}): JSX.Element {
    const [state, setState] = getCounterState(() => props.counter);
    const client = getClient();

    return <span>
        <button
            disabled={state().loading}
            class={link_styles_v[state().your_vote === "increment" ? "action-button-active" : "action-button"]}
            onclick={() => {
                void actAuto(
                    state().your_vote === "increment" ? undefined : "increment",
                    client(),
                    state(),
                    setState,
                    props.counter,
                );
            }}
        >⯅ <CounterCount counter={props.counter} /></button>
        <ShowBool when={props.counter.decremented_label != null}>
            <button
                disabled={state().loading}
                class={link_styles_v[state().your_vote === "decrement" ? "action-button-active" : "action-button"]}
                onclick={() => {
                    void actAuto(
                        state().your_vote === "decrement" ? undefined : "decrement",
                        client(),
                        state(),
                        setState,
                        props.counter,
                    );
                }}
            >⯆</button>
        </ShowBool>
    </span>;
}

export function VerticalIconCounter(props: {counter: Generic.CounterAction}): JSX.Element {
    const [state, setState] = getCounterState(() => props.counter);
    const client = getClient();

    return <div class={"flex flex-col items-center gap-2px"}>
        <button
            class="reddit-vote-button reddit-upvote-button"
            classList={{"vote-icon-voted": state().your_vote === "increment"}}
            disabled={state().loading}
            aria-label="Vote Up"
            aria-pressed={state().your_vote === "increment"}
            onclick={() => {
                void actAuto(
                    state().your_vote === "increment" ? undefined : "increment",
                    client(),
                    state(),
                    setState,
                    props.counter,
                );
            }}
        >
            <span>⯅ Vote</span>
        </button>
        <button
            class="reddit-vote-button reddit-downvote-button"
            classList={{"vote-icon-voted": state().your_vote === "decrement"}}
            disabled={state().loading}
            aria-label="Vote Down"
            aria-pressed={state().your_vote === "decrement"}
            onclick={() => {
                void actAuto(
                    state().your_vote === "decrement" ? undefined : "decrement",
                    client(),
                    state(),
                    setState,
                    props.counter,
                );
            }}
        >
            <span>⯆</span>
        </button>
    </div>;
}