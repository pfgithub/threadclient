import {
    createUserWithEmailAndPassword, getAuth, onAuthStateChanged,
    signInWithEmailAndPassword, signOut
} from "firebase/auth";
import {
    get,
    getDatabase,
    onValue, push, Query, ref, serverTimestamp, set
} from "firebase/database";
import * as stor from "firebase/storage";
import { batch, createSignal, For, JSX, onCleanup } from "solid-js";
import { createStore, reconcile, Store } from "solid-js/store";
import { allowedToAcceptClick, ShowBool, ShowCond, SwitchKind, TimeAgo } from "tmeta-util-solid";
import { kindIs, switchKind } from "../../tmeta-util/src/util";
import Animator from "./animator";
import {
    Action, applyActionsToState, CachedState,
    ContentAction, initialState, NameLink, State
} from "./apply_action";
import { DefaultErrorBoundary } from "./error_boundary";
import { Actions, Config, Project, ProjectListEntry, User } from "./generated/security-rules";

type ConnectScreenDefaultPage = {
    kind: "main",
};
type ConnectScreenPage = {
    kind: "email_account",
} | {
    kind: "sample_projects",
} | {
    kind: "animator_loader",
    project_id: string,
} | {
    kind: "animator",
    state: State,
    applyAction: (action: Action) => void,
} | {
    kind: "create_project",
};
type PushPage = (page: ConnectScreenPage) => void;
type ReplacePage = (page: ConnectScreenPage) => void;
type PopPage = () => void;

function Label(props: {
    text: JSX.Element,
    children: JSX.Element,
}): JSX.Element {
    return <label>
        <div class="text-sm text-gray-800">{props.text}:</div>
        {props.children}
    </label>;
}
function Input(props: {
    disabled: boolean,
    type: "text" | "email" | "password",
    value: string,
    label: string,
    placeholder?: undefined | string,
    setValue: (v: string) => void,
    onenter: () => void,
}): JSX.Element {
    return <div>
        <Label text={
            props.label
        }>
            <input
                type={props.type}
                class={
                    "border px-3 py-2 block w-full "
                    + (props.disabled
                    ? "text-gray-700 bg-gray-100 cursor-not-allowed"
                    : "")
                }
                disabled={props.disabled}
                placeholder={props.placeholder}
                value={props.value}
                onInput={e => {
                    props.setValue(e.currentTarget.value);
                }}
                onKeyDown={e => {
                    if(e.code === "Enter") {
                        if(!props.disabled) {
                            e.preventDefault();
                            props.onenter();
                        }
                    }
                }}
            />
        </Label>
    </div>;
}

function FormTitle(props: {children: JSX.Element}): JSX.Element {
    return <>
        <div role="heading" class="text-3xl font-black">{props.children}</div>
        <hr />
    </>;
}

/*
    <p class="text-sm text-gray-700">
        <ShowCond when={null} fallback={<>
            Note: In demo mode, your work will not be saved.
        </>}>{emsg => <span class="text-red-600">
            Error! {emsg}
        </span>}</ShowCond>
    </p>
*/

function EmailAccount(props: {pushPage: PushPage, popPage: PopPage, loading: boolean}): JSX.Element {
    const [email, setEmail] = createSignal("");
    const [password, setPassword] = createSignal("");
    const [selfLoading, setSelfLoading] = createSignal<false | "create_account" | "log_in">(false);
    const [error, setError] = createSignal<string | undefined>(undefined);
    const loading = () => props.loading || selfLoading() !== false;

    const auth = getAuth();
    const db = getDatabase();

    async function addUserData(uid: string): Promise<void> {
        const user_content: User = {
            created: serverTimestamp() as unknown as number,
            projects: {},
        };
        const user_info = ref(db, "/users/"+uid);

        // note: subject to race conditions. occasionally, a user may have to try to log in twice
        // to succeed.
        const prev_data = await get(user_info);
        if(prev_data.val() != null) return;
        await set(user_info, user_content);
    }
    function handlePromise(promise: Promise<void>): void {
        promise.then(() => {
            props.popPage();
        }).catch((e: Error) => {
            setSelfLoading(false);
            console.log(e);
            setError("" + e.toString());
        });
    }

    return <>
        <BackButton popPage={props.popPage} />
        <FormTitle>Email Account</FormTitle>
        <div class="pb-4"></div>
        <Input
            type="email"
            label={"Email"}
            placeholder={"name@example.com"}
            disabled={loading()}
            value={email()}
            setValue={setEmail}
            onenter={() => {/**/}}
        />
        <div class="pb-2"></div>
        <Input
            type="password"
            label={"Password"}
            disabled={loading()}
            value={password()}
            setValue={setPassword}
            onenter={() => {/**/}}
        />
        <div class="pb-4"></div>
        <div class="flex flex-row flex-wrap gap-4 <sm:flex-col">
            <FormButton
                style="gray"
                class={"flex-1"}
                disabled={loading()}
                onClick={() => {
                    setSelfLoading("create_account");
                    handlePromise((async () => {
                        const signed_in = await createUserWithEmailAndPassword(auth, email(), password());
                        await addUserData(signed_in.user.uid);
                    })());
                }}
            >
                <ShowBool when={selfLoading() === "create_account"} fallback={
                    <>Create Account</>
                }>
                    <Loader />
                </ShowBool>
            </FormButton>
            <FormButton style="green" class={
                "sm:min-w-max sm:w-30"
            } disabled={loading()} onClick={() => {
                setSelfLoading("log_in");
                handlePromise((async () => {
                    const signed_in = await signInWithEmailAndPassword(auth, email(), password());
                    await addUserData(signed_in.user.uid);
                })());
            }}>
                <ShowBool when={selfLoading() === "log_in"} fallback={
                    <>Log In</>
                }>
                    <Loader />
                </ShowBool>
            </FormButton>
        </div>
        <ShowCond when={error()}>{emsg => <>
            <div class="pb-2"></div>
            <p class="text-sm text-gray-700">
                <span class="text-red-600">
                    Error! {emsg}
                </span>
            </p>
        </>}</ShowCond>
    </>;
}

function uniqueId(): string {
    // hack
    const db = getDatabase();
    return push(ref(db, "/_")).key!;
}

function CreateProjectPage(props: {replacePage: ReplacePage, popPage: PopPage}): JSX.Element {
    const [loading, setLoading] = createSignal<false | "create_project">(false);

    const [name, setName] = createSignal("");
    const [files, setFiles] = createSignal<FileList | null>(null);
    const [fpsRaw, setFps] = createSignal("");
    const [sizeRaw, setSize] = createSignal("");

    const db = getDatabase();
    const account = getAuth();
    const storage = stor.getStorage();
    const new_post_ref = push(ref(db, "/projects"));
    const project_id = new_post_ref.key!;
    const new_post_user_ref = ref(db, "/users/"+account.currentUser!.uid+"/projects/"+project_id);
    const file_ref_unnamed = stor.ref(storage,
        "/user/" + account.currentUser!.uid + "/" + uniqueId(),
    );

    const fps = () => +fpsRaw();
    const size = (): [w: number, h: number] => {
        const ssplit = sizeRaw().split("x");
        if(ssplit.length !== 2) return [0, 0];
        return [+ssplit[0]!, +ssplit[1]!];
    };

    const errors = (): string[] => {
        const res: string[] = [];

        if(!name().trim()) res.push("Name required");
        if(!files()) {
            res.push("Audio required");
        }else if(files()!.length !== 1) {
            res.push("Max one audio file");
        }else if(!files()!.item(0)!.name.endsWith(".mp3")) {
            res.push("Audio file must be .mp3");
        }
        if(!fps()) res.push("FPS required");
        if(size().some(itm => !itm)) res.push("Size required");

        return res;
    };

    return <>
        <BackButton popPage={props.popPage} />
        <FormTitle>Create Project</FormTitle>
        <div class="pb-4"></div>
        <Input
            type="text"
            label={"Project Name"}
            disabled={loading() !== false}
            value={name()}
            setValue={setName}
            onenter={() => {/**/}}
        />
        <div class="pb-2"></div>
        <Label text={"Audio"}>
            <input
                type="file"
                onInput={e => {
                    setFiles(e.currentTarget.files);
                }}
                disabled={loading() !== false}
            />
        </Label>
        <div class="pb-2"></div>
        <Input
            type="text"
            label={"Frames per Second"}
            placeholder={"15"}
            disabled={loading() !== false}
            value={fpsRaw()}
            setValue={setFps}
            onenter={() => {/**/}}
        />
        <div class="pb-2"></div>
        <Input
            type="text"
            label={"Size"}
            placeholder={"1920x1080"}
            disabled={loading() !== false}
            value={sizeRaw()}
            setValue={setSize}
            onenter={() => {/**/}}
        />
        <div class="pb-4"></div>
        <FormButton
            class="w-full"
            style="green"
            disabled={errors().length !== 0 || loading() === "create_project"}
            onClick={() => {
                if(errors().length !== 0) return alert("unresolved errors");
                setLoading("create_project");
                const audio_file = files()!.item(0)!;
                (async () => {
                    // note: generates a different id every time you retry a submit
                    const file_ref = stor.ref(file_ref_unnamed, "/"+audio_file.name);
                    const uploaded = await stor.uploadBytes(file_ref, await audio_file.arrayBuffer());
                    console.log(uploaded.metadata.fullPath);

                    const project: Project = {
                        created: serverTimestamp() as unknown as number,
                        owner: account.currentUser!.uid,
                        config: {
                            title: name(),
                            audio: uploaded.metadata.fullPath,
                            framerate: fps(),
                            width: size()[0],
                            height: size()[1],
                        },
                    };
                    const user_project: ProjectListEntry = {
                        updated: serverTimestamp() as unknown as number,
                    };
                    console.log("creating project", project);
                    await set(new_post_ref, project);
                    await set(new_post_user_ref, user_project);


                })().then(r => {
                    setLoading(false);
                    props.replacePage({
                        kind: "animator_loader",
                        project_id,
                    });
                }).catch((e: Error) => {
                    setLoading(false);
                    console.log(e);
                    alert("error creating project: "+e.toString());
                });
            }}
        >
            <ShowBool when={loading() !== "create_project"} fallback={
                <Loader />
            }>
                Create Project
            </ShowBool>
        </FormButton>
        <ul class="text-red-600">
            <For each={errors()}>{error => <li>{error}</li>}</For>
        </ul>
    </>;
}

function FormButton(props: {
    class?: undefined | string,
    disabled?: undefined | boolean,
    style: "gray" | "green",
    onClick: () => void,
    children: JSX.Element,
}): JSX.Element {
    return <button class={
        "border px-4 py-2 block "+props.class+" "
        + ({
            gray: () => "transition " + (props.disabled ?? false
                ? "text-gray-700 bg-gray-100 cursor-not-allowed"
                : "bg-gray-200 hover:shadow-md hover:bg-white"
            ),
            green: () => (props.disabled ?? false
                ? "text-gray-700 bg-gray-100 cursor-not-allowed"
                : "border-green-400 bg-gradient-to-r from-green-400 to-green-500 text-white "
                + "font-bold hover:shadow-md"
            ),
        } as const)[props.style]()
    } onclick={() => props.onClick()}>
        {props.children}
    </button>;
}

function BackButton(props: {popPage: PopPage}): JSX.Element {
    return <button onClick={() => {
        props.popPage();
    }} class={
        "text-blue-600 bg-blue-100 hover:bg-blue-200 transition px-1"
    }>{"< Back"}</button>;
}

function ProjectList(props: {pushPage: PushPage}): JSX.Element {
    const db = getDatabase();
    const account = getAuth();
    const projects_ref = ref(db, "/users/"+account.currentUser!.uid);
    // TODO query(ref+"/projects", orderByChild("updated"), limitToFirst(100))

    const [projects] = createDbWatch<User>(projects_ref);

    // TODO use a suspense so it doesn't show until all the subprojects load rather
    // than doing a messy thing.

    return <>
        <FormButton class="w-full" style="gray" onClick={() => {
            props.pushPage({kind: "create_project"});
        }}>+ Create Project</FormButton>
        <div class="pb-4" />
        <SwitchKind item={projects}>{{
            loading: () => <Loader />,
            error: (emsg) => <p class="text-sm text-gray-700">
                <span class="text-red-600">
                    Error! {emsg.message}
                </span>
            </p>,
            loaded: (user_info) => <div class="flex flex-col gap-2">
                <For each={Object.entries(user_info.value.projects ?? {})} fallback={
                    <p class="text-sm text-gray-700">
                        You don't have any projects.
                    </p>
                }>{(project) => <ProjectListItem pushPage={props.pushPage} project={project} />}</For>
            </div>,
        }}</SwitchKind>
    </>;
}

function ProjectListItem(props: {pushPage: PushPage, project: [string, ProjectListEntry]}): JSX.Element {
    const db = getDatabase();
    const project_ref = ref(db, "/projects/"+props.project[0]);

    const [project] = createDbWatch<Project>(project_ref);

    const onclick = () => {
        props.pushPage({kind: "animator_loader", project_id: props.project[0]});
    };

    return <SwitchKind item={project}>{{
        loading: () => <Loader />,
        error: (err) => <p class="text-sm text-red-600">
            Error: {err.message}
        </p>,
        loaded: (loaded) => <div
            class={
                "bg-gray-100 border p-4 focus:bg-white focus:shadow-md cursor-pointer "
                +"hover:bg-white hover:shadow-md outline-default transition handles-clicks"
            }
            tabindex="0"
            onClick={(e) => {
                if(!allowedToAcceptClick(e.target, e.currentTarget)) return;
                onclick();
            }}
            onKeyDown={e => {
                if(e.key === "Enter") {
                    if(!allowedToAcceptClick(e.target, e.currentTarget)) return;
                    onclick();
                }
            }}
        >
            <div>{loaded.value.config.title}</div>
            <div class="text-sm font-light">Updated <TimeAgo start={props.project[1].updated} /></div>
        </div>
    }}</SwitchKind>;
}

function MainPage(props: {pushPage: PushPage, popPage: PopPage}): JSX.Element {
    const auth = getAuth();
    const [loading, setLoading] = createSignal<false | "account" | "log_out">("account");
    const disabled = () => loading() !== false;
    const [currentUser, setCurrentUser] = createSignal(auth.currentUser);
    const [error, setError] = createSignal<string | undefined>();
    const destroy = onAuthStateChanged(auth, user => {
        setLoading(false);
        console.log("auth_state_changed", user);
        setCurrentUser(user);
    });
    onCleanup(() => destroy());

    // TODO: support saving work in demo mode
    // display a button somewhere that lets users create an account and save their data to that account
    // and warn before closing that "animation is not saved"
    // or, even better: support saving in demo mode, but just to the local device. have a button somewhere
    // to create an account and upload the data.

    return <ShowBool when={loading() !== "account"} fallback={
        <div class="flex flex-row justify-center">
            <Loader />
        </div>
    }>
        <ShowCond when={currentUser()} fallback={<>
            <FormTitle>Animator</FormTitle>
            <div class="pb-4" />
            <FormButton disabled={disabled()} class="w-full" style="gray" onClick={() => {
                props.pushPage({kind: "email_account"});
            }}>
                Email Account
            </FormButton>
            <div class="pb-1" />
            <p class="text-sm text-gray-700">
                Note: Saving animations has not yet been implemented. Your animations will not be saved.
            </p>
            <div class="pb-4" />
            <FormButton disabled={disabled()} class="w-full" style="gray" onClick={() => {
                props.pushPage({kind: "sample_projects"});
            }}>
                Demo Mode
            </FormButton>
            <div class="pb-1" />
            <p class="text-sm text-gray-700">Note: In demo mode, you cannot save your animations.</p>
        </>}>{user => <>
            <div>You are signed in as {user.uid}</div>
            <div class="pb-4" />
            <ProjectList pushPage={props.pushPage} />
            <div class="pb-4" />
            <FormButton disabled={disabled()} class="w-full" style="gray" onClick={() => {
                setLoading("log_out");
                signOut(auth).then(() => {
                    setLoading(false);
                }).catch((e: Error) => {
                    setLoading(false);
                    setError("" + e.toString());
                });
            }}>
                <ShowBool when={loading() !== "log_out"} fallback={<Loader />}>
                    Log Out
                </ShowBool>
            </FormButton>            
        </>}</ShowCond>
        <ShowCond when={error()}>{emsg => <>
            <div class="pb-2"></div>
            <p class="text-sm text-gray-700">
                <span class="text-red-600">
                    Error! {emsg}
                </span>
            </p>
        </>}</ShowCond>
    </ShowBool>;
}

function ConnectScreen(props: {_?: undefined}): JSX.Element {
    // this can be upgraded to a real url-based router in the future

    const [pages, setPages] = createSignal<ConnectScreenPage[]>([]);
    const page = (): (ConnectScreenPage | ConnectScreenDefaultPage) => {
        const items = pages();
        return items[items.length - 1] ?? {
            kind: "main",
        };
    };
    const pushPage = (new_page: ConnectScreenPage) => {
        setPages(p => [...p, new_page]);
    };
    const popPage = () => {
        setPages(p => p.slice(0, p.length - 1));
    };
    const replacePage = (new_page: ConnectScreenPage) => {
        setPages(p => [...p.slice(0, p.length - 1), new_page]);
    };

    // TODO:
    // use suspenses so when you click a button, if the page it navigates to requires loading,
    // display the loading inline in the button and disable everything until the page has loaded.
    // if the page load results in an error, navigate to an error page.

    return <ShowCond when={kindIs(page(), "animator")} fallback={
        <FullscreenCenter horizontal><div class="w-full max-w-md py-50">
            <div class="p-4 shadow-md bg-white border">
                <SwitchKind item={page()}>{{
                    main: () => <MainPage pushPage={pushPage} popPage={popPage} />,
                    create_project: () => <CreateProjectPage replacePage={replacePage} popPage={popPage} />,
                    email_account: () => <EmailAccount pushPage={pushPage} popPage={popPage} loading={false} />,
                    animator_loader: (al) => <AnimatorLoaderPage
                        replacePage={replacePage}
                        popPage={popPage}
                        project_id={al.project_id}
                    />,
                    sample_projects: () => <SampleProjectsPage popPage={popPage} pushPage={replacePage} />,
                    animator: () => {throw new Error("never.")},
                }}</SwitchKind>
            </div>
        </div></FullscreenCenter>
    }>{animator => <DefaultErrorBoundary data={animator.state}>
        <InitializeAudio state={animator.state}>
            <Animator state={animator.state} applyAction={animator.applyAction} />
        </InitializeAudio>
    </DefaultErrorBoundary>}</ShowCond>;
}

type DemoConfig = Config & {
    attribution: {
        author: NameLink,
        title: NameLink,
        license: NameLink,
    },
};

function SampleProjectsPage(props: {popPage: PopPage, pushPage: PushPage}): JSX.Element {
    const [demoPicker, setDemoPicker] = createSignal<{
        kind: "loading",
    } | {
        kind: "ready",
        demos: {config: DemoConfig, name: string}[],
    } | {
        kind: "error",
        message: string,
    }>({kind: "loading"});

    let page_still_open = true;
    onCleanup(() => page_still_open = false);

    const sample_projects = "/sample-projects";
    function loadSampleProject(project: {config: Config, name: string}) {
        setDemoPicker({kind: "loading"});
        (async () => {
            const [actions, audio_mp3] = await Promise.all([
                fetch(sample_projects + "/" + project.name + "/actions.json")
                .then(r => r.json()) as Promise<{actions: ContentAction[]}>,
                fetch(sample_projects + "/" + project.name + "/audio.mp3").then(r => r.arrayBuffer()),
            ]);
            const mp3 = await audio_ctx.decodeAudioData(audio_mp3);

            if(page_still_open) {
                props.pushPage({
                    kind: "animator",
                    ...initWithAudio(mp3, project.config, actions.actions),
                });
            }
        })().catch((e: Error) => {
            batch(() => {
                setDemoPicker({kind: "error", message: "Failed to load demo project. Message: "+e.toString()});
            });
        });
    }

    (async () => {
        const sample_list = await fetch(sample_projects + "/list.json").then(r => r.json()) as string[];

        const project_configs = await Promise.all(sample_list.map(async proj => {
            const config = await fetch(sample_projects + "/" + proj + "/config.json")
            .then(r => r.json()) as DemoConfig;
            return {config, name: proj};
        }));

        setDemoPicker({kind: "ready", demos: project_configs});
    })().catch((e: Error) => {
        batch(() => {
            setDemoPicker({kind: "error", message: "Failed to load demo mode. Message: "+e.toString()});
        });
    });

    return <>
        <BackButton popPage={props.popPage} />
        <FormTitle>Demo Projects</FormTitle>
        <div class="pb-4" />
        <SwitchKind item={demoPicker()}>{{
            loading: () => <Loader />,
            error: emsg => <p class="text-red-600">
                {emsg.message}
            </p>,
            ready: demo_projects => <>
                <p class="text-base text-red-600">
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
            </>,
        }}</SwitchKind>
    </>;
}

function initWithAudio(
    audio: AudioBuffer,
    config: Config,
    initial_actions: ContentAction[],
): {state: State, applyAction: (action: Action) => void} {
    const [actions, setActions] = createSignal<ContentAction[]>(initial_actions);
    const [cached_state, setCachedState] = createStore<CachedState>(applyActionsToState(
        initial_actions,
        initialState(),
        config,
    ));
    const [updateTime, setUpdateTime] = createSignal<number>(0);
    const [frame, setFrame] = createSignal<number>(0);

    const max_frame = Math.ceil(audio.duration * config.framerate);
    const audio_data = new Float32Array(audio.getChannelData(0));

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

        get max_frame() {return max_frame},
        get config() {return config},
        get audio() {return audio},
        audio_ctx,
        get audio_data() {return audio_data},
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
                const regenerated = applyActionsToState(new_actions, initialState(), state.config);
                setCachedState(reconcile<CachedState>(regenerated, {merge: true}));
            }else if(action.kind === "set_frame") {
                setFrame(Math.min(state.max_frame, Math.max(0, action.frame)));
            }else{
                // TODO do this on a different thread with webworkers
                setActions(v => [...v, action]);
                const applied = applyActionsToState([action], state.cached_state, state.config);
                setCachedState(reconcile<CachedState>(applied, {merge: true}));
            }
            setUpdateTime(Date.now() - start);
        });
    };

    return {state, applyAction};
}

const audio_ctx = new AudioContext();

function AnimatorLoaderPage(props: {popPage: PopPage, replacePage: ReplacePage, project_id: string}): JSX.Element {
    const db = getDatabase();
    const storage = stor.getStorage();
    
    let still_open = true;
    onCleanup(() => still_open = false);

    const [error, setError] = createSignal<null | string>();

    const [loadState, setLoadState] = createSignal<string>("Starting");

    async function fetchContent() {
        setLoadState("Fetching Project");
        const project_ref = ref(db, "/projects/"+props.project_id);
        const project_config = await get(project_ref);
        const cfg = project_config.val() as Project;
        if(!still_open) return;

        setLoadState("Fetching Audio");
        const audio_ref = stor.ref(storage, cfg.config.audio);
        const audio_url = await stor.getDownloadURL(audio_ref);
        const audio = await fetch(audio_url).then(r => r.arrayBuffer());
        if(!still_open) return;
        
        setLoadState("Fetching Actions");
        const actions_ref = ref(db, "/actions/"+props.project_id);
        // TODO use an array watcher in order to do fun stuff
        const project_actions = await get(actions_ref);
        const actions = Object.values((project_actions.val() as Actions | null) ?? {}).sort(
            (a, b) => a.created - b.created,
        ).map(act => act.value as ContentAction);
        if(!still_open) return;

        setLoadState("Initializing Audio");
        const decoded_audio = await audio_ctx.decodeAudioData(audio);
        if(!still_open) return;

        setLoadState("Starting");
        if(!still_open) return;
        props.replacePage({
            kind: "animator",
            ...initWithAudio(decoded_audio, cfg.config, actions)
        });
    }
    fetchContent().catch((e: Error) => {
        console.log(e);
        setError(e.toString());
    });

    return <>
        <BackButton popPage={props.popPage} />
        <ShowCond when={error()} fallback={<div>
            <Loader />{" "}{loadState()}…
        </div>}>{err => <>
            <p class="text-sm text-red-600">
                Error while {loadState()}: {err}
            </p>
        </>}</ShowCond>
    </>;
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

declare global {
    interface Window {
        __audio_initialized: boolean;
    }
}

function InitializeAudio(props: {children: JSX.Element, state: State}): JSX.Element {
    // for ios. it requires that the first time you play audio, it be through
    // a user-initiated event (eg button onclick but not pointermove)
    const [tested, setTested] = createSignal(window.__audio_initialized);
    const [testing, setTesting] = createSignal(false);

    return <ShowBool when={tested()} fallback={
        <button
            class="w-full h-full flex flex-col flex-wrap items-center justify-center bg-gray-100"
            disabled={testing()}
        onClick={() => {
            const source = props.state.audio_ctx.createBufferSource();
            source.buffer = props.state.audio;
            source.connect(props.state.audio_ctx.destination);
            source.start(0, 0, 0.2);
            setTesting(true);
            source.addEventListener("ended", () => {
                window.__audio_initialized = true;
                setTesting(false);
                setTested(true);
            });
        }}>
            <span
                class={
                    "border px-4 py-2 shadow-md bg-white transform hover:scale-110 hover:shadow-lg transition "
                    + "sm:min-w-max sm:w-30 "
                }
            >
                <ShowBool when={!testing()} fallback={<Loader />}>
                    Start
                </ShowBool>
            </span>
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
    return <ConnectScreen />;
}

type DbValue<T> = {kind: "loaded", value: T} | {kind: "loading"} | {kind: "error", message: string};
function createDbWatch<T>(db_ref: Query): [Store<DbValue<T>>] {
    const [state, setState] = createStore<DbValue<T>>({kind: "loading"});

    console.log("waiting for", db_ref);
    const unsub = onValue(db_ref, snapshot => {
        console.log("got value", snapshot);
        const snap_value = snapshot.val() as T;
        setState(reconcile<DbValue<T>>({kind: "loaded", value: snap_value}, {merge: true}));
    }, err => {
        console.log(err);
        setState(reconcile<DbValue<T>>({kind: "error", message: err.toString()}, {merge: true}));
    });
    onCleanup(() => unsub());

    return [state];
}

console.log("hmr reload");