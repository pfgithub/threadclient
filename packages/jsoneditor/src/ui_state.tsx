// ui state holds state that is local to your client but should be persisted
// state is placed in a holder with an AnNode key
// createUIState<Type>(node, initial)

import { createSignal, JSX, Signal } from "solid-js";
import { AnNode } from "./app_data";

// ok here's a question
// when I undo, should I undo the ui state too? so that you can see what's being undone
// maybe
//
// ok yeah we'll do that

export type ComptimeKey = `-${string}`; // should probably start with "-" for at least
// 100 years or so, idk

export function createUIState<T>(node: AnNode<unknown>, id: ComptimeKey, default_value: T): Signal<T> {
    return createSignal(default_value);
}

export function UIStateSplit(props: {key: ComptimeKey, children: JSX.Element}): JSX.Element {
    return <>{props.children}</>;
}