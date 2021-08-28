import { batch, JSX } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import Animator from "./animator";
import applyActionsToState, { Action, CachedState, initialState, State } from "./apply_action";

export default function AnimatorState(): JSX.Element {
    const [state, setState] = createStore<State>({
        actions: [],
        cached_state: initialState(),
        transform: new DOMRectReadOnly(),
        update_time: 0,
    });

    const applyAction = (action: Action) => {
        batch(() => {
            const start = Date.now();
            if(action.kind === "undo") {
                const actions = [...state.actions.slice(0, state.actions.length - 1)];
                setState("actions", actions);
                // TODO keep anchors so that undos don't take forever all the time
                const regenerated = applyActionsToState(actions, initialState());
                setState("cached_state", reconcile<CachedState>(regenerated, {merge: true}));
            }else{
                setState("actions", [...state.actions, action]);
                const applied = applyActionsToState([action], state.cached_state);
                setState("cached_state", reconcile<CachedState>(applied, {merge: true}));
            }
            setState("update_time", Date.now() - start);
        });
    };
    // @ts-expect-error
    window.applyAction = applyAction;

    return <Animator state={state} applyAction={applyAction} />;
}

console.log("hmr reload");