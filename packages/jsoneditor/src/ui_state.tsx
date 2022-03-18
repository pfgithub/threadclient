// ui state holds state that is local to your client but should be persisted
// state is placed in a holder with an AnNode key
// createUIState<Type>(node, initial)

import { createContext, createSignal, JSX, Signal, untrack, useContext } from "solid-js";
import { AnNodeData, anPath } from "./app_data";

// ok here's a question
// when I undo, should I undo the ui state too? so that you can see what's being undone
// maybe
//
// ok yeah we'll do that

export type ComptimeKey = `-${string}`; // should probably start with "-" for at least
// 100 years or so, idk

const ui_state = new Map<string, Signal<unknown>>();

function getOrSet<A, B>(map: Map<A, B>, key: A, value: () => B): B {
    if(map.has(key)) return map.get(key)!;
    const val = value();
    map.set(key, val);
    return val;
}

export function UIState<T>(props: {
    key: ComptimeKey, // [!] not reactive
    node: AnNodeData<unknown>, // [!] not reactive
    defaultValue: () => T,
    children: (signal: Signal<T>) => JSX.Element,
} | {
    key: ComptimeKey,
    children: JSX.Element,
}): JSX.Element {
    const parent = useContext(split_provider);

    if('defaultValue' in props) {
        const path = [...parent?.splits ?? [], props.key, anPath(props.node)];
        const pathstr = JSON.stringify(path);
        const state = getOrSet(ui_state, pathstr, (): Signal<unknown> => {
            return createSignal(props.defaultValue()) as Signal<unknown>;
        }) as Signal<T>;

        return <split_provider.Provider value={{
            splits: [...parent?.splits ?? [], props.key],
        }}>
            {untrack(() => props.children(state))}
        </split_provider.Provider>;
    }else{
        return <split_provider.Provider value={{
            splits: [...parent?.splits ?? [], props.key],
        }}>
            {props.children}
        </split_provider.Provider>;
    }
}

type SplitState = {
    splits: ComptimeKey[],
};
const split_provider = createContext<SplitState>();

if(import.meta.hot) {
    import.meta.hot.accept((new_module) => {
        alert("cannot reload editor_data.tsx, please refresh page.");
    });
}