import { batch, createEffect, createSignal, For, JSX, onCleanup } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { allowedToAcceptClick, ShowBool, ShowCond, SwitchKind } from "tmeta-util-solid";
import { kindIs, switchKind } from "../../tmeta-util/src/util";
import Animator from "./animator";
import {
    Action, applyActionsToState, CachedState, Config,
    ContentAction, initialState, NameLink, State
} from "./apply_action";

export function WSManager(props: {
    ctx: AudioContext,
}): JSX.Element {
    const [actions, setActions] = createSignal<ContentAction[]>([]);
    const [cached_state, setCachedState] = createStore<CachedState>(initialState());
    const [updateTime, setUpdateTime] = createSignal<number>(0);
    const [frame, setFrame] = createSignal<number>(0);

    const audio_ctx = props.ctx;
    let config: Config | undefined;
    let audio: AudioBuffer | undefined;
    let max_frame: number | undefined;
    let audio_data: Float32Array | undefined;

    function initWithAudio(new_audio: AudioBuffer, new_config: Config, new_actions: ContentAction[]) {
        config = new_config;
        audio = new_audio;
        max_frame = Math.ceil(new_audio.duration * new_config.framerate);
        audio_data = new Float32Array(new_audio.getChannelData(0));
        // TODO both channels & abs & average & scale 0..peak
        setActions(new_actions);
    }

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

        get max_frame() {return max_frame!},
        get config() {return config!},
        get audio() {return audio!},
        audio_ctx,
        get audio_data() {return audio_data!},
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

    const [loadState, setLoadState] = createSignal<ConnectState | {
        kind: "ready",
    }>({kind: "none"});

    let ws: WebSocket | null = null;
    onCleanup(() => {
        if(ws) {
            ws.close();
            ws = null;
        }
    });
    const wsConnect = (url: string) => {
        // "ws://localhost:3018"
        if(ws) {
            ws.close();
            ws = null;
        }
        ws = new WebSocket(url);

        ws.addEventListener("close", e => {
            console.log(e);
            if(loadState().kind !== "error") {
                setLoadState({kind: "error", message: "Websocket Closed"});
            }
        });
        ws.addEventListener("error", e => {
            console.log(e);
            if(loadState().kind !== "error") {
                setLoadState({kind: "error", message: "Websocket Connection Failed"});
            }
        });
        const message_eater: ((message: ArrayBuffer | string) => void)[] = [];
        ws.addEventListener("message", (message: MessageEvent<Uint8Array | string>) => {
            console.log("Got websocket message", message.data);

            if(typeof message.data === "string") {
                try {
                    const parsed = JSON.parse(message.data) as {kind: "error", message: string} | {kind: "unsupported"};
                    if(parsed.kind === "error") {
                        setLoadState({kind: "error", message: "Websocket Error: "+parsed.message});
                        if(ws) {
                            ws.close();
                            ws = null;
                        }
                    }
                }catch(e) {
                    console.log(e);
                }
            }

            const eater = message_eater.shift();
            if(eater) {
                eater(message.data);
                return;
            }
        });
        ws.addEventListener("open", () => {
            console.log("WS opened");
            (async () => {
                const nextMessage = async () => {
                    return await new Promise(r => {
                        message_eater.push(r);
                    });
                };
                const config_json = await nextMessage() as string;
                const mp3_data = await nextMessage() as Blob;
                const history_json = await nextMessage() as string;
                const end_marker_json = await nextMessage() as string;

                const new_config = JSON.parse(config_json) as Config;
                const history = JSON.parse(history_json) as {actions: ContentAction[]};
                const end_marker = JSON.parse(end_marker_json) as {kind: "ready"};

                const mp3 = await audio_ctx.decodeAudioData(await mp3_data.arrayBuffer());

                if(end_marker.kind !== "ready") {
                    console.log(new_config, history, end_marker);
                    throw new Error("error initializing");
                }

                initWithAudio(mp3, new_config, history.actions);
                setLoadState({kind: "ready"});
            })().then(r => {
                //
            }).catch(e => {
                console.log(e);
                setLoadState({kind: "error", message: "Websocket Error"});
            });
        });
        //@ts-expect-error
        window.ws = ws;
    };

    return <ShowBool when={loadState().kind === "ready"} fallback={
        <ConnectScreen connect={url => {
            const should_delay = loadState().kind === "error";
            setLoadState({kind: "loading"});
            (async () => {
                if(should_delay) {
                    await new Promise(r => setTimeout(r, 300));
                }
                wsConnect(url);
            })().catch((e: Error) => {
                console.log(e);
                setLoadState({kind: "error", message: "Websocket Connection Errored. Message: "+e.toString()});
            });
        }} loadDemo={(new_audio, new_config, new_actions) => {
            initWithAudio(new_audio, new_config, new_actions);
            setLoadState({kind: "ready"});
        }} state={loadState() as ConnectState} audio_ctx={props.ctx} />
    }>
        <InitializeAudio state={state}>
            <Animator state={state} applyAction={applyAction} />
        </InitializeAudio>
    </ShowBool>;
}

type ConnectState = {
    kind: "none",
} | {
    kind: "loading",
} | {
    kind: "error",
    message: string,
};
function ConnectScreen(props: {
    connect: (url: string) => void,
    loadDemo: (audio: AudioBuffer, config: Config, actions: ContentAction[]) => void,
    state: ConnectState,
    audio_ctx: AudioContext,
}): JSX.Element {
    const [inputValue, setInputValue] = createSignal(localStorage.getItem("recent-server") ?? "");
    const specifiedURL = () => inputValue().startsWith("ws://");

    const disabled = () => props.state.kind === "loading" || demoPicker().kind === "loading";

    const [demoPicker, setDemoPicker] = createSignal<{kind: "none"} | {
        kind: "loading",
    } | {
        kind: "ready",
        demos: {config: Config, name: string}[],
    }>({kind: "none"});
    const [errorMessage, setErrorMessage] = createSignal<null | string>(null);
    createEffect(() => {
        if(props.state.kind === "error") {
            setErrorMessage(props.state.message);
        }
    });

    const sample_projects = "/sample-projects";
    function loadSampleProject(project: {config: Config, name: string}) {
        setDemoPicker({kind: "loading"});
        (async () => {
            const [actions, audio_mp3] = await Promise.all([
                fetch(sample_projects + "/" + project.name + "/actions.json")
                .then(r => r.json()) as Promise<{actions: ContentAction[]}>,
                fetch(sample_projects + "/" + project.name + "/audio.mp3").then(r => r.arrayBuffer()),
            ]);
            const mp3 = await props.audio_ctx.decodeAudioData(audio_mp3);

            props.loadDemo(mp3, project.config, actions.actions);
        })().catch((e: Error) => {
            batch(() => {
                setDemoPicker({kind: "none"});
                setErrorMessage("Failed to load demo project. Message: "+e.toString());
            });
        });
    }

    function loadDemo() {
        setDemoPicker({kind: "loading"});
        (async () => {
            const sample_list = await fetch(sample_projects + "/list.json").then(r => r.json()) as string[];

            const project_configs = await Promise.all(sample_list.map(async proj => {
                const config = await fetch(sample_projects + "/" + proj + "/config.json")
                .then(r => r.json()) as Config;
                return {config, name: proj};
            }));

            setDemoPicker({kind: "ready", demos: project_configs});
        })().catch((e: Error) => {
            batch(() => {
                setDemoPicker({kind: "none"});
                setErrorMessage("Failed to load demo mode. Message: "+e.toString());
            });
        });
    }

    function onConnect(): boolean {
        if(specifiedURL()) {
            localStorage.setItem("recent-server", inputValue());
            props.connect(inputValue());
            return true;
        }
        return false;
    }

    return <FullscreenCenter horizontal><div class="w-full max-w-md py-50">
        <div class="p-4 shadow-md bg-white border">
            <ShowCond when={kindIs(demoPicker(), "ready")} fallback={<>
                <div role="heading" class="text-3xl font-black">Connect to Server</div>
                <hr class="pb-4" />
                <div>
                    <label>
                        <div class="text-xs font-light">Server URL:</div>
                        <input type="text"
                            class={
                                "border px-3 py-2 block w-full "
                                + (disabled()
                                ? "text-gray-700 bg-gray-100 cursor-not-allowed"
                                : "")
                            }
                            disabled={disabled()}
                            placeholder={"ws://…"}
                            value={inputValue()}
                            onInput={e => {
                                setInputValue(e.currentTarget.value);
                            }}
                            onKeyDown={e => {
                                if(e.code === "Enter") {
                                    if(onConnect()) e.preventDefault();
                                }
                            }}
                        />
                    </label>
                </div>
                <div class="pb-4"></div>
                <div class="flex flex-row flex-wrap gap-4 <sm:flex-col">
                    <button
                        class={
                            "border px-4 py-2 flex-1 transition "
                            + (disabled()
                            ? "text-gray-700 bg-gray-100 cursor-not-allowed"
                            : "bg-gray-200 hover:shadow-md hover:bg-white")
                        }
                        disabled={disabled()}
                        onClick={() => {
                            // TODO allow clicking this even while state is loading
                            // props.connect(null);
                            loadDemo();
                        }}
                    >
                        <SwitchKind item={demoPicker()}>{{
                            none: () => <>Use in Demo Mode</>,
                            loading: () => <Loader />,
                            ready: () => <>You should never see this</>,
                        }}</SwitchKind>
                    </button>
                    <button class={
                        "border px-4 py-2 min-w-max w-30 "
                        + (specifiedURL() && !disabled()
                        ? "border-green-400 bg-gradient-to-r from-green-400 to-green-500 text-white "
                        + "font-bold hover:shadow-md"
                        : "text-gray-700 bg-gray-100 cursor-not-allowed")
                    } disabled={!specifiedURL() || disabled()} onClick={() => {
                        onConnect();
                    }}>
                        <SwitchKind item={props.state}>{{
                            none: () => <>Connect</>,
                            loading: () => <Loader />,
                            error: () => <>Retry</>,
                        }}</SwitchKind>
                    </button>
                </div>
                <div class="pb-2"></div>
                <p class="text-sm text-gray-700">
                    <ShowCond when={errorMessage()} fallback={<>
                        Note: In demo mode, your work will not be saved.
                    </>}>{emsg => <span class="text-red-600">
                        Error! {emsg}
                    </span>}</ShowCond>
                </p>
            </>}>{demo_projects => <>
                <button onClick={() => {
                    setDemoPicker({kind: "none"});
                }}>{"< Back"}</button>
                <div role="heading" class="text-2xl font-black">Demo Projects</div>
                <hr class="pb-4" />
                <p class="text-sm text-gray-700">
                    Your work will not be saved.
                </p>
                <div class="pb-2" />
                <ul class="flex flex-col gap-2"><For each={demo_projects.demos}>{demo => <li
                    class={
                        "bg-gray-100 border p-4 focus:bg-white focus:shadow-md cursor-pointer "
                        +"hover:bg-white hover:shadow-md outline-default transition handles-clicks"
                    }
                    tabindex="0"
                    onClick={(e) => {
                        if(!allowedToAcceptClick(e.target, e.currentTarget)) return;
                        loadSampleProject(demo);
                    }}
                    onKeyDown={e => {
                        if(e.key === "Enter") {
                            if(!allowedToAcceptClick(e.target, e.currentTarget)) return;
                        }
                    }}
                >
                    <AttributionLink attribution={demo.config.attribution.author} />
                    {" - "}
                    <AttributionLink attribution={demo.config.attribution.title} />
                    {" / "}
                    <AttributionLink attribution={demo.config.attribution.license} />
                </li>}</For></ul>
            </>}</ShowCond>
        </div>
    </div></FullscreenCenter>;
}

function AttributionLink(props: {attribution: NameLink}): JSX.Element {
    return <a
        class="underline underline-dotted hover:underline-solid"
        href={props.attribution.url}
        target="_blank"
        rel={"noopener noreferrer"}
    >
        {props.attribution.text}
    </a>;
}

function InitializeAudio(props: {children: JSX.Element, state: State}): JSX.Element {
    // for ios. it requires that the first time you play audio, it be through
    // a user-initiated event (eg button onclick but not pointermove)
    const [tested, setTested] = createSignal(false);

    return <ShowBool when={tested()} fallback={
        <button
            class="w-full h-full flex flex-col flex-wrap items-center justify-center bg-gray-100"
        onClick={() => {
            const source = props.state.audio_ctx.createBufferSource();
            source.buffer = props.state.audio;
            source.connect(props.state.audio_ctx.destination);
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
    }>{props.children}</ShowBool>;
}

function FullscreenCenter(props: {children: JSX.Element, horizontal?: undefined | boolean}): JSX.Element {
    return <div class={
        "min-h-full flex flex-col flex-wrap items-center bg-gray-100"
        + (props.horizontal === true ? "" : " justify-center")
    }>
        {props.children}
    </div>;
}

function Loader(): JSX.Element {
    return <svg
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
    </svg>;
}

export default function AnimatorState(): JSX.Element {
    const audio_ctx = new AudioContext();

    return <WSManager ctx={audio_ctx} />;
}

console.log("hmr reload");