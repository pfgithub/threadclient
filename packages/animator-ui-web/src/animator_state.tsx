import {
    createUserWithEmailAndPassword, getAuth, onAuthStateChanged,
    signInWithEmailAndPassword, signOut
} from "firebase/auth";
import {
    get,
    getDatabase,
    onChildAdded,
    onChildChanged,
    onChildRemoved,
    onValue, orderByChild, push, query, Query, ref, serverTimestamp, set
} from "firebase/database";
import * as stor from "firebase/storage";
import { batch, createSignal, For, JSX, onCleanup } from "solid-js";
import { createStore, reconcile, Store } from "solid-js/store";
import { allowedToAcceptClick, Show, SwitchKind, TimeAgo } from "tmeta-util-solid";
import { kindIs } from "../../tmeta-util/src/util";
import Animator from "./animator";
import {
    Action, applyActionsToState, CachedState,
    ContentAction, InsertedAction, initialState, NameLink, State, IdentifiedAction, DBAction
} from "./apply_action";
import { DefaultErrorBoundary } from "./error_boundary";
import { Config, Project, ProjectListEntry, User } from "./generated/security-rules";
import * as sr from "./generated/security-rules";

const session_id = (() => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return [...array].map(c => c.toString(16).padStart(2, "0")).join("");
})();

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
    cleanup: () => void,
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
                <Show if={selfLoading() === "create_account"} fallback={
                    <>Create Account</>
                }>
                    <Loader />
                </Show>
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
                <Show if={selfLoading() === "log_in"} fallback={
                    <>Log In</>
                }>
                    <Loader />
                </Show>
            </FormButton>
        </div>
        <Show when={error()}>{emsg => <>
            <div class="pb-2"></div>
            <p class="text-sm text-gray-700">
                <span class="text-red-600">
                    Error! {emsg}
                </span>
            </p>
        </>}</Show>
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
            <Show if={loading() !== "create_project"} fallback={
                <Loader />
            }>
                Create Project
            </Show>
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

    return <Show if={loading() !== "account"} fallback={
        <div class="flex flex-row justify-center">
            <Loader />
        </div>
    }>
        <Show when={currentUser()} fallback={<>
            <FormTitle>Animator</FormTitle>
            <div class="pb-4" />
            <FormButton disabled={disabled()} class="w-full" style="gray" onClick={() => {
                props.pushPage({kind: "email_account"});
            }}>
                Email Account
            </FormButton>
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
            <div class="flex flex-row flex-wrap gap-4 <sm:flex-col">
                <FormButton disabled={disabled()} class="flex-1" style="gray" onClick={() => {
                    setLoading("log_out");
                    signOut(auth).then(() => {
                        setLoading(false);
                    }).catch((e: Error) => {
                        setLoading(false);
                        setError("" + e.toString());
                    });
                }}>
                    <Show if={loading() !== "log_out"} fallback={<Loader />}>
                        Log Out
                    </Show>
                </FormButton>
                <FormButton disabled={disabled()} class="flex-1" style="gray" onClick={() => {
                    props.pushPage({kind: "sample_projects"});
                }}>
                    Demo Mode
                </FormButton>
            </div>
        </>}</Show>
        <Show when={error()}>{emsg => <>
            <div class="pb-2"></div>
            <p class="text-sm text-gray-700">
                <span class="text-red-600">
                    Error! {emsg}
                </span>
            </p>
        </>}</Show>
    </Show>;
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

    return <Show when={kindIs(page(), "animator")} fallback={
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
    }>{animator => {
        onCleanup(() => animator.cleanup());
        return <DefaultErrorBoundary data={animator.state}>
            <InitializeAudio state={animator.state}>
                <Animator state={animator.state} applyAction={animator.applyAction} />
            </InitializeAudio>
        </DefaultErrorBoundary>;
    }}</Show>;
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
                const init = initWithAudio(mp3, project.config, actions.actions.map((act, i) => {
                    return {...act, id: "" + i, session_id, insert_time: Date.now()};
                }), {
                    onAddAction: (act) => {
                        init.replaceActions(init.state.actions.length, 0, [
                            {...act, insert_time: Date.now()}
                        ]);
                    },
                });
                props.pushPage({
                    kind: "animator",
                    state: init.state,
                    applyAction: init.applyAction,
                    cleanup: () => {/**/},
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
    initial_actions: InsertedAction[],
    cbs: {
        onAddAction(action: IdentifiedAction): void,
    },
): {
    state: State,
    applyAction: (action: Action) => void,
    replaceActions: (start: number, length: number, insert: InsertedAction[]) => void,
} {
    const [actions, setActions] = createSignal<InsertedAction[]>(initial_actions);
    const [cachedState, setCachedState] = createSignal<CachedState>(applyActionsToState(
        initial_actions,

        initialState(),
        [],
        [],
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
        get cached_state() {
            return cachedState();
        },
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

    // note: this should only be called by saving fns. saving to any action other than
    // the last action is not supported.
    const replaceActions = (start: number, length: number, insert: InsertedAction[]) => {
        const start_time = Date.now();

        const prev_actions = actions();

        const prev = prev_actions.filter((__, i) => i < start);
        const next = prev_actions.filter((__, i) => i >= start + length);
        const removed = prev_actions.filter((__, i) => i >= start && i < start + length);

        const regenerated = applyActionsToState(
            [...insert, ...removed.map((removed_action): InsertedAction => {
                return {
                    id: uniqueId(),
                    session_id,
                    insert_time: Infinity, // this action doesn't actually exist
                    kind: "invalidate_action",
                    frame: removed_action.frame,
                    invalidate: {
                        id: removed_action.id,
                        time: removed_action.insert_time,
                    },
                };
            })],

            cachedState(),
            prev,
            next,
            config,
        );
        
        batch(() => {
            setActions([...prev, ...insert, ...next]);
            setCachedState(regenerated);
            const end_time = Date.now();
            setUpdateTime(end_time - start_time);
        });
    };

    let redo_stack: InsertedAction[] = [];
    
    const applyAction = (new_action: Action) => {
        batch(() => {
            if(new_action.kind === "undo") {
                // TODO only undo actions your client created this session

                const ignored_actions = new Set<string>();
                let undone: InsertedAction | undefined;
                for(const action of [...state.actions].reverse()) {
                    // reverse not being pure is fun isn't it?
                    // this bug took a very long time to track down
                    if(ignored_actions.has(action.id)) continue;
                    if(action.kind === "invalidate_action") {
                        ignored_actions.add(action.invalidate.id);
                        continue;
                    }
                    if(action.session_id !== session_id) continue;
                    undone = action;
                    break;
                }
                if(undone) {
                    redo_stack.push(undone);
                    setFrame(undone.frame);
                    cbs.onAddAction({
                        id: uniqueId(),
                        session_id,
                        kind: "invalidate_action",
                        frame: undone.frame,
                        invalidate: {
                            id: undone.id,
                            time: undone.insert_time,
                        },
                    });
                }

                // TODO keep anchors so that undos don't take forever all the time
                // TODO when regenerating, save parts of those as anchors
                // eg [1..10 +1] [10..100 +10] [100..1000 +100]
                // so like as you undo more the gaps get wider, but when you undo you can fill
                // in until the most recent anchor so it isn't redoing work over and over
            }else if(new_action.kind === "redo") {
                const item: ContentAction | undefined = redo_stack.pop();
                if(item) cbs.onAddAction({
                    ...item,
                    id: uniqueId(),
                    session_id,
                });
            }else if(new_action.kind === "set_frame") {
                setFrame(Math.min(state.max_frame, Math.max(0, new_action.frame)));
            }else{
                redo_stack = [];
                const act: ContentAction = new_action;
                const added_action: IdentifiedAction = {
                    ...act,
                    id: uniqueId(),
                    session_id,
                };
                // soo… what if…
                // shhhhh
                cbs.onAddAction(added_action);
            }
        });
    };

    (window as unknown as {animator: unknown}).animator = {state, applyAction, replaceActions};

    return {state, applyAction, replaceActions};
}

const audio_ctx = new AudioContext();

function AnimatorLoaderPage(props: {popPage: PopPage, replacePage: ReplacePage, project_id: string}): JSX.Element {
    const db = getDatabase();
    const storage = stor.getStorage();
    const auth = getAuth();
    
    let still_open = true;
    onCleanup(() => still_open = false);

    const [error, setError] = createSignal<null | string>();

    const [loadState, setLoadState] = createSignal<string>("Starting");

    // notes for how saving will work:
    // firebase gives events:
    // - child_added
    //   - this should usually fire near the end of the list so usually not that much
    //     work will have to happen. an exception to this is when working offline, when
    //     you reconnect a lot of work will have to happen. that's probably okay though.
    // - child_changed
    //   - this should never fire I think. I don't think you are allowed to edit past
    //     actions according to security rules. actually right now security rules allow
    //     editing actions. TODO change actions to read/create/delete but no update
    // - child_removed
    //   - this should generally happen near the end of the list
    // - child_moved
    //   - this will never fire due to the security rules, assuming items are being sorted
    //     by creation date as they should be. this can be safely ignored

    // anyway, essentially:
    // - go to the point in the list where the new action is / the change is
    // - reapply from that point

    // for saving data:
    // - when an action is written, save it
    // - only save one thing at a time. there is a potential for race conditions causing out
    //   of order insertions otherwise. if a thing is being saved and a new thing is added,
    //   wait until the current one is done and then add all the new ones in bulk. this is
    //   not necessary.

    // oh, here's a simple performance optimization that can be done when regenerating
    // - if you know the previous state, the nearest common ancestor, and are trying to
    //   calculate the new state, you can reuse any data from the previous state about
    //   different frames. ('any frame that is not touched in any new events can be
    //    copied directly from the previous frame')
    // - eg: actions are like [1 5 4 6 1 2 6] and you're inserting
    //                            ^ 1
    //   you can completely ignore everything that doesn't touch frame 1 and just copy them
    //   from the previous state
    // - exception could be if I ever make a copy frame event or something but I think
    //   it would be better to copy the actual shape in the frame rather than an
    //   error-prone 'copy the content of the frame at this point in time'
    
    // here's a doc on creating presence in realtime database:
    // - https://firebase.google.com/docs/firestore/solutions/presence#web
    // - just have to give other users permission to view your connection status somehow
    // - not sure
    // - oh wow 'onDisconnect' is magic. it runs even on eg losing internet.
    // - so essentially on a project you can just have a list of users who are currently
    //   active. do this with push() so multiple copies of the same user can be connected
    //   at once and not cause any issues. although supposedly their example is 'complete'
    //   even though it doesn't do that. not sure how it handles the same user being logged
    //   in twice

    // other
    // - also if I want to plan for a future that I don't need to plan for: if I want to
    //   be able to eg create new frames, reorder frames, … the idea would be that the
    //   frame order is seperate from the frame content list. this isn't the app I'm making
    //   so I shouldn't think too much about this or intentionally accomodate it in my
    //   architecture, but it's nice to know it should be possible to keep the architecture
    //   I'm currently using if I ever want to implement that in the future.

    const actions_ref = query(ref(db, "/actions/"+props.project_id), orderByChild("created"));

    const on_cleanup: (() => void)[] = [];

    async function fetchContent() {

        setLoadState("Fetching Project");
        const project_ref = ref(db, "/projects/"+props.project_id);
        const project_config = await get(project_ref);
        const cfg = project_config.val() as Project;
        if(!still_open) throw new Error("canceled");

        setLoadState("Fetching Audio");
        const audio_ref = stor.ref(storage, cfg.config.audio);
        const audio_url = await stor.getDownloadURL(audio_ref);
        const audio = await fetch(audio_url).then(r => r.arrayBuffer());
        if(!still_open) throw new Error("canceled");
        
        // setLoadState("Fetching Actions");
        // if(!still_open) return;

        setLoadState("Initializing Audio");
        const decoded_audio = await audio_ctx.decodeAudioData(audio);
        if(!still_open) throw new Error("canceled");

        setLoadState("Initializing App");
        const init = initWithAudio(decoded_audio, cfg.config, [], {
            onAddAction: (act) => {
                console.log("adding action", act);

                const new_act_ref = ref(db, "/actions/"+props.project_id+"/"+act.id);
                set(new_act_ref, {
                    created: serverTimestamp() as unknown as number,
                    author: auth.currentUser!.uid,
                    value: act,
                }).then(r => {
                    console.log("action set ✓");
                }).catch(e => {
                    console.log("failed to save action", act, e);
                    alert("error saving action");
                });
            },
        });
        if(!still_open) throw new Error("canceled");

        setLoadState("Downloading Actions");
        // const initial_actions_raw = await get(actions_ref);
        // const initial_actions = Object.entries((initial_actions_raw.val() as Actions | null) ?? {}).sort(
        //     (a, b) => a[1].created - b[1].created,
        // ).map(([id, act]) => ({id, saved: true, ...act.value as ContentAction}));
        // init.replaceActions(0, 0, initial_actions);

        let first_load = true;

        on_cleanup.push(onChildAdded(actions_ref, data => {
            if(first_load) return;

            const act = data.val() as sr.Action;
            const action = act.value as DBAction;
            console.log("\\!/ added action", act);
            // find the index where the next item .saved > act.created
            let index = init.state.actions.findIndex(next_item => (
                act.created < next_item.insert_time
            ));
            if(index === -1) index = init.state.actions.length;

            console.log("NEW ACTION ADDED AT INDEX,", index, act);

            init.replaceActions(index, 0, [{
                ...action,
                id: data.key!,
                insert_time: act.created,
            }]);
        }));
        on_cleanup.push(onChildChanged(actions_ref, data => {
            console.log("changed action", data);
        }));
        on_cleanup.push(onChildRemoved(actions_ref, data => {
            const act = data.val() as sr.Action;
            const action = act.value as DBAction;

            console.log("firebase noted action removal ", data.key!, act, "; patching local data");

            const index = init.state.actions.findIndex(item => (
                item.id === data.key!
            ));
            if(index === -1) return console.error("attempting to remove nonexistent action", data.key, action);
            init.replaceActions(index, 1, []);
        }));
        await new Promise<void>((r, re) => {
            const removeWatcher = onValue(actions_ref, (value) => {
                try {
                    removeWatcher();
                    first_load = false;

                    setLoadState("Initializing Actions");

                    const actions: InsertedAction[] = [];
                    if(value.exists()) value.forEach(item => {
                        const act = item.val() as sr.Action;
                        const action = act.value as DBAction;
                        actions.push({
                            ...action,
                            id: item.key!,
                            insert_time: act.created,
                        });
                    });
                    init.replaceActions(0, init.state.actions.length, actions);

                    r();
                }catch(e) {
                    re(e);
                }
            }, (err) => {
                removeWatcher();
                re(err);
            });
        });
        if(!still_open) throw new Error("canceled");

        setLoadState("Starting");
        if(!still_open) throw new Error("canceled");
        props.replacePage({
            kind: "animator",
            state: init.state,
            applyAction: init.applyAction,
            cleanup: () => on_cleanup.forEach(v => v()),
        });
    }
    fetchContent().catch((e: Error) => {
        console.log(e);
        setError(e.toString());
        on_cleanup.forEach(v => v());
    });

    return <>
        <BackButton popPage={props.popPage} />
        <Show when={error()} fallback={<div>
            <Loader />{" "}{loadState()}…
        </div>}>{err => <>
            <p class="text-sm text-red-600">
                Error while {loadState()}: {err}
            </p>
        </>}</Show>
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

    return <Show if={tested()} fallback={
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
                <Show if={!testing()} fallback={<Loader />}>
                    Start
                </Show>
            </span>
        </button>
    }>{props.children}</Show>;
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
        setState(reconcile({kind: "loaded", value: snap_value}, {merge: true}));
    }, err => {
        console.log(err);
        setState(reconcile({kind: "error", message: err.toString()}, {merge: true}));
    });
    onCleanup(() => unsub());

    return [state];
}

console.log("hmr reload");