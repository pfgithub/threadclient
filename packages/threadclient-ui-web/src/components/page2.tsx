import type * as Generic from "api-types-generic";
import {
    Accessor, createMemo, createSignal,
    For, JSX, onCleanup, Setter
} from "solid-js";
import { assertNever } from "tmeta-util";
import { ShowBool, ShowCond, SwitchKind, timeAgoTextWatchable } from "tmeta-util-solid";
import { clientContent, clientListing, getClientCached, link_styles_v } from "../app";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import {
    classes, DefaultErrorBoundary, getPageRootContext,
    getSettings, getWholePageRootContext, HideshowProvider, size_lt, ToggleColor
} from "../util/utils_solid";
import { animateHeight, ShowAnimate } from "./animation";
import { Body, summarizeBody } from "./body";
import { colorClass } from "./color";
import { CounterCount, getCounterState, VerticalIconCounter } from "./counter";
import { createMergeMemo } from "./createMergeMemo";
import Dropdown from "./Dropdown";
import DropdownButton from "./DropdownButton";
import { CollapseData, flatten, getCState } from "./flatten";
import Icon from "./Icon";
import { A, LinkButton, UserLink } from "./links";

export type ClientPostOpts = {
    clickable: boolean,
    frame: Generic.PostData | null,
    replies: Generic.ListingData | null,
    client_id: string,
    at_or_above_pivot: boolean,
    is_pivot: boolean,
    collapse_data?: undefined | CollapseData,
    id?: undefined | Generic.Link<Generic.Post>,
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
    real: boolean,
    cstates?: undefined | CollapseData,
    id?: undefined | Generic.Link<Generic.Post>,
}): JSX.Element {
    let in_hovers = false;
    onCleanup(() => {
        if(!props.id || !props.cstates) return;
        const cst = getCState(props.cstates, props.id);

        if(in_hovers) cst.setHovering(v => v - 1);
        in_hovers = false;
    });
    return <button
        class={classes(
            // oh, class= and classList= can't be combined
            props.cstates && props.id ?
            getCState(props.cstates, props.id).hovering() > 0 ?
            "collapse-btn-hover " :
            "" :
            "",
            "collapse-btn z-1 static outline-default",
            props.class ?? "",
            props.collapsed_anim ? "collapsed" : "",
        )}
        draggable={true}
        onClick={() => props.onClick()}
        aria-label="Collapse"
        aria-pressed={props.collapsed_raw}
        tabindex={props.real ? undefined : "-1"}
        aria-hidden={props.real ? true : undefined}
        onmouseover={() => {
            if(!props.id || !props.cstates) return;
            const cst = getCState(props.cstates, props.id);

            if(!in_hovers) cst.setHovering(v => v + 1);
            in_hovers = true;
        }}
        onmouseleave={() => {
            if(!props.id || !props.cstates) return;
            const cst = getCState(props.cstates, props.id);

            if(in_hovers) cst.setHovering(v => v - 1);
            in_hovers = false;
        }}
    >
        <div class="collapse-btn-inner rounded-none"></div>
    </button>;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const HSplit = {
    Container(props: {
        dir: "left" | "right",
        vertical: "top" | "center" | "bottom" | "baseline",
        children: JSX.Element,
    }): JSX.Element {
        return <div class={classes(
            "flex flex-wrap",
            ({
                top: "items-start",
                center: "items-center",
                bottom: "items-end",
                baseline: "items-baseline",
            } as const)[props.vertical],
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
    icon: Generic.Icon,
    color: null | Generic.Color,
    text: string,
};

type ActionItem = {
    icon: Generic.Icon,
    color: null | Generic.Color,
    text: string,
    // disabled: boolean,

    // onClick will be a link | a thing that makes a CancellableAction
    onClick: "TODO" | {url: string} | (() => void),
};

function getActionsFromAction(action: Generic.Action, opts: ClientPostOpts): ActionItem[] {
    const actions: ActionItem[] = [];

    if(action.kind === "counter") {
        const [stateR] = getCounterState(() => action);
        const state = stateR();
        const your_vote = state.your_vote;

        actions.push({
            icon: action.increment.icon,
            color: your_vote === "increment" ?
            action.increment.color : null,
            text: your_vote === "increment" ?
            action.increment.undo_label : action.increment.label,
            onClick: "TODO",
        });
        if(action.decrement) {
            actions.push({
                icon: action.decrement.icon,
                color: your_vote === "decrement" ?
                action.decrement.color : null,
                text: your_vote === "decrement" ?
                action.decrement.undo_label : action.decrement.label,
                onClick: "TODO",
            });
        }
    }else{
        // assertNever(action);
    }

    return actions;
}

function getActions(post: Generic.PostContentPost, opts: ClientPostOpts): ActionItem[] {
    const actions: ActionItem[] = [];

    if(opts.frame?.url != null) {
        actions.push({
            icon: "link",
            color: null,
            text: post.info?.comments != null ? (
                post.info.comments.toLocaleString() + " comment"+(
                    post.info.comments === 1 ? "" : "s"
                )
            ) : (
                "Comments"
            ),
            onClick: {url: opts.frame.url},
        });
    }

    if(post.actions?.vote) {
        actions.push(...getActionsFromAction(post.actions.vote, opts));
    }

    if(opts.frame?.replies?.reply) {
        // if=props.content.show_replies_when_below_pivot && !props.opts.at_or_above_pivot
        // ?
        actions.push({
            icon: "reply",
            color: null,
            text: "Reply",
            onClick: "TODO",
        });
    }

    for(const action of post.actions?.other ?? []) {
        actions.push(...getActionsFromAction(action, opts));
    }

    if(post.actions?.code) {
        actions.push(...getActionsFromAction(post.actions.code, opts));
    }else{
        actions.push({
            icon: "code",
            color: null,
            text: "Code",
            onClick: () => {
                console.log(post, opts);
            },
        });
    }

    return actions;
}

function DropdownActionButton(props: {action: ActionItem}): JSX.Element {
    return <DropdownButton icon={
        <Icon
            icon={props.action.icon}
            label={props.action.text}
            bold={props.action.color != null}
        />
    } class={props.action.color == null ? undefined : "font-bold " + colorClass(props.action.color)}>
        {props.action.text}
    </DropdownButton>;
}

function HorizontalActionButton(props: {action: ActionItem}): JSX.Element {
    return <Button>
        <span class={
            props.action.color == null ? undefined : "font-bold " + colorClass(props.action.color)
        }>
            <Icon
                icon={props.action.icon}
                label={props.action.text}
                bold={props.action.color != null}
            />{" "}
            {props.action.text}
        </span>
    </Button>;
}

function getInfoBar(post: Generic.PostContentPost): InfoBarItem[] {
    const res: InfoBarItem[] = [];

    // TODO make the order user-configurable

    if(post.info?.pinned === true) {
        res.push({
            icon: "pinned",
            value: ["none", -1000],
            color: "green",
            text: "Pinned",
        });
    }
    if(post.actions?.vote) {
        const voteact = post.actions.vote;
        // TODO support other types of voting
        // eg: mastodon will be star/unstar so we should use a star icon
        // and yellow color
        // the vote thing should have a way to specify:
        // increment_icon, increment_color, decrement_icon, decrement_color
        const [stateR] = getCounterState(() => post.actions!.vote!);
        const state = stateR();
        const pt_count = state.pt_count;
        res.push({
            value: pt_count === "hidden"
            ? ["hidden", -1000] : pt_count === "none" ? ["none", -1000]
            : ["number", pt_count],
            icon: ({
                none: voteact.neutral_icon ?? voteact.increment.icon,
                increment: voteact.increment.icon,
                decrement: voteact.decrement?.icon ?? voteact.increment.icon,
            } as const)[state.your_vote ?? "none"],
            color: ({
                none: null,
                increment: voteact.increment.color,
                decrement: voteact.decrement?.color ?? voteact.increment.color,
            } as const)[state.your_vote ?? "none"],
            text: "Points",
        });
        if(post.actions.vote.percent != null) {
            res.push({
                icon: "controversiality",
                value: ["percent", post.actions.vote.percent],
                color: null,
                text: "Controversiality",
            });
        }
    }
    if(post.info?.comments != null) {
        res.push({
            icon: "comments",
            value: ["number", post.info.comments],
            color: null,
            text: "Comments",
        });
    }
    if(post.info?.creation_date != null) {
        res.push({
            icon: "creation_time",
            value: ["timeago", post.info.creation_date],
            color: null,
            text: "Posted",
        });
    }
    if(post.info?.edited) {
        res.push({
            icon: "edit_time",
            value: post.info.edited.date == null ? ["none", -1000] :
            ["timeago", post.info.edited.date],
            color: null,
            text: "Edited",
        });
    }

    // if(getSettings().dev_mode ==)
    // res.push({
    //     icon: "code",
    //     value: ["number", Date.now() % 999],
    //     color: null,
    //     text: "Random",
    // })

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
    const lblv = () => props.item.text+(props.item.value[0] === "none" ? "" : ":");

    return <span
        class={colorClass(props.item.color)}
        title={lblv() + fmt()[1]}
    >
        <Icon icon={props.item.icon} bold={props.item.color != null} label={lblv()} />
        {fmt()[0]}
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
    // wow this is sketchy because we're supporting posts that
    // aren't rendered from <ClientPage />
    const [transitionTarget, setTransitionTarget]: [Accessor<boolean>, Setter<boolean>] = (
    props.opts.collapse_data && props.opts.id) ?
    ((): [Accessor<boolean>, Setter<boolean>] => {
        if(props.opts.is_pivot) return createSignal(true);
        const cs = getCState(props.opts.collapse_data, props.opts.id);
        const setter: Setter<boolean> = (nv) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return !cs.setCollapsed((pv): boolean => {
                return !(typeof nv === "boolean" ? nv : nv(!pv));
            }) as any; // jkjckdnacjkdsnajkldkl
            // why is this setter type so messy aaaa
        };
        return [() => !cs.collapsed(), setter];
    })() : createSignal(
        props.opts.is_pivot ? true :
        (props.content.collapsible !== false ? (
            props.opts.is_pivot ? false :
            props.content.collapsible.default_collapsed
        ) : false) ? false :
        true,
    );
    const [selfVisible, setSelfVisible] = createSignal(transitionTarget());

    const [contentWarning, setContentWarning] = createSignal(
        !!(props.content.flair ?? []).find(flair => flair.content_warning),
    );
    const hasTitleOrThumbnail = () => {
        return !!props.content.thumbnail || !!props.content.title;
    };
    const hasThumbnail = () => {
        return !!props.content.thumbnail && !selfVisible();
    };

    const settings = getSettings();

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
            // note: can even consider <sm:text-xs
            // we'll probably want a font size config in the settings
            props.opts.is_pivot ? [
                "text-base m-2",
            ] : "text-sm",
            // "pt-10px",
            props.content.collapsible !== false ? "" : "pl-15px",
            "flex flex-row",
        )}
        style={{
            "--left-v": "8px",
        }}
    >
        <ShowBool when={props.content.collapsible !== false && (
            props.content.thumbnail != null ? selfVisible() ? true : false : true
        ) && !size_lt.sm()}>
            <div class={"flex flex-col items-center mr-1 gap-2 sm:pr-1"}>
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
                    real={true}
                    cstates={props.opts.collapse_data}
                    id={props.opts.id}
                />
            </div>
        </ShowBool>
        <div class="flex-1">
            <HSplit.Container dir="right" vertical="center">
                <ShowCond if={[!selfVisible()]} when={props.content.thumbnail}>{thumb_any => (
                    <ToggleColor>{color => (
                        <HSplit.Child>
                            <button class={classes(
                                "w-12 h-12 sm:w-16 sm:h-16 mr-4 rounded-md "+color,
                                contentWarning() && thumb_any.kind === "image" ? "thumbnail-content-warning" : "",
                                "block",
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
                        (props.opts.is_pivot && selfVisible()) ? "text-3xl" : "text-base",
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
                        "text-sm",
                        selfVisible() || hasThumbnail()
                        ? ""
                        : "filter grayscale text-$collapsed-header-color italic",
                    )}><HSplit.Container dir="right" vertical="center">
                        <HSplit.Child><div class={classes(
                            "mr-2",
                            hasThumbnail() ? "block" : "inline-block"
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
                            <ShowBool when={selfVisible() || hasTitleOrThumbnail()}>
                                <ShowCond when={props.content.author}>{author => <>
                                    <ShowCond when={author.flair}>{flair => <>
                                        <Flair flairs={flair} />{" "}
                                    </>}</ShowCond>
                                </>}</ShowCond>
                                <ShowCond when={props.content.info?.in}>{in_sr => <>
                                    {" in "}<LinkButton
                                        href={in_sr.link}
                                        style="previewable"
                                        client_id={in_sr.client_id}
                                    >{in_sr.name}</LinkButton>{" "}
                                </>}</ShowCond>
                            </ShowBool>
                        </div><ShowBool when={!props.opts.is_pivot || !selfVisible()}>
                            <div class="mr-2 inline-block">
                                <InfoBar post={props.content} />
                            </div>
                        </ShowBool></HSplit.Child>
                        <HSplit.Child fullwidth><div class="mr-2">
                            <ShowBool when={!(selfVisible() || hasTitleOrThumbnail())}>
                                <ShowBool when={true
                                    && props.content.collapsible !== false
                                    && props.content.collapsible.default_collapsed === true
                                } fallback={<>
                                    <div class="whitespace-normal max-lines max-lines-1">
                                        {"“" + (() => {
                                            const res = summarizeBody(props.content.body);
                                            if(res.length > 500) return res.substring(0, 500) + "…";
                                            return res;
                                        })() + "”"}
                                    </div>
                                </>}>
                                    <ShowCond when={props.content.actions?.vote} fallback={
                                        "[Collapsed by default]"
                                    }>{vote_action => <>
                                        <CounterCount counter={vote_action} />{" "}
                                    </>}</ShowCond>
                                </ShowBool>
                            </ShowBool>
                        </div></HSplit.Child>
                    </HSplit.Container></div>
                </HSplit.Child>
                <ShowBool when={!props.opts.is_pivot && (selfVisible() || hasThumbnail())}>
                    <HSplit.Child vertical="top">
                        <div class="pl-2" />
                        <Dropdown label={"…"}>
                            <div class="bg-gray-100 p-1 rounded-lg">
                                <For each={getActions(props.content, props.opts)}>{action => <>
                                    <DropdownActionButton action={action} />
                                </>}</For>
                            </div>
                        </Dropdown>
                    </HSplit.Child>
                </ShowBool>
            </HSplit.Container>
            <div style={{display: selfVisible() ? "block" : "none"}}><HideshowProvider
                visible={() => animState().visible || animState().animating}
            >
                <section class={props.opts.is_pivot ? "py-4" : ""}>
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
                <ShowBool when={props.opts.is_pivot}><div class="text-sm">
                    <InfoBar post={props.content} />
                    <div class="mt-2" />
                    <div class="flex flex-wrap gap-2">
                        <For each={getActions(props.content, props.opts)}>{action => <>
                            <HorizontalActionButton action={action} />
                        </>}</For>
                    </div>
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

// // eslint-disable-next-line @typescript-eslint/naming-convention
// const CollapseContext = createContext<CollapseData>();

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

export type ClientPageProps = {
    pivot: Generic.Link<Generic.Post>,
};
export default function ClientPage(props: ClientPageProps): JSX.Element {
    // [!] we'll want to fix this up and make it observable and stuff
    // now that page2 is ready to be properly observable, flatten should be too.

    const collapse_data: CollapseData = {
        map: new Map(),
    };

    const hprc = getWholePageRootContext();

    const view = createMergeMemo(() => {
        console.log("Reloading data!");
        return flatten(props.pivot, {
            collapse_data,
            content: hprc.content(),
        });
    }, {key: "id", merge: true});


    // TODO reconcile merge:true I think key:"key" but be careful
    // TODO don't delete old items from dom just hide them

    // ok I want to delete all the routing code so I can do hmr
    // it'd be really nice having hmr with clientpage
    // rn all the export vars are messing everything up in app

    // I should be able to move everything into an export function main() I think
    // life hack

    return <div class="m-4 <sm:mx-0">
        <For each={view.data.body}>{item => <SwitchKind item={item}>{{
            wrapper_start: () => <ToggleColor>{color => <div class={""
                + " " + color
                + " h-2 sm:rounded-xl mt-4"
            } style="border-bottom-left-radius: 0; border-bottom-right-radius: 0" />}</ToggleColor>,
            wrapper_end: () => <ToggleColor>{color => <div class={""
                + " " + color
                + " h-2 sm:rounded-xl mb-4"
            } style="border-top-left-radius: 0; border-top-right-radius: 0" />}</ToggleColor>,
            post: loader_or_post => <ToggleColor>{color => <div class={"px-2 "+color}>
                <div class="flex flex-row">
                    <ShowBool when={!size_lt.sm()} fallback={(
                        <ShowBool when={loader_or_post.indent.length > 0}><div
                            style={{
                                'margin-left': ((loader_or_post.indent.length - 3) * 0.25)+"rem",
                            }}
                            class={classes(
                                "w-1",
                                "mr-2",
                                "py-1",
                                "pl-0.5",
                            )}
                        >
                            <div class={classes(
                                "w-full h-full",
                                getRainbow(loader_or_post.indent.length - 1),
                                "rounded-md",
                            )}></div>
                        </div></ShowBool>
                    )}>
                        <For each={loader_or_post.indent}>{indent => <>
                            <CollapseButton
                                collapsed_raw={false}
                                collapsed_anim={false}
                                onClick={() => {
                                    const cs = getCState(collapse_data, indent.id);
                                    cs.setCollapsed(v => !v);
                                }}
                                real={false}
                                cstates={collapse_data}
                                id={indent.id}
                            />
                        </>}</For>
                    </ShowBool>
                    <div class="flex-1"><SwitchKind item={loader_or_post.content}>{{
                        post: post => <>
                            <ShowBool when={!loader_or_post.first_in_wrapper}>
                                <div class="pt-2" />
                            </ShowBool>
                            <ClientContentAny
                                content={post.content}
                                opts={{
                                    clickable: false, // TODO
                                    frame: post,
                                    client_id: post.client_id,
                                    replies: post.replies,
                                    at_or_above_pivot: loader_or_post.at_or_above_pivot,
                                    is_pivot: loader_or_post.is_pivot,
                                    collapse_data,
                                    id: loader_or_post.id,
                                }}
                            />
                        </>,
                        loader: loader => <div class="py-1">
                            <button
                                class="text-blue-500 hover:underline"
                                onClick={() => {
                                    // ok next thing to do:
                                    // TODO make a cancellable task thing
                                    // - if the task goes on for more than like 200ms,
                                    //   show it visibly in a little notifictation like a
                                    //   loading icon in the bottom right corner you can
                                    //   click to expand and view tasks
                                    // - if it errors, show a full notification of the
                                    //   error
                                    //
                                    // while loading:
                                    // - disable the loader and make it visibly appear
                                    //   to be loading

                                    getClientCached(loader.client_id)!.loader!(loader_or_post.id, loader).then(r => {
                                        console.log("adding content", r.content, loader_or_post);
                                        hprc.addContent(r.content);
                                    }).catch(e => {
                                        console.log(e);
                                        alert("Error; Load failed; "+e.toString());
                                    });
                                }}
                            >
                                Load More ({loader.load_count ?? "????"})
                            </button>
                        </div>,
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
