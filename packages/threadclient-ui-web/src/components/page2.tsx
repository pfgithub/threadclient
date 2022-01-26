import type * as Generic from "api-types-generic";
import { createEffect, createMemo, createSignal, For, JSX, untrack } from "solid-js";
import { flatten } from "threadclient-render-flatten";
import { allowedToAcceptClick, ShowBool, ShowCond, SwitchKind, TimeAgo } from "tmeta-util-solid";
import { clientContent, clientListing, getClientCached, link_styles_v, navigate } from "../app";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import {
    classes, DefaultErrorBoundary, getPageRootContext, getSettings, HideshowProvider,
    screenWidth, screen_size, ToggleColor
} from "../util/utils_solid";
import { PostActions } from "./action";
import { animateHeight, ShowAnimate } from "./animation";
import { Body, summarizeBody } from "./body";
import { CounterCount, VerticalIconCounter } from "./counter";
import { A, LinkButton, UserLink } from "./links";

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

export type ClientPostProps = {content: Generic.PostContentPost, opts: ClientPostOpts};
function ClientPost(props: ClientPostProps): JSX.Element {
    const default_collapsed = props.content.collapsible !== false ? props.content.collapsible.default_collapsed : false;
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

    const [showActions, setShowActions] = createSignal(false);
    const mobile = () => screenWidth() < screen_size.sm;
    createEffect(() => {
        if(!mobile()) setShowActions(false);
    });

    const postIsClickable = () => {
        return props.opts.frame?.url != null && !props.opts.is_pivot;
    };
    
    const [localReplies, setLocalReplies] = createSignal<Generic.Link<Generic.Post>[]>([]);
    const onAddReply = (reply: Generic.Link<Generic.Post>) => {
        setLocalReplies(l => [reply, ...l]);
    };

    () => localReplies;

    return <article
        ref={node => animateHeight(node, settings, transitionTarget, (state, rising, animating) => {
            setAnimState({visible: rising || state, animating});
            setSelfVisible(state || rising);
        })}
        class={classes(
            "text-sm",
            "pt-10px",
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
        <ShowBool when={props.content.collapsible !== false}>
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
            <div class="flex flex-row">
                <ShowCond when={props.content.thumbnail}>{thumb_any => (
                    <ToggleColor>{color => (
                        <button class={classes(
                            "w-50px h-50px sm:w-70px sm:h-70px mr-4 rounded-md "+color,
                            contentWarning() && thumb_any.kind === "image" ? "thumbnail-content-warning" : "",
                        )} onClick={() => setTransitionTarget(t => !t)}>
                            <SwitchKind item={thumb_any}>{{
                                image: img => <img
                                    // TODO based on the img content, display eg a play button or something
                                    src={img.url}
                                    alt=""
                                    class={classes(
                                        "w-full h-full object-contain"
                                    )}
                                />,
                                default: def => <>TODO {def.kind}</>,
                            }}</SwitchKind>
                        </button>
                    )}</ToggleColor>
                )}</ShowCond>
                <div
                    class={"flex-1" + (postIsClickable() ? " hover-outline" : "")}
                    // note: screenreader or keyboard users must click the 'view' button
                    // or the title if there is one.
                    // I considered making the "x points x hours ago" a link but it's harder
                    // to do than it should be because of the {" "} and {", "} those get underlined
                    onclick={e => {
                        if(!postIsClickable()) return;
                        if(!allowedToAcceptClick(e.target as Node, e.currentTarget)) return;
                        e.stopPropagation();
                        // support ctrl click
                        const target_url = "/"+props.opts.client_id+props.opts.frame?.url;
                        if(e.ctrlKey || e.metaKey || e.altKey) {
                            window.open(target_url);
                        }else{
                            navigate({
                                path: target_url,
                                // page: props.opts.frame ? {pivot: {ref: props.opts.frame}} : undefined,
                                // disabling this for now, we'll fix it in a bit
                                // we just need to know what the link to the post is in the
                                // post itself
                            });
                        }
                    }}
                >
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
                            <ShowCond when={props.content.actions?.vote}>{vote_action => <>
                                <CounterCount counter={vote_action} />{" "}
                            </>}</ShowCond>
                            <ShowCond when={props.content.info}>{content_info => <>
                                <ShowCond when={content_info.creation_date}>{created => <>
                                    <TimeAgo start={created} />{" "}
                                </>}</ShowCond>
                                <ShowCond when={content_info.edited}>{edited => <>
                                    {"Edited"}<ShowCond when={edited.date}>{edited_date => <>
                                        {" "}<TimeAgo start={edited_date} />
                                    </>}</ShowCond>{" "}
                                </>}</ShowCond>
                                <ShowBool when={content_info.pinned ?? false}>{<>
                                    <span class="text-green-600 dark:text-green-500">Pinned</span>{" "}
                                </>}</ShowBool>
                            </>}</ShowCond>
                            <ShowBool when={mobile()}>
                                <button
                                    class={link_styles_v["outlined-button"]}
                                    onclick={() => setShowActions(v => !v)}
                                >{showActions() ? "▾" : "▸"}</button>
                            </ShowBool>
                        </ShowBool>
                    </div>
                    <ShowBool when={hasThumbnail() && !mobile()}><div class={hasTitleOrThumbnail() ? "" : "text-xs"}>
                        <PostActions
                            content={props.content}
                            opts={props.opts}
                            onAddReply={onAddReply}
                        >
                            <div><button
                                class={link_styles_v["outlined-button"]}
                                onclick={() => setTransitionTarget(t => !t)}
                            >
                                {transitionTarget() ? "Hide" : "Show"}
                            </button></div>
                        </PostActions>
                    </div></ShowBool>
                </div>
            </div>
            <ShowAnimate when={mobile() && showActions()}>
                <PostActions
                    content={props.content}
                    opts={props.opts}
                    onAddReply={onAddReply}
                />
            </ShowAnimate>
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
                <ShowBool when={!hasThumbnail() && !mobile()}><div class={hasTitleOrThumbnail() ? "" : "text-xs"}>
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
                    <div class="flex-1"><SwitchKind item={loader_or_post.content}>{{
                        post: post => <ClientContentAny
                            content={post.content}
                            opts={{
                                clickable: false, // TODO
                                frame: post,
                                client_id: post.client_id,
                                replies: post.replies,
                                at_or_above_pivot: false,
                                top_level: false,
                                is_pivot: false,
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
