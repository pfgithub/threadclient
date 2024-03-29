import * as Generic from "api-types-generic";
import {
    createMemo, createSignal,
    For,
    JSX,
    untrack
} from "solid-js";
import { switchKind } from "tmeta-util";
import { allowedToAcceptClick, Show, SwitchKind } from "tmeta-util-solid";
import { navigate } from "../page1_routing";
import {
    classes, DefaultErrorBoundary, getWholePageRootContext, PageRootContext, size_lt
} from "../util/utils_solid";
import { Body } from "./body";
import Clickable from "./Clickable";
import { CollapseButton } from "./CollapseButton";
import { CollapseData, FlatItem, FlatPost, FlatTreeItem, getCState } from "./flatten";
import Hactive from "./Hactive";
import { InternalIconRaw } from "./Icon";
import { UnfilledLoader } from "./OneLoader";
import { ClientContent } from "./page2";
import proxyURL from "./proxy_url";
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

type FullscreenImageProps = {
    url: string,
    link_url: string | null,
    w: number,
    h: number,
};

type SCProps<T> = {
    data: T,

    collapse_data: CollapseData,
    loader_or_post: FlatPost,
    post: Generic.Post,
};


function FullscreenObject(props: {children: JSX.Element, loader_or_post: FlatPost}): JSX.Element {
    return <div
        class={"block overflow-hidden " + (
            props.loader_or_post.first_in_wrapper ? "sm:rounded-t-lg " : ""
        ) + (
            props.loader_or_post.last_in_wrapper ? "sm:rounded-b-lg " : ""
        )}
    >
        {props.children}
    </div>;
}

type SpecialCallback = (props: SCProps<any>) => JSX.Element;
const replace_post_special_callbacks: Record<string, SpecialCallback> = {
    'FullscreenImage@-N0D1IW1oTVxv8LLf7Ed': (props: SCProps<FullscreenImageProps>) => {
        return <FullscreenObject loader_or_post={props.loader_or_post}>
            <Clickable
                action={{url: props.data.link_url ?? "E:", client_id: props.post.client_id}}
                class={"block w-full"}
            >
                <img
                    class="block w-full h-full"
                    src={proxyURL(props.data.url)}
                    width={props.data.w} height={props.data.h}
                />
            </Clickable>
        </FullscreenObject>;
    },
    'FullscreenEmbed@-N0D96jIL-HGWHWbWKn1': (props: SCProps<Generic.Body>) => {
        return <FullscreenObject loader_or_post={props.loader_or_post}>
            <Body body={props.data} autoplay={false} />
        </FullscreenObject>;
    },
};

export default function PageFlatItem(props: {item: FlatItem, collapse_data: CollapseData}): JSX.Element {
    return <DefaultErrorBoundary data={props.item}>
        <PageFlatItemNoError item={props.item} collapse_data={props.collapse_data} />
    </DefaultErrorBoundary>;
}
function PageFlatItemNoError(props: {item: FlatItem, collapse_data: CollapseData}): JSX.Element {
    const hprc = getWholePageRootContext();
    return <SwitchKind item={props.item}>{{
        // TODO: remove wrapper_start and wrapper_end and instead make these properties of loader_or_post
        // TODO: improve how gaps are made. make gaps automatically between posts for example. margin
        // should not be used to make gaps.
        wrapper_start: () => <div class="mt-4" />,
        wrapper_end: () => <div class={"pb-2 sm:rounded-b-lg bg-slate-100 dark:bg-zinc-800"} />,
        repivot_list_fullscreen_button: fsb => <Clickable
            class="bg-slate-100 dark:bg-zinc-800 p-2 rounded-md"
            action={{url: fsb.href, client_id: fsb.client_id, page: () => ({
                content: hprc.content.untrackToContent(),
                pivot: fsb.pivot(),
            }), mode: "replace"}}
        >
            <InternalIconRaw class="fa-solid fa-up-right-and-down-left-from-center" label={null} />
            {" "}{fsb.name}
        </Clickable>,
        sort_buttons: sortbtns => <div class={"mt-4 mb-4 rounded-lg bg-slate-100 dark:bg-zinc-800"}>
            <menu class="p-2 flex flex-row flex-wrap gap-2 dark:text-zinc-400">
                <For each={sortbtns.sort_buttons}>{sortbtn => <li style={{display: "contents"}}>
                    {// inline-block mx-1 px-1 text-base border-b-2 transition-colors border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900
                    }
                    <Clickable
                        class="px-1 border-b-2 border-transparent dark:hover:text-zinc-50"
                        action={switchKind(sortbtn, {
                            url: u => ({url: u.url, client_id: sortbtns.client_id, mode: "replace"}),
                            post: p => (() => alert("TODO post: "+p.name)),
                            more: () => (() => alert("TODO more")),
                        })}
                        children={<>
                            {sortbtn.name}
                            {sortbtn.kind === "more" ? " ▾" : ""}
                        </>}
                    />
                </li>}</For>
            </menu>
        </div>,
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
                mode="fake"
                onClick={() => {
                    const cs = getCState(props.collapse_data, indent.id);
                    cs.setCollapsed(v => !v);
                }}
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
    const specialCB = createMemo((): null | (() => JSX.Element) => {
        const v = props.loader_or_post.content;
        if(v.kind !== "flat_post" || v.post.content.kind !== "special") return null;
        const vc = v.post.content;
        const fpsc = replace_post_special_callbacks[vc.tag_uuid];
        if(fpsc == null) return null;
        return () => fpsc({get data() {
            return vc.not_typesafe_data;
        }, get collapse_data() {
            return props.collapse_data;
        }, get loader_or_post() {
            return props.loader_or_post;
        }, get post() {
            return v.post;
        }});
    });

    return createMemo(() => {
        const scb = specialCB();
        if(scb) return untrack(() => scb());
        return <PageFlatPostNotSpecial
            collapse_data={props.collapse_data}
            loader_or_post={props.loader_or_post}
        />;
    });
}

export function postGetPage(hprc: PageRootContext, lpc: FlatTreeItem): Generic.Page2 | undefined {
    if(lpc.kind !== "flat_post") return undefined; // only posts are focusable
    if(lpc.post.disallow_pivot ?? false) return undefined;
    return {
        pivot: lpc.link,
        content: hprc.content.untrackToContent(),
    };
}
export function postOnClick(hprc: PageRootContext, frame: FlatPost, e: MouseEvent | KeyboardEvent): void {
    const post = frame.content;

    if(post.kind !== "flat_post") return alert("EONCLICK-ON-NON-POST");

    // support ctrl click
    const target_url = "/"+post.post.client_id+post.post.url;
    if(e.ctrlKey || e.metaKey || e.altKey) {
        window.open(target_url);
    }else{
        navigate({
            path: target_url,
            page: postGetPage(hprc, post),
        });
    }
}

function PageFlatPostNotSpecial(props: {
    collapse_data: CollapseData,
    loader_or_post: FlatPost,
}): JSX.Element {
    // ok detect if clickable:
    // - post not pivot & post has url & post displayed_in repivot_list → make post
    //   clickable and inform the content that its parent is clickable already (not necessary)

    const isPivot = () => props.loader_or_post.is_pivot;
    const wholeObjectClickable = () => {
        if(isPivot()) return false;
        const lp = props.loader_or_post;
        if(lp.content.kind !== "flat_post") return false; // only posts are clickable
        if(lp.displayed_in !== "repivot_list") return false;
        if(lp.content.post.url == null) return false;
        return true;
    };
    const hprc = getWholePageRootContext();

    const onClick = (e: MouseEvent | KeyboardEvent) => {
        const frame = props.loader_or_post;
        return postOnClick(hprc, frame, e);
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
        <Hactive clickable={wholeObjectClickable()}>{(hactive, divRef, divAddClass) => <div
            ref={divRef}
            class={
                divAddClass() + " px-2 "+(
                    hactive() ? `
                    bg-slate-200 dark:bg-zinc-700
                        shadow-md z-1
                    ` : "bg-slate-100 dark:bg-zinc-800"
                )+" "+(props.loader_or_post.is_pivot ? "@@IS_PIVOT@@ " : "")+
                (wholeObjectClickable() ? `
                    cursor-pointer
                    relative
                ` : "")+
                (props.loader_or_post.first_in_wrapper ? `
                    pt-2 sm:rounded-t-lg
                ` : "")+
                (props.loader_or_post.last_in_wrapper ? `
                    pb-2 sm:rounded-b-lg
                ` : "")
            }
            onClick={e => {
                if(!wholeObjectClickable()) return;
                if(!allowedToAcceptClick(e.target, e.currentTarget)) return;
                e.stopPropagation();

                onClick(e);
            }}

            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
        >
            <Show if={wholeObjectClickable()}>
                <button class="absolute pointer-events-none top-0 left-0 bottom-0 right-0 w-full h-full rounded-lg outline-default" onClick={e => {
                    e.stopPropagation();
                    onClick(e);
                }}>
                    <span class="sr-only">Repivot</span>
                </button>
            </Show>
            <div class="relative flex flex-row gap-1">
                <PostIndent
                    loader_or_post={props.loader_or_post}
                    collapse_data={props.collapse_data}
                />
                <div
                    class={"flex-1 w-0"}
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
        </div>}</Hactive>
    </SwipeActions>;
}

function PageFlatPostContent(props: {
    loader_or_post: FlatPost,
    collapse_data: CollapseData,

    hovering: boolean,
    whole_object_clickable: boolean,
}): JSX.Element {
    return <SwitchKind item={props.loader_or_post.content}>{{
        error: er => <div class="py-1">
            <div class="text-red-500">!ERROR!</div> {er.msg}
        </div>,
        flat_post: fp => <>
            <ClientContent
                content={fp.post.content}
                opts={{
                    frame: fp.post,
                    client_id: fp.post.client_id,
                    collapse_data: props.collapse_data,
                    flat_frame: props.loader_or_post,
                    id: fp.link,
                }}

                hovering={props.hovering}
                whole_object_clickable={props.whole_object_clickable}
            />
        </>,
        flat_loader: loader => {
            return <UnfilledLoader loader={loader} label="Load More" />;
        },
    }}</SwitchKind>;
}