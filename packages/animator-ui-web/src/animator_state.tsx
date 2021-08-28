import { batch, createSignal, JSX } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { ShowCond } from "tmeta-util-solid";
import { switchKind } from "../../tmeta-util/src/util";
import Animator from "./animator";
import {
    Action, applyActionsToState, CachedState, Config,
    ContentAction, initialState, State,
} from "./apply_action";

export function AnimatorStateHolder(props: {
    config: Config,
    audio: AudioBuffer,
    ctx: AudioContext,
}): JSX.Element {
    const [actions, setActions] = createSignal<ContentAction[]>([]);
    const [cached_state, setCachedState] = createStore<CachedState>(initialState());
    const [updateTime, setUpdateTime] = createSignal<number>(0);
    const [frame, setFrame] = createSignal<number>(0);

    const max_frame = Math.ceil(props.audio.duration * props.config.framerate);
    const config = props.config;
    const audio = props.audio;
    const audio_ctx = props.ctx;
    const audio_data = new Float32Array(props.audio.getChannelData(0));

    const state: State = {
        get actions() {
            return actions();
        },
        cached_state,
        get update_time() {
            return updateTime();
        },
        get frame() {
            return frame();
        },

        max_frame,
        config,
        audio,
        audio_ctx,
        audio_data,
    };

    const applyAction = (action: Action) => {
        batch(() => {
            const start = Date.now();
            if(action.kind === "undo") {
                const undone = state.actions[state.actions.length - 1];
                const new_actions = [...state.actions.slice(0, state.actions.length - 1)];
                setActions(new_actions);

                if(undone) {
                    switchKind(undone, {
                        add_polygon: poly => setFrame(poly.frame),
                        erase_polygon: poly => setFrame(poly.frame),
                    });
                }

                // TODO keep anchors so that undos don't take forever all the time
                // TODO when regenerating, save parts of those as anchors
                // eg [1..10 +1] [10..100 +10] [100..1000 +100]
                // so like as you undo more the gaps get wider, but when you undo you can fill
                // in until the most recent anchor so it isn't redoing work over and over
                const regenerated = applyActionsToState(new_actions, initialState());
                setCachedState(reconcile<CachedState>(regenerated, {merge: true}));
            }else if(action.kind === "set_frame") {
                setFrame(Math.min(state.max_frame, Math.max(0, action.frame)));
            }else{
                setActions(v => [...v, action]);
                const applied = applyActionsToState([action], state.cached_state);
                setCachedState(reconcile<CachedState>(applied, {merge: true}));
            }
            setUpdateTime(Date.now() - start);
        });
    };
    // @ts-expect-error
    window.applyAction = applyAction;

    return <Animator state={state} applyAction={applyAction} />;
}

export default function AnimatorState(): JSX.Element {
    const [data, setData] = createSignal<null | {config: Config, audio: AudioBuffer}>(null);

    const audio_ctx = new AudioContext();

    (async () => {
        const project = await (async () => {
            try {
                await fetch("/projects/project/config.json").then(r => r.json());
                return "/projects/project";
            }catch(e) {console.log(e)}
            return "projects/project-example";
        })();
        const config = (await fetch(project+"/config.json").then(r => r.json())) as Config;
        const audio_u8 = await fetch(project+"/"+config.audio).then(r => r.arrayBuffer());
        const audio = await audio_ctx.decodeAudioData(audio_u8);
        setData({config, audio});
    })().catch(e => {
        console.log(e);
        alert("Error loading.");
    });

    return <ShowCond when={data()} fallback={
        <div class="h-full flex flex-col flex-wrap items-center justify-center">
            Loading…
        </div>
    }>{content => (
        <AnimatorStateHolder config={content.config} audio={content.audio} ctx={audio_ctx} />
    )}</ShowCond>;
}

console.log("hmr reload");