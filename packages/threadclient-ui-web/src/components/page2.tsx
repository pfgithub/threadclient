import type * as Generic from "api-types-generic";
import { createEffect, createMemo, createSignal, For, JSX, untrack } from "solid-js";
import { allowedToAcceptClick, ShowBool, ShowCond, SwitchKind, TimeAgo } from "tmeta-util-solid";
import {
    bioRender, clientContent, clientListing, getClientCached, link_styles_v, navigate
} from "../app";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import {
    classes, DefaultErrorBoundary, getSettings, HideshowProvider,
    screenWidth, screen_size, ToggleColor
} from "../util/utils_solid";
import { PostActions } from "./action";
import { animateHeight, ShowAnimate } from "./animation";
import { Body, summarizeBody } from "./body";
import { CounterCount, VerticalIconCounter } from "./counter";
import { A, LinkButton, UserLink } from "./links";
import { ReplyEditor } from "./reply";

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

function ErrableLink<T,>(props: {
    link: Generic.Link<T>,
    fallback?: undefined | ((err: string) => JSX.Element),
    children: (link: T) => JSX.Element,
}) {
    return <ShowBool when={props.link.err == null} fallback={
        props.fallback ? (
            untrack(() => props.fallback!(props.link.err!))
        ) : <div>Error! {props.link.err}</div>
    }>
        {untrack(() => props.children(props.link.ref!))}
    </ShowBool>;
}

type ClientPostReplyProps = {
    reply: Generic.Link<Generic.Post>,
    is_threaded: boolean,
    parent_is_threaded?: undefined | boolean,
};
export function ClientPostReply(props: ClientPostReplyProps): JSX.Element {
    const isThreaded = createMemo((): Generic.Link<Generic.Post> | undefined => {
        if(!props.is_threaded) return undefined;
        const res = props.reply.ref?.replies?.items;
        if(res && res.length === 1) {
            return res[0]!;
        }
        return undefined;
    });
    // this threading logic is a bit complicated and it requires
    // hiding the replies from the ClientPost that gets rendered.
    // if you can find a way to improve the threading logic or
    // maybe have the ClientPost render its replies threaded
    // if it is threaded itself, that would probably be an
    // improvement.
    // eg: it would make it easier to do the onreplied function
    // of the reply action because a post could just keep a state
    // of "your replies" and then when it's rendering replies,
    // render [...yours, ...post's] and this wouldn't run into
    // issues when the post is threaded.

    // TODO:
    // this threading logic causes a comment to rerender if it becomes no longer threaded
    // to fix this, don't use <ul>/<li> for the comments
    // instead, display them in a vertical list and adjust the left indent based on the
    // depth of the comment.
    // this will negatively affect screenreader functionality, so aria roles will probably
    // be required
    // alternatively: put them in the <li> but:
    // - only extend the collapse button of the parent comment to the bottom of its actual content
    // - don't hide its replies when collapsing
    // - this seems complicated but nicer
    // - although the above method has the upside that it can work very well with virtual scrolling

    return <>
        <li class={classes(
            // "comment",
            props.is_threaded && (
                isThreaded() != null || (props.parent_is_threaded ?? false)
            ) ? ["relative", "threaded"] : [],
        )}>
            <ErrableLink link={props.reply}>{post => (
                <SwitchKind item={post}>{{
                    post: content_post => (
                        <ClientContentAny content={content_post.content} opts={{
                            clickable: false,
                            at_or_above_pivot: false,
                            is_pivot: false,
                            frame: content_post,
                            client_id: content_post.client_id,
                            replies: isThreaded() != null ? null : post.replies,
                            top_level: false,
                        }} />
                    ),
                    loader: () => <>TODO load more TODO load more may have replies</>
                }}</SwitchKind>
            )}</ErrableLink>
        </li>
        <ShowCond when={isThreaded()}>{thread => (
            <ClientPostReply reply={thread} is_threaded={true} parent_is_threaded={true} />
        )}</ShowCond>
    </>;
}

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
                <button class="flex-1 collapse-btn z-1 static outline-default" classList={{
                    'collapsed': !selfVisible(),
                }} draggable={true} onClick={(e) => {
                    setTransitionTarget(t => !t);
                }} aria-label="Collapse" aria-pressed={!transitionTarget()}>
                    <div class="collapse-btn-inner"></div>
                </button>
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
                            navigate({path: target_url});
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
                <ShowBool when={!props.opts.at_or_above_pivot}>
                    <ShowCond when={props.opts.replies}>{post_replies => {
                        const replies = createMemo(() => [...localReplies(), ...post_replies.items]);
                        return <ShowBool
                            when={props.content.show_replies_when_below_pivot !== false}
                        >
                            <ul class="-ml-3px">
                                <For each={replies()}>{reply => (
                                    // - if replies.items is 1, maybe thread replies?
                                    <ClientPostReply reply={reply} is_threaded={replies().length === 1} />
                                )}</For>
                            </ul>
                        </ShowBool>;
                    }}</ShowCond>
                </ShowBool>
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

export type ClientPageProps = {page: Generic.Page2};
export function ClientPage(props: ClientPageProps): JSX.Element {
    const [showReplyEditor, setShowReplyEditor] = createSignal(false);

    const [localReplies, setLocalReplies] = createSignal<Generic.Link<Generic.Post>[]>([]);

    // TODO set page title
    // using a store or something

    // ok recursive
    // going up:
    // - wrap a post in parent posts until the top is reached (inverse, starting from this post and going up)
    // going down:
    // - loop over replies like normal
    // - note that eg with mastodon, a child's parent might not be the pivot

    // might be nice to merge parents into one block thing idk

    // also WrapParent is going to be bad for perf, it should eventually be turned into a list thing
    // should be fine for now though, only bad when modifying parent lists eg loading more

    // it should be index for replies right? actually should be for jk
    return <WrapParent node={props.page.pivot.ref!} is_pivot={true}>
        <ShowCond when={props.page.pivot.ref!.replies}>{replies => <>
            <hr class="my-2 border-t-2" style={{'border-top-color': "var(--collapse-line-color)"}} />
            <ShowCond when={replies.reply}>{reply_action => (
                <ShowAnimate when={showReplyEditor()} fallback={
                    <div>
                        <button
                            class={link_styles_v["pill-empty"]} onClick={() => {
                                setShowReplyEditor(true);
                            }}
                            disabled={reply_action.locked}
                        >Write Reply{reply_action.locked ? " (Locked)" : ""}</button>
                    </div>
                }>
                    <ReplyEditor action={reply_action.action} onCancel={() => {
                        setShowReplyEditor(false);
                    }} onAddReply={(reply) => {
                        setShowReplyEditor(false);
                        setLocalReplies(lr => [reply, ...lr]);
                    }} />
                </ShowAnimate>
            )}</ShowCond>
            <div class="mb-6"></div>
            {/*TODO put the sorting options here*/null}
            <For
                each={[...localReplies(), ...replies.items]}
                fallback={<div>*There are no replies*</div>}
            >{reply_link => (
                <ErrableLink link={reply_link}>{reply => (
                    <SwitchKind item={reply}>{{
                        post: post => (
                            <TopLevelWrapper>
                                <ShowBool
                                    when={post.parent !== props.page.pivot}
                                    // maybe do some WrapParent but all things have to not be above pivot?
                                >
                                    TODO parent posts
                                </ShowBool>
                                <ClientContentAny content={post.content} opts={{
                                    clickable: false, // TODO
                                    frame: post,
                                    client_id: post.client_id,
                                    replies: post.replies,
                                    at_or_above_pivot: false,
                                    top_level: true,
                                    is_pivot: false,
                                }} />
                            </TopLevelWrapper>
                        ),
                        loader: (loader) => <>
                            ok this is easy
                            render the loader
                            render the children
                            onclick load and then rerender
                            TODO load more <button onclick={() => console.log(loader)}>code</button>
                        </>,
                    }}</SwitchKind>
                )}</ErrableLink>
            )}</For>
        </>}</ShowCond>
    </WrapParent>;
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

// you know what'd be interesting?
// what if the Client post in a post's parent list actually contained the client to use to render it
// not going to do that but it could be interesting
function WrapParent(props: {node: Generic.Post, children: JSX.Element, is_pivot: boolean}): JSX.Element {
    // () => in order to capture any .Provider nodes in a parent
    const content = () => <>
        <SwitchKind item={props.node}>{{
            post: post_root => (
                <SwitchKind item={post_root.content}>{{
                    post: post => (
                        <TopLevelWrapper>
                            <ClientContent listing={post} opts={{
                                clickable: !props.is_pivot,
                                frame: post_root,
                                client_id: post_root.client_id,
                                replies: post_root.replies,
                                at_or_above_pivot: true,
                                top_level: true,
                                is_pivot: props.is_pivot,
                            }} />
                        </TopLevelWrapper>
                    ),
                    page: page => (
                        <TopLevelWrapper>
                            <SolidToVanillaBoundary getValue={hsc => {
                                const frame = el("div").clss("post text-sm").styl({
                                    margin: "-10px",
                                    padding: "10px",
                                });
                                bioRender(page.wrap_page.header, frame).defer(hsc);
                                return frame;
                            }} />
                        </TopLevelWrapper>
                    ),
                    legacy: legacy => <>TODO legacy in wrapParent</>,
                    client: () => <>TODO client</>,
                }}</SwitchKind>
            ),
            loader: () => <>TODO loader</>,
        }}</SwitchKind>
        {props.children}
    </>;
    return <>
        <ShowCond when={props.node.parent} fallback={
            content()
        } children={parent_link => {
            return <ErrableLink link={parent_link} fallback={err_msg => <>
                <div>Error: {err_msg}</div>
                <div>{content()}</div>
            </>} children={parent => (
                <WrapParent node={parent} children={content()} is_pivot={false} />
            )} />;
        }} />
    </>;
}
