import * as Generic from "api-types-generic";
import {
    batch, createEffect, createSignal,
    For,
    JSX
} from "solid-js";
import { allowedToAcceptClick, Show, SwitchKind } from "tmeta-util-solid";
import { getClientCached, navigate } from "../app";
import {
    classes, DefaultErrorBoundary, getWholePageRootContext, size_lt, ToggleColor
} from "../util/utils_solid";
import { addAction } from "./action_tracker";
import { CollapseButton } from "./CollapseButton";
import { CollapseData, FlatItem, FlatPost, getCState } from "./flatten";
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
        wrapper_start: () => <div class="mt-4" />,
        wrapper_end: () => <div class="mb-4" />,
        post: loader_or_post => <PageFlatPost
            collapse_data={props.collapse_data}
            loader_or_post={loader_or_post}
        />,
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

function PostIndent(props: {
    loader_or_post: FlatPost,
    collapse_data: CollapseData,
}): JSX.Element {
    return <Show if={!size_lt.sm()} fallback={(
        <Show if={props.loader_or_post.indent.length > 0}><div
            style={{
                'margin-left': ((props.loader_or_post.indent.length - 3) * 0.25)+"rem",
            }}
            class={classes(
                "w-1",
                "mr-1",
                "pl-0.5",
                !props.loader_or_post.first_in_wrapper ? "pt-2" : "",
            )}
        >
            <div class={classes(
                "w-full h-full",
                getRainbow(props.loader_or_post.depth - 1),
                "rounded-md",
                props.loader_or_post.threaded ? "threaded-new threaded-new-ltsm" : "",
            )}></div>
        </div></Show>
    )}>
        <For each={props.loader_or_post.indent}>{indent => <>
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
    </Show>;
}

function PageFlatPost(props: {
    collapse_data: CollapseData,
    loader_or_post: FlatPost,
}): JSX.Element {
    // ok detect if clickable:
    // - post not pivot & post has url & post displayed_in repivot_list → make post
    //   clickable and inform the content that its parent is clickable already (not necessary)

    const isPivot = () => props.loader_or_post.is_pivot;
    const wholeObjectClickable = () => {
        if(isPivot()) return false;
        if(props.loader_or_post.displayed_in !== "repivot_list") return false;
        if(props.loader_or_post.content.url == null) return false;
        return true;
    };
    const hprc = getWholePageRootContext();
    const getPage = (): Generic.Page2 | undefined => {
        if(props.loader_or_post.content.disallow_pivot ?? false) return undefined;
        return {
            pivot: props.loader_or_post.id,
            content: hprc.content(),
        };
    };

    const onClick = (e: MouseEvent | KeyboardEvent) => {
        const frame = props.loader_or_post;
        const post = frame.content;

        // support ctrl click
        const target_url = "/"+post.client_id+post.url;
        if(e.ctrlKey || e.metaKey || e.altKey) {
            window.open(target_url);
        }else{
            navigate({
                path: target_url,
                page: getPage(),
            });
        }
    };

    const [hovering, setHovering] = createSignal(false);

    return <SwipeActions
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
                        if(!props.loader_or_post.collapse) return alert("TODO e;not-collapsible");
                        const cs = getCState(props.collapse_data, props.loader_or_post.collapse.id);
                        cs.setCollapsed(v => !v);
                    },
                },
            });
        })()}
    >
        <ToggleColor>{color => <div
            class={
                "px-2 "+color+" "+(props.loader_or_post.is_pivot ? "@@IS_PIVOT@@ " : "")+
                (wholeObjectClickable() ? `
                    cursor-pointer outline-default
                    hactive:bg-slate-200 hactive:bg-zinc-700
                    hactive:shadow-md
                    hactive:z-1
                    relative
                ` : "")+
                (props.loader_or_post.first_in_wrapper ? `
                    pt-2 sm:rounded-t-lg
                ` : "")+
                (props.loader_or_post.last_in_wrapper ? `
                    pb-2 sm:rounded-b-lg
                ` : "")
            }
            tabindex={wholeObjectClickable() ? 0 : -1}
            onKeyPress={e => {
                if(!wholeObjectClickable()) return;
                if(e.code !== "Enter") return;
                e.stopPropagation();

                onClick(e);
            }}
            onClick={e => {
                if(!wholeObjectClickable()) return;
                if(!allowedToAcceptClick(e.target, e.currentTarget)) return;
                e.stopPropagation();

                onClick(e);
            }}

            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
        >
            <div class="relative flex flex-row gap-1">
                <PostIndent
                    loader_or_post={props.loader_or_post}
                    collapse_data={props.collapse_data}
                />
                <div
                    class={"flex-1"}
                >
                    <Show if={!props.loader_or_post.first_in_wrapper}>
                        <div class="pt-2" />
                    </Show>
                    <PageFlatPostContent
                        loader_or_post={props.loader_or_post}
                        collapse_data={props.collapse_data}

                        hovering={hovering()}
                        whole_object_clickable={wholeObjectClickable()}
                    />
                </div>
            </div>
        </div>}</ToggleColor>
    </SwipeActions>;
}

function PageFlatPostContent(props: {
    loader_or_post: FlatPost,
    collapse_data: CollapseData,

    hovering: boolean,
    whole_object_clickable: boolean,
}): JSX.Element {
    return <SwitchKind item={props.loader_or_post.content}>{{
        post: post => <>
            <ClientContentAny
                content={post.content}
                opts={{
                    frame: post,
                    client_id: post.client_id,
                    collapse_data: props.collapse_data,
                    flat_frame: props.loader_or_post,
                }}

                hovering={props.hovering}
                whole_object_clickable={props.whole_object_clickable}
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
                            props.loader_or_post.id,
                            loader,
                        );
                    })(),
                ).then(r => {
                    batch(() => {
                        setLoading(false);
                        setError(null);
                        console.log("adding content", r.content, props.loader_or_post);
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
    }}</SwitchKind>;
}