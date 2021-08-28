import { batch, createSignal, JSX } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { ShowBool, ShowCond } from "tmeta-util-solid";
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
    const [tested, setTested] = createSignal(false);

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
        <div class="h-full flex flex-col flex-wrap items-center justify-center bg-gray-100">
            <svg
                class="animate-spin mr-1 h-5 w-5 text-black inline-block align-middle"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
            >
                <title>Loading…</title>
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path
                    class="opacity-75"
                    fill="currentColor"
                    d={"M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 "
                    +"5.824 3 7.938l3-2.647z"}
                ></path>
            </svg>
        </div>
    }>{content => (
        <ShowBool when={tested()} fallback={
            <button
                class="w-full h-full flex flex-col flex-wrap items-center justify-center bg-gray-100"
            onClick={() => {
                const source = audio_ctx.createBufferSource();
                source.buffer = content.audio;
                source.connect(audio_ctx.destination);
                source.start(0, 0, 1);
                setTested(true);
                source.addEventListener("ended", () => {
                    setTested(true);
                });
            }}>
                <span
                    class="border px-4 py-2 shadow-md bg-white transform hover:scale-110 hover:shadow-lg transition"
                >Start</span>
            </button>
        }>
            <AnimatorStateHolder config={content.config} audio={content.audio} ctx={audio_ctx} />
        </ShowBool>
    )}</ShowCond>;
}

console.log("hmr reload");