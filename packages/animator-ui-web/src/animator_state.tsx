import { JSX } from "solid-js";
import { createStore } from "solid-js/store";
import Animator from "./animator";
import { Action, initialState, State, updateState } from "./apply_action";

export default function AnimatorState(): JSX.Element {
    const [state, setState] = createStore<State>({
        actions: [],
        cached_state: initialState(),
        transform: new DOMRectReadOnly(),
        update_time: 0,

        frame: 0,
    });

    const applyAction = (action: Action) => {
        updateState(state, setState, action);
    };
    // @ts-expect-error
    window.applyAction = applyAction;

    return <Animator state={state} applyAction={applyAction} />;
}

console.log("hmr reload");