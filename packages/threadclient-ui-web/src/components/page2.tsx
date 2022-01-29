import "@fortawesome/fontawesome-free/css/all.css";
import type * as Generic from "api-types-generic";
import { createMemo, createSignal, For, JSX } from "solid-js";
import { flatten } from "threadclient-render-flatten";
import { assertNever } from "tmeta-util";
import { ShowBool, ShowCond, SwitchKind, timeAgoTextWatchable } from "tmeta-util-solid";
import { clientContent, clientListing, getClientCached, link_styles_v } from "../app";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import {
    classes, DefaultErrorBoundary, getPageRootContext, getSettings, HideshowProvider, ToggleColor
} from "../util/utils_solid";
import { PostActions } from "./action";
import { animateHeight, ShowAnimate } from "./animation";
import { Body, summarizeBody } from "./body";
import { CounterCount, getCounterState, VerticalIconCounter } from "./counter";
import { A, LinkButton, UserLink } from "./links";

function Icon(props: {tag: string, filled: boolean, label: string}): JSX.Element {
    return <i
        class={props.tag + " " + (props.filled ? "fas" : "far")}
        aria-label={props.label}
    />;
}

export type ClientPostOpts = {
    clickable: boolean,
    frame: Generic.PostData | null,
    replies: Generic.ListingData | null,
    client_id: string,
    at_or_above_pivot: boolean,
    is_pivot: boolean,
    top_level: boolean,
};

const decorative_alt = "";

export function AuthorPfp(props: {src_url: string}): JSX.Element {
    return <img
        src={props.src_url}
        alt={decorative_alt}
        class="w-8 h-8 object-center inline-block rounded-full"
    />;
}

export function Flair(props: {flairs: Generic.Flair[]}): JSX.Element {
    // TODO renderFlair
    return <span><For each={props.flairs}>{(flair) => <>
        {" "}
        <span
            class={flair.system != null ? {
                none: "",
                op: "text-blue-500",
                cake: "text-gray-500",
                admin: "text-red-500",
                moderator: "text-green-500",
                approved: "text-green-500",
                error: "text-red-500",
            }[flair.system] : ("rounded-full px-2"
                + (flair.color != null ? " bg-flair-light dark:bg-flair-dark" : " bg-gray-300")
                + (flair.fg_color != null ? " flair-text-"+flair.fg_color : "")
            )}
            style={{
                '--flair-color': flair.color,
                '--flair-color-dark': flair.color,
            }}
        >
            <For each={flair.elems}>{elem => <SwitchKind item={elem}>{{
                text: (txt) => <>{txt.text}</>,
                emoji: (emoji) => <img
                    title={emoji.name}
                    src={emoji.url}
                    width={emoji.w} height={emoji.h}
                    class="inline-block w-4 h-4 align-middle object-contain"
                />,
            }}</SwitchKind>}</For>
        </span>
    </>}</For></span>;
}



// function readLinkNoError<T>(link: Generic.Link<T>): Generic.ReadLinkResult<T> {
//     const root_context = getPageRootContext()();
//     return Generic.readLink(root_context, link);
// }
// function readLink<T>(link: Generic.Link<T>): T {
//     const res = readLinkNoError(link);
//     if(res.error != null) throw new Error("Could not read link; "+res.error);
//     return res.value;
// }
//
// function ErrableLink<T,>(props: {
//     link: Generic.Link<T>,
//     fallback?: undefined | ((err: string) => JSX.Element),
//     children: (link: T) => JSX.Element,
// }) {
//     const value = createMemo(() => readLinkNoError(props.link));
//     return <ShowBool when={value().error != null} fallback={
//         props.fallback ? (
//             untrack(() => props.fallback!(value().error!))
//         ) : <div>Error! {value().error!}</div>
//     }>
//         {untrack(() => props.children(value().value!))}
//     </ShowBool>;
// }

export function ClientContentAny(props: {content: Generic.PostContent, opts: ClientPostOpts}): JSX.Element {
    return <SwitchKind item={props.content}>{{
        post: content => (
            <ClientPost content={content} opts={props.opts} />
        ),
        page: () => <>TODO page</>,
        legacy: legacy => <>
            <SolidToVanillaBoundary getValue={hsc => {
                const outer = el("div").clss("-mt-10px -ml-10px");
                const frame = el("div").clss("post text-sm").adto(outer);
                const client = getClientCached(legacy.client_id)!;
                clientListing(client, legacy.thread, frame, {
                    clickable: true,
                }).defer(hsc);
                return outer;
            }} />
        </>,
        client: () => <>TODO client</>,
    }}</SwitchKind>;
}

// we're going to be disabling animations for a bit during this transition
export function CollapseButton(props: {
    class?: undefined | string,
    collapsed_raw: boolean,
    collapsed_anim: boolean,
    onClick: () => void,
}): JSX.Element {
    return <button
        class={"collapse-btn z-1 static outline-default "+props.class}
        classList={{
            'collapsed': props.collapsed_anim,
        }}
        draggable={true}
        onClick={() => props.onClick()}
        aria-label="Collapse"
        aria-pressed={props.collapsed_raw}
    >
        <div class="collapse-btn-inner rounded-none"></div>
    </button>;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const HSplit = {
    Container(props: {dir: "left" | "right", children: JSX.Element}): JSX.Element {
        return <div class={classes(
            "flex flex-wrap items-center",
            props.dir === "right" ? "justify-end" : "",
        )}>
            {props.children}
        </div>;
    },
    Child(props: {
        vertical?: undefined | "top" | "center" | "bottom",
        fullwidth?: undefined | boolean,
        children: JSX.Element,
    }): JSX.Element {
        return <div class={classes(
            ({
                top: "self-start",
                center: "self-center",
                bottom: "self-end",
                none: "",
            } as const)[props.vertical ?? "none"],
            props.fullwidth ?? false ? "flex-1" : "",
        )}>{props.children}</div>;
    },
};
function Button(props: {
    children: JSX.Element,
    onClick?: undefined | (() => void),
}): JSX.Element {
    return <button class={classes(
        "py-1 px-2 rounded-md",
        "text-gray-600",
        "bg-gray-200 border-b-1 border-gray-500",
        "dark:border-t-1 dark:border-b-0 dark:bg-white dark:border-gray-400",
    )} onClick={props.onClick}>{props.children}</button>;
}

type InfoBarItem = {
    value: ["percent" | "number" | "timeago" | "hidden" | "none", number],
    icon: IconKind,
    color: IconColor,
};
type IconKind = "comments" | "creation_time" | "edit_time" |
"up_arrow" | "down_arrow" | "controversiality" | "pinned";
type IconColor = null | "orange" | "purple" | "green";

const tag_from_icon_kind: {[key in IconKind]: [
    desc: string, free: boolean,
    tag: string, tag_pro?: undefined | string,
]} = {
    // huh I think it would make sense to use "far" for "none" color and
    // "fas" for any other color
    comments: ["Comments", true, "fa-comment"],
    creation_time: ["Posted", true, "fa-clock"],
    edit_time: ["Edited", true, "fa-edit", "fa-pencil"],
    up_arrow: ["Points", false, "fa-arrow-up"],
    down_arrow: ["Points", false, "fa-arrow-down"],
    controversiality: ["Controversial", true, "fa-smile"],
    pinned: ["Pinned", false, "fas fa-thumbtack"],
};
const class_from_icon_color: {[key in Exclude<IconColor, null>]: string} = {
    orange: "text-$upvote-color",
    purple: "text-$downvote-color",
    green: "text-green-600 dark:text-green-500",
};

function getInfoBar(post: Generic.PostContentPost): InfoBarItem[] {
    const res: InfoBarItem[] = [];

    // TODO make the order user-configurable

    if(post.info?.pinned === true) {
        res.push({
            icon: "pinned",
            value: ["none", -1000],
            color: "green",
        });
    }
    if(post.actions?.vote) {
        // TODO support other types of voting
        // eg: mastodon will be star/unstar so we should use a star icon
        // and yellow color
        // the vote thing should have a way to specify:
        // increment_icon, increment_color, decrement_icon, decrement_color
        const [stateR] = getCounterState(() => post.actions!.vote!);
        const state = stateR();
        const pt_count = state.pt_count;
        res.push({
            icon: state.your_vote === "decrement" ? "down_arrow" : "up_arrow",
            value: pt_count === "hidden"
            ? ["hidden", -1000] : pt_count === "none" ? ["none", -1000]
            : ["number", pt_count],
            color: state.your_vote === "decrement" ? "purple" :
            state.your_vote === "increment" ? "orange" : null,
        });
        if(post.actions.vote.percent != null) {
            res.push({
                icon: "controversiality",
                value: ["percent", post.actions.vote.percent],
                color: null,
            });
        }
    }
    if(post.info?.comments != null) {
        res.push({
            icon: "comments",
            value: ["number", post.info.comments],
            color: null,
        });
    }
    if(post.info?.creation_date != null) {
        res.push({
            icon: "creation_time",
            value: ["timeago", post.info.creation_date],
            color: null,
        });
    }
    if(post.info?.edited) {
        res.push({
            icon: "edit_time",
            value: post.info.edited.date == null ? ["none", -1000] :
            ["timeago", post.info.edited.date],
            color: null,
        });
    }

    return res;
}

function scoreToString(score: number) {
    // oh that weird .match(…) is for rounding down
    // because I couldn't… *10 |0 /10?
    // idk I'm sure I thought of that when I was programming this
    // weird
    if(score < 10_000) return "" + score;
    if(score < 100_000) return (score / 1_000).toFixed(2).match(/^-?\d+(?:\.\d{0,1})?/)?.[0] + "k";
    if(score < 1_000_000) return (score / 1_000 |0) + "k";
    if(score < 100_000_000) return (score / 1_000_000).toFixed(2).match(/^-?\d+(?:\.\d{0,1})?/)?.[0] + "m";
    return (score / 1_000_000 |0) + "m";
}
function formatItemString({value}: InfoBarItem): [short: string, long: string] {
    if(value[0] === "none") return ["", ""];
    if(value[0] === "percent") return [
        " "+value[1].toLocaleString(undefined, {style: "percent"}),
        " "+value[1].toLocaleString(undefined, {style: "percent"}),
    ];
    if(value[0] === "timeago") return [
        " "+timeAgoTextWatchable(value[1], {short: true})(),
        " "+new Date(value[1]).toLocaleString(),
    ];
    if(value[0] === "number") return [
        " "+scoreToString(value[1]),
        " "+value[1].toLocaleString(),
    ];
    if(value[0] === "hidden") return [
        " "+"—",
        " "+"Hidden",
    ];
    assertNever(value[0]);
}

function InfoBarItem(props: {item: InfoBarItem}): JSX.Element {
    // sizeLt.sm
    // for larger sizes we can do longer text
    // eg
    // [c]12 [u]21.8k [h]83% [t]2y
    // →
    // 12 comments, 21.8k points, 83% upvoted, 2 years ago

    const fmt = createMemo(() => formatItemString(props.item));
    const lblv = () => tag_from_icon_kind[props.item.icon][0]+(props.item.value[0] === "none" ? "" : ":");

    return <span
        class={props.item.color != null ? class_from_icon_color[props.item.color] : ""}
        title={lblv() + fmt()[1]}
    >
        <Icon
            tag={tag_from_icon_kind[props.item.icon][2]}
            filled={tag_from_icon_kind[props.item.icon][1] ? props.item.color != null : true}
            label={lblv()}
        />{fmt()[0]}
    </span>;
}

function InfoBar(props: {post: Generic.PostContentPost}): JSX.Element {
    return <div class="text-gray-500 flex flex-wrap gap-2 <sm:text-xs">
        <For each={getInfoBar(props.post)}>{item => (
            <InfoBarItem item={item} />
        )}</For>
    </div>;
}

export type ClientPostProps = {content: Generic.PostContentPost, opts: ClientPostOpts};
function ClientPost(props: ClientPostProps): JSX.Element {
    const default_collapsed = props.content.collapsible !== false ? (
        props.opts.is_pivot ? false :
        props.content.collapsible.default_collapsed
    ) : false;
    const [selfVisible, setSelfVisible] = createSignal(
        props.opts.is_pivot ? true :
        default_collapsed ? false :
        true,
    );
    const [contentWarning, setContentWarning] = createSignal(
        !!(props.content.flair ?? []).find(flair => flair.content_warning),
    );
    const hasTitleOrThumbnail = () => {
        return !!props.content.thumbnail || !!props.content.title;
    };
    const hasThumbnail = () => {
        return !!props.content.thumbnail;
    };

    const settings = getSettings();

    const [transitionTarget, setTransitionTarget] = createSignal(selfVisible());
    const [animState, setAnimState] = createSignal<{visible: boolean, animating: boolean}>({
        visible: selfVisible(),
        animating: false,
    });

    // const [showActions, setShowActions] = createSignal(false);
    // const mobile = () => screenWidth() < screen_size.sm;
    // createEffect(() => {
    //     if(!mobile()) setShowActions(false);
    // });

    // const postIsClickable = () => {
    //     return props.opts.frame?.url != null && !props.opts.is_pivot;
    // };
    
    const onAddReply = (reply: Generic.Post) => {
        // TODO;
        alert("Reply posted. TODO: display it.");
    };
    
    // class={"flex-1" + (postIsClickable() ? " hover-outline" : "")}
    // // note: screenreader or keyboard users must click the 'view' button
    // // or the title if there is one.
    // // I considered making the "x points x hours ago" a link but it's harder
    // // to do than it should be because of the {" "} and {", "} those get underlined
    // onclick={e => {
    //     if(!postIsClickable()) return;
    //     if(!allowedToAcceptClick(e.target as Node, e.currentTarget)) return;
    //     e.stopPropagation();
    //     // support ctrl click
    //     const target_url = "/"+props.opts.client_id+props.opts.frame?.url;
    //     if(e.ctrlKey || e.metaKey || e.altKey) {
    //         window.open(target_url);
    //     }else{
    //         navigate({
    //             path: target_url,
    //             // page: props.opts.frame ? {pivot: {ref: props.opts.frame}} : undefined,
    //             // disabling this for now, we'll fix it in a bit
    //             // we just need to know what the link to the post is in the
    //             // post itself
    //         });
    //     }
    // }}

    return <article
        ref={node => animateHeight(node, settings, transitionTarget, (state, rising, animating) => {
            setAnimState({visible: rising || state, animating});
            setSelfVisible(state || rising);
        })}
        class={classes(
            "text-sm",
            // "pt-10px",
            props.content.collapsible !== false ? (
                props.opts.top_level ? "pl-1" : ""
            ) : "pl-15px",
            "flex flex-row",

            props.opts.top_level ? "-mt-10px -ml-10px" : [],
        )}
        style={{
            "--left-v": "8px",
        }}
    >
        <ShowBool when={props.content.collapsible !== false && (
            props.content.thumbnail != null ? selfVisible() ? true : false : true
        )}>
            <div class={"flex flex-col items-center mr-1 gap-2 "+(props.opts.top_level ? "sm:px-1" : "sm:pr-1")}>
                <ShowCond when={props.content.actions?.vote}>{vote_action => (
                    <div class={selfVisible() || hasThumbnail() ? "" : " hidden"}>
                        <VerticalIconCounter counter={vote_action} />
                    </div>
                )}</ShowCond>
                <CollapseButton
                    class="flex-1"
                    collapsed_raw={!transitionTarget()}
                    collapsed_anim={!selfVisible()}
                    onClick={() => {
                        setTransitionTarget(t => !t);
                    }}
                />
            </div>
        </ShowBool>
        <div class="flex-1">
            <HSplit.Container dir="right">
                <ShowCond if={[!selfVisible()]} when={props.content.thumbnail}>{thumb_any => (
                    <ToggleColor>{color => (
                        <HSplit.Child>
                            <button class={classes(
                                "w-12 h-12 sm:w-16 sm:h-16 mr-4 rounded-md "+color,
                                contentWarning() && thumb_any.kind === "image" ? "thumbnail-content-warning" : "",
                            )} onClick={() => setTransitionTarget(t => !t)}>
                                <SwitchKind item={thumb_any}>{{
                                    image: img => <img
                                        // TODO based on the img content, display eg a play button or something
                                        src={img.url}
                                        alt=""
                                        class={classes(
                                            "w-full h-full object-contain rounded-md"
                                        )}
                                    />,
                                    default: def => <>TODO {def.kind}</>,
                                }}</SwitchKind>
                            </button>
                        </HSplit.Child>
                    )}</ToggleColor>
                )}</ShowCond>
                <HSplit.Child fullwidth>
                    <div class={classes(
                        hasTitleOrThumbnail() ? "text-base" : "text-xs",
                    )}>
                        <ShowCond when={props.content.title}>{title => (
                            <span role="heading">
                                <ShowCond when={props.opts.frame?.url} fallback={(
                                    title.text
                                )}>{url => (
                                    <A
                                        client_id={props.opts.client_id}
                                        href={url}
                                        class="hover:underline"
                                    >{title.text}</A>
                                )}</ShowCond>
                            </span>
                        )}</ShowCond>
                        <Flair flairs={props.content.flair ?? []} />
                    </div>
                    <div class={classes(
                        "text-gray-500",
                        hasTitleOrThumbnail() ? "" : "text-xs",
                        selfVisible() || hasThumbnail()
                        ? ""
                        : "filter grayscale text-$collapsed-header-color italic max-lines max-lines-1",
                    )}>
                        <ShowCond when={props.content.author}>{author => <>
                            <ShowCond if={[
                                selfVisible() && settings.author_pfp.value() === "on",
                            ]} when={author.pfp} fallback={"By "}>{pfp => <>
                                <AuthorPfp src_url={pfp.url} />{" "}
                            </>}</ShowCond>
                            <UserLink
                                client_id={author.client_id}
                                href={author.link}
                                color_hash={author.color_hash}
                            >
                                {author.name}
                            </UserLink>{" "}
                        </>}</ShowCond>
                        <ShowBool when={selfVisible() || hasTitleOrThumbnail()} fallback={<>
                            <ShowBool when={default_collapsed} fallback={
                                <span class="whitespace-normal">
                                    {"“" + (() => {
                                        const res = summarizeBody(props.content.body);
                                        if(res.length > 500) return res.substring(0, 500) + "…";
                                        return res;
                                    })() + "”"}
                                </span>
                            }>
                                <ShowCond when={props.content.actions?.vote} fallback={
                                    "[Collapsed by default]"
                                }>{vote_action => <>
                                    <CounterCount counter={vote_action} />{" "}
                                </>}</ShowCond>
                            </ShowBool>
                        </>}>
                            <ShowCond when={props.content.author}>{author => <>
                                <ShowCond when={author.flair}>{flair => <>
                                    <Flair flairs={flair} />{" "}
                                </>}</ShowCond>
                            </>}</ShowCond>
                            <ShowCond when={props.content.info?.in}>{in_sr => <>
                                {" in "}<LinkButton
                                    href={in_sr.link}
                                    style="normal"
                                    client_id={in_sr.client_id}
                                >{in_sr.name}</LinkButton>{" "}
                            </>}</ShowCond>
                        </ShowBool>
                        <InfoBar post={props.content} />
                    </div>
                </HSplit.Child>
                <ShowBool when={!props.opts.is_pivot}>
                    <HSplit.Child vertical="top">
                        <div class="pl-2" />
                        <Button onClick={() => alert("TODO")}>…</Button>
                    </HSplit.Child>
                </ShowBool>
            </HSplit.Container>
            <div style={{display: selfVisible() ? "block" : "none"}}><HideshowProvider
                visible={() => animState().visible || animState().animating}
            >
                <section>
                    <ShowBool when={animState().visible || animState().animating}>
                        <ShowBool when={selfVisible() && hasThumbnail()}><div class="mt-2"></div></ShowBool>
                        <ShowAnimate when={!contentWarning()} fallback={
                            <>
                                Content Warning:{" "}
                                <Flair flairs={(props.content.flair ?? []).filter(f => f.content_warning)} />{" "}
                                <button
                                    class={link_styles_v["pill-filled"]}
                                    onClick={() => setContentWarning(false)}
                                >Show Anyway</button>
                            </>
                        }>
                            <Body body={props.content.body} autoplay={false} />
                        </ShowAnimate>
                    </ShowBool>
                </section>
                <ShowBool when={props.opts.is_pivot}><div class={hasTitleOrThumbnail() ? "" : "text-xs"}>
                    <PostActions
                        content={props.content}
                        opts={props.opts}
                        onAddReply={onAddReply}
                    />
                </div></ShowBool>
            </HideshowProvider></div>
        </div>
    </article>;
}

export type ClientContentProps = {listing: Generic.PostContent, opts: ClientPostOpts};
export function ClientContent(props: ClientContentProps): JSX.Element {
    const todosupport = (thing: unknown) => <>
        TODO support. also in the parent list these should probably{" "}
        be one of those navbars with bits like ClientName {">"} PageName {">"} …{" "}
        <button onclick={() => console.log(thing)}>code</button>
    </>;
    return <div>
        <DefaultErrorBoundary data={[props.listing, props.opts]}>
            <SwitchKind item={props.listing}>{{
                page: thing => todosupport(thing),
                client: thing => todosupport(thing),
                post: (post) => <>
                    <ClientPost content={post} opts={props.opts} />
                </>,
                legacy: legacy => <SolidToVanillaBoundary getValue={(hsc): HTMLElement => {
                    // clientContent(client, r, {clickable: false}).defer(hsc).adto(el("div").adto(content_buttons_line));
                    // return clientContent()
                    //                             clientContent(client, r, {clickable: false}).defer(hsc).adto(el("div").adto(content_buttons_line));
                    const client = getClientCached(legacy.client_id)!;
                    return clientContent(client, legacy.thread, {clickable: props.opts.clickable}).defer(hsc);
                }}/>,
            }}</SwitchKind>
        </DefaultErrorBoundary>
    </div>;
}

export type ClientPageProps = {
    pivot: Generic.Link<Generic.Post>,
};
export default function ClientPage(props: ClientPageProps): JSX.Element {
    // [!] we'll want to fix this up and make it observable and stuff
    // now that page2 is ready to be properly observable, flatten should be too.
    const view = createMemo(() => flatten(props.pivot, {
        collapse_states: new Map(),
        content: getPageRootContext()(),
    })); // TODO reconcile merge:true I think key:"key" but be careful
    // TODO don't delete old items from dom just hide them

    // ok I want to delete all the routing code so I can do hmr
    // it'd be really nice having hmr with clientpage
    // rn all the export vars are messing everything up in app

    // I should be able to move everything into an export function main() I think
    // life hack

    return <div class="m-4">
        <For each={view().body}>{item => <SwitchKind item={item}>{{
            wrapper_start: () => <ToggleColor>{color => <div class={""
                + " " + color
                + " h-2 rounded-xl mt-4"
            } style="border-bottom-left-radius: 0; border-bottom-right-radius: 0" />}</ToggleColor>,
            wrapper_end: () => <ToggleColor>{color => <div class={""
                + " " + color
                + " h-2 rounded-xl mb-4"
            } style="border-top-left-radius: 0; border-top-right-radius: 0" />}</ToggleColor>,
            post: loader_or_post => <ToggleColor>{color => <div class={"px-2 "+color}>
                <div class="flex flex-row">
                    <For each={loader_or_post.indent}>{indent => <>
                        <CollapseButton collapsed_raw={false} collapsed_anim={false} onClick={() => {
                            alert("todo!");
                        }} />
                    </>}</For>
                    <div class="flex-1"><ShowBool when={!loader_or_post.first_in_wrapper}>
                        <div class="pt-10px" />
                    </ShowBool><SwitchKind item={loader_or_post.content}>{{
                        post: post => <ClientContentAny
                            content={post.content}
                            opts={{
                                clickable: false, // TODO
                                frame: post,
                                client_id: post.client_id,
                                replies: post.replies,
                                at_or_above_pivot: loader_or_post.at_or_above_pivot,
                                top_level: false,
                                is_pivot: loader_or_post.is_pivot,
                            }}
                        />,
                        loader: loader => (
                            <button
                                class="text-blue-500 hover:underline"
                                onClick={() => {
                                    // fetch the result
                                    // merge it into global state for the current session
                                    //
                                    // this implies props.page should just be a map of key
                                    // → value rather than the current nested structure
                                    // ok I'm going to do that let's go
                                    alert("TODO");
                                }}
                            >
                                Load More ({loader.load_count ?? "????"})
                            </button>
                        ),
                    }}</SwitchKind></div>
                </div>
            </div>}</ToggleColor>,
            horizontal_line: () => <hr
                class="my-2 border-t-2"
                style={{'border-top-color': "var(--collapse-line-color)"}}
            />,
            todo: todo => <div>TODO: {todo.note} <button onclick={() => console.log(todo.data)}>code</button></div>,
            error: error => <div class="text-red-500">
                Error: {error.note} <button onclick={() => console.log(error.data)}>code</button>
            </div>,
        }}</SwitchKind>}</For>
    </div>;
}

export function TopLevelWrapper(props: {
    children: JSX.Element,
    restrict_w?: undefined | boolean,
}): JSX.Element {
    return <ToggleColor>{(color, i) => <div class={
        (i === 0 ? "object-wrapper top-level-wrapper" : "p-10px mt-10px rounded-xl")
        + " " + color
        + " " + (props.restrict_w ?? false ? "max-w-xl" : "")
    }>{props.children}</div>}</ToggleColor>;
}
