import type * as Generic from "api-types-generic";
import { Accessor, createMemo, createSignal, JSX, onCleanup } from "solid-js";
import type { ThreadClient } from "threadclient-client-base";
import { ShowBool, ShowCond } from "tmeta-util-solid";
import { 
    CounterState, fetchClient, getPointsText, link_styles_v,
    WatchableCounterState, watchCounterState,
} from "../app";
import { colorClass } from "./color";
import Icon from "./Icon";

export function getCounterState(
    counter: Accessor<Generic.CounterAction>,
): [state: Accessor<CounterState>, setState: (news: CounterState) => void] {
    const [res, setRes] = createSignal<CounterState>(null as unknown as CounterState);
    let wcs!: WatchableCounterState;
    createMemo(() => {
        const hscv = watchCounterState(counter().client_id + "_" + counter().unique_id, {
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
    if('error' in counter.actions) {
        await new Promise(r => setTimeout(r, 500));
        throw new Error("counter is error: "+counter.actions.error);
    }
    const action_v = counter.actions[direction ?? "reset"];
    if(action_v == null) throw new Error("action "+direction+" requested when it is not available.");
    await client.act!(action_v);
}

export async function actAuto(
    direction: "increment" | "decrement" | undefined,
    state: CounterState,
    setState: (s: CounterState) => void,
    counter: Generic.CounterAction,
): Promise<void> {
    setState({...state, loading: true, your_vote: direction});
    try {
        const client = await fetchClient(counter.client_id);
        if(!client) throw new Error("missing client");
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

    return <span>
        <button
            disabled={state().loading}
            class={link_styles_v[state().your_vote === "increment" ? "action-button-active" : "action-button"]}
            onclick={() => {
                void actAuto(
                    state().your_vote === "increment" ? undefined : "increment",
                    state(),
                    setState,
                    props.counter,
                );
            }}
        >⯅ <CounterCount counter={props.counter} /></button>
        <ShowBool when={props.counter.decrement != null}>
            <button
                disabled={state().loading}
                class={link_styles_v[state().your_vote === "decrement" ? "action-button-active" : "action-button"]}
                onclick={() => {
                    void actAuto(
                        state().your_vote === "decrement" ? undefined : "decrement",
                        state(),
                        setState,
                        props.counter,
                    );
                }}
            >⯆</button>
        </ShowBool>
    </span>;
}

export function VerticalIconButton(props: {
    counter: Generic.CounterAction,
    mode: "increment" | "decrement",
}): JSX.Element {
    const [state, setState] = getCounterState(() => props.counter);

    const pressed = () => state().your_vote === props.mode;

    return <button
        style={{
            'font-size': "15px",
            'width': "15px",
            'height': "15px",
        }}
        class={
            colorClass(pressed() ? props.counter[props.mode]!.color : null)
        }
        disabled={state().loading}
        aria-pressed={pressed()}
        onclick={() => {
            void actAuto(
                pressed() ? undefined : props.mode,
                state(),
                setState,
                props.counter,
            );
        }}
    >
        <Icon
            icon={pressed()
            ? props.counter[props.mode]!.icon
            : props.counter.neutral_icon
            ?? props.counter[props.mode]!.icon}
            label={props.counter[props.mode]![pressed() ? "undo_label" : "label"]}
            bold={pressed()}
        />
    </button>;
}

export function VerticalIconCounter(props: {counter: Generic.CounterAction}): JSX.Element {
    return <div class={"flex flex-col items-center gap-2px"}>
        <VerticalIconButton counter={props.counter} mode="increment" />
        <ShowBool when={props.counter.decrement != null}>
            <VerticalIconButton counter={props.counter} mode="decrement" />
        </ShowBool>
    </div>;
}