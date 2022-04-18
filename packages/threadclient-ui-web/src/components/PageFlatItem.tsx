import {
    batch, createEffect, createSignal,
    For,
    JSX
} from "solid-js";
import { Show, SwitchKind } from "tmeta-util-solid";
import { getClientCached } from "../app";
import {
    classes, DefaultErrorBoundary, getWholePageRootContext, size_lt, ToggleColor
} from "../util/utils_solid";
import { addAction } from "./action_tracker";
import { CollapseButton } from "./CollapseButton";
import { CollapseData, FlatItem, getCState } from "./flatten";
import { ClientContentAny } from "./page2";
import SwipeActions from "./SwipeActions";
import swipeActionSet from "./SwipeActionSet";

const rainbow = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-green-500",
    "bg-blue-500",
    "bg-purple-500",
];
function getRainbow(n: number): string {
    // this should be @mod not @rem
    // doesn't matter though, n should never be less than 0
    return rainbow[n % rainbow.length]!;
}

export default function PageFlatItem(props: {item: FlatItem, collapse_data: CollapseData}): JSX.Element {
    return <DefaultErrorBoundary data={props.item}>
        <PageFlatItemNoError item={props.item} collapse_data={props.collapse_data} />
    </DefaultErrorBoundary>;
}
function PageFlatItemNoError(props: {item: FlatItem, collapse_data: CollapseData}): JSX.Element {
    return <SwitchKind item={props.item}>{{
        // TODO: remove wrapper_start and wrapper_end and instead make these properties of loader_or_post
        // TODO: improve how gaps are made. make gaps automatically between posts for example. margin
        // should not be used to make gaps.
        wrapper_start: () => <ToggleColor>{color => <div class={""
            + " " + color
            + " h-2 sm:rounded-t-xl mt-4"
        } />}</ToggleColor>,
        wrapper_end: () => <ToggleColor>{color => <div class={""
            + " " + color
            + " h-2 sm:rounded-b-xl mb-4"
        } />}</ToggleColor>,
        post: loader_or_post => <SwipeActions
            {...(() => {
                // const getActions = useActions(() => props.content, () => props.opts);
                // TODO: only show available actions
                // TODO: use the onclick handlers provided there
                // - not implementing this yet because I'm not sure how getActions should return
                //   which actions should go in the swipe bar. also we will have to either update swipeactionset
                //   to a usetypesafechildren thing or we have to explicitly put `get left_stop()` `get icon()` …
                //   and make sure to memoize so it's not updating when something irrelevant changes
                return swipeActionSet({
                    left_stop: {
                        icon: "bookmark",
                        color: "green",
                        onActivate: () => {
                            alert("TODO");
                        },
                    },
                    right_stop: {
                        icon: "chevron_up",
                        color: "blue",
                        onActivate: () => {
                            if(!loader_or_post.collapse) return alert("TODO e;not-collapsible");
                            const cs = getCState(props.collapse_data, loader_or_post.collapse.id);
                            cs.setCollapsed(v => !v);
                        },
                    },
                });
            })()}
        ><ToggleColor>{color => <div
            class={"px-2 "+color+" "+(loader_or_post.is_pivot ? "@@IS_PIVOT@@" : "")}
        >
            <div class="flex flex-row gap-1">
                <Show if={!size_lt.sm()} fallback={(
                    <Show if={loader_or_post.indent.length > 0}><div
                        style={{
                            'margin-left': ((loader_or_post.indent.length - 3) * 0.25)+"rem",
                        }}
                        class={classes(
                            "w-1",
                            "mr-1",
                            "pl-0.5",
                            !loader_or_post.first_in_wrapper ? "pt-2" : "",
                        )}
                    >
                        <div class={classes(
                            "w-full h-full",
                            getRainbow(loader_or_post.depth - 1),
                            "rounded-md",
                        )}></div>
                    </div></Show>
                )}>
                    <For each={loader_or_post.indent}>{indent => <>
                        <CollapseButton
                            collapsed_raw={false}
                            collapsed_anim={false}
                            onClick={() => {
                                const cs = getCState(props.collapse_data, indent.id);
                                cs.setCollapsed(v => !v);
                            }}
                            real={false}
                            cstates={props.collapse_data}
                            threaded={indent.threaded}
                            id={indent.id}
                        />
                    </>}</For>
                </Show>
                <div
                    class={"flex-1 "+(size_lt.sm() && loader_or_post.threaded ? "threaded-new threaded-new-ltsm" : "")}
                ><Show if={!loader_or_post.first_in_wrapper}>
                    <div class="pt-2" />
                </Show><SwitchKind item={loader_or_post.content}>{{
                    post: post => <>
                        <ClientContentAny
                            content={post.content}
                            opts={{
                                clickable: false, // TODO
                                frame: post,
                                client_id: post.client_id,
                                replies: post.replies,
                                at_or_above_pivot: loader_or_post.at_or_above_pivot,
                                is_pivot: loader_or_post.is_pivot,
                                collapse_data: props.collapse_data,
                                id: loader_or_post.id,
                            }}
                        />
                    </>,
                    loader: loader => {
                        const [loading, setLoading] = createSignal(false);
                        const [error, setError] = createSignal<null | string>(null);
                        const hprc = getWholePageRootContext();

                        const doLoad = () => {
                            if(loading()) return;
                            setLoading(true);

                            const pgin = hprc.pgin();
                            
                            addAction(
                                (async () => {
                                    if(error() != null) await new Promise(r => setTimeout(r, 200));
                                    return await getClientCached(loader.client_id)!.loader!(
                                        loader_or_post.id,
                                        loader,
                                    );
                                })(),
                            ).then(r => {
                                batch(() => {
                                    setLoading(false);
                                    setError(null);
                                    console.log("adding content", r.content, loader_or_post);
                                    hprc.addContent(pgin, r.content);
                                });
                            }).catch((e: Error) => {
                                console.log("Error loading; ", e);
                                batch(() => {
                                    setLoading(false);
                                    setError(e.toString());
                                });
                            });
                        };

                        return <div class="py-1"><button
                            class="text-blue-500 hover:underline"
                            disabled={loading()}
                            onClick={doLoad}
                            ref={btn => {
                                if(loader.autoload) {
                                    const observer = new IntersectionObserver(doLoad, {
                                        root: document.body,
                                        rootMargin: "0px",
                                        threshold: 1.0,
                                    });
                                    observer.observe(btn);
                                    createEffect(() => {
                                        if(loading()) observer.unobserve(btn);
                                    });
                                }
                            }}
                        >{
                            loading()
                            ? "Loading…"
                            : (error() != null ? "Retry Load" : "Load More")
                            + (loader.load_count != null ? " ("+loader.load_count+")" : "")
                        }</button><Show when={error()}>{err => (
                            <p class="text-red-600 dark:text-red-500">
                                Error loading; {err}
                            </p>
                        )}</Show></div>;
                    },
                }}</SwitchKind></div>
            </div>
        </div>}</ToggleColor></SwipeActions>,
        horizontal_line: () => <hr
            class="my-2 border-t-2"
            style={{'border-top-color': "var(--collapse-line-color)"}}
        />,
        todo: todo => <div>TODO: {todo.note} <button onclick={() => console.log(todo.data)}>code</button></div>,
        error: error => <div class="text-red-500">
            Error: {error.note} <button onclick={() => console.log(error.data)}>code</button>
        </div>,
    }}</SwitchKind>;
}