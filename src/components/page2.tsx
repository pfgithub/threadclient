import { createMemo, createSignal, For, JSX, untrack } from "solid-js";
import {
    allowedToAcceptClick,
    bioRender, clientContent, link_styles_v, navigate
} from "../app";
import type * as Generic from "../types/generic";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import {
    classes, DefaultErrorBoundary, getClient, getSettings, HideshowProvider,
    kindIs, ShowBool, ShowCond, SwitchKind, TimeAgo, ToggleColor
} from "../util/utils_solid";
import { PostActions } from "./action";
import { animateHeight, ShowAnimate } from "./animation";
import { Body } from "./body";
import { CounterCount } from "./counter";
import { A, LinkButton, UserLink } from "./links";
import { ReplyEditor } from "./reply";

export type ClientPostOpts = {
    clickable: boolean,
    frame: Generic.PostData | null,
    replies: Generic.ListingData | null,
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
            class={flair.system != null ? flair.system : ("rounded-full px-2"
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
    fallback?: (err: string) => JSX.Element,
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

type ClientPostReplyProps = {reply: Generic.ListingEntry, is_threaded: boolean};
function ClientPostReply(props: ClientPostReplyProps): JSX.Element {
    const isThreaded = createMemo(() => (
        (props.is_threaded || undefined) && kindIs(props.reply, "post")?.post.ref?.replies?.items
    ));

    return <>
        <li class={classes(
            props.reply.kind === "post" ? "comment" : [],
            props.is_threaded ? ["relative", "threaded"] : [],
        )}>
            <SwitchKind item={props.reply}>{{
                post: post_link => (
                    <ErrableLink link={post_link.post}>{post => (
                        <ClientPost content={post.content as Generic.PostContentPost} opts={{
                            clickable: false,
                            at_or_above_pivot: false,
                            is_pivot: false,
                            frame: post,
                            replies: isThreaded()?.length === 1 ? null : post.replies, // TODO support threading
                            top_level: false,
                        }} />
                    )}</ErrableLink>
                ),
                load_more: () => <>TODO load more</>
            }}</SwitchKind>
        </li>
        <ShowBool when={isThreaded()?.length === 1}>{
            <ClientPostReply reply={isThreaded()![0]!} is_threaded={true} />
        }</ShowBool>
    </>;
}

export type ClientPostProps = {content: Generic.PostContentPost, opts: ClientPostOpts};
function ClientPost(props: ClientPostProps): JSX.Element {
    const [selfVisible, setSelfVisible] = createSignal(
        props.opts.is_pivot ? true :
        props.content.collapsible !== false ? !props.content.collapsible.default_collapsed :
        true,
    );
    const [contentWarning, setContentWarning] = createSignal(
        !!(props.content.flair ?? []).find(flair => flair.content_warning),
    );
    const collapseButton = () => {
        return props.content.collapsible === false ? false : true;
    };
    const hasTitleOrThumbnail = () => {
        return !!props.content.thumbnail || !!props.content.title;
    };
    const hasThumbnail = () => {
        return !!props.content.thumbnail;
    };
    const [replyWindowOpen, setReplyWindowOpen] = createSignal<Generic.ReplyAction | null>(null);

    const settings = getSettings();
    const client = getClient();

    const [transitionTarget, setTransitionTarget] = createSignal(selfVisible());
    const [animState, setAnimState] = createSignal<{visible: boolean, animating: boolean}>({
        visible: selfVisible(),
        animating: false,
    });

    const postIsClickable = () => {
        return props.opts.frame?.url != null && !props.opts.is_pivot;
    };
    
    return <div
        ref={node => animateHeight(node, settings, transitionTarget, (state, rising, animating) => {
            setAnimState({visible: rising || state, animating});
            setSelfVisible(state || rising);
        })}
        class={classes(
            "text-sm",
            // selfVisible()
            // props.content.show_replies_when_below_pivot !== false
            "pt-10px",
            collapseButton() ? (props.opts.top_level ? "pl-1" : "") : "pl-15px",
            "flex flex-row",

            props.opts.top_level ? "-mt-10px -ml-10px" : [],
        )}
        style={{
            "--left-v": "8px",
        }}
    >
        <ShowBool when={collapseButton()}>
            <button style={{bottom: "0"}} class="collapse-btn z-1 static mr-1" classList={{
                'collapsed': !selfVisible(),
            }} draggable={true} onClick={(e) => {
                setTransitionTarget(t => !t);
            }}>
                <div class="collapse-btn-inner"></div>
            </button>
        </ShowBool>
        <div class="flex-1">
            <div
                class={(postIsClickable() ? "hover-outline" : "") + " flex flex-row"}
                // note: screenreader or keyboard users must click the 'view' button
                // or the title if there is one.
                // I considered making the "x points x hours ago" a link but it's harder
                // to do than it should be because of the {" "} and {", "} those get underlined
                onclick={e => {
                    if(!postIsClickable()) return;
                    if(!allowedToAcceptClick(e.target as Node, e.currentTarget)) return;
                    e.stopPropagation();
                    // support ctrl click
                    const target_url = "/"+client().id+props.opts.frame?.url;
                    if(e.ctrlKey || e.metaKey || e.altKey) {
                        window.open(target_url);
                    }else{
                        navigate({path: target_url});
                    }
                }}
            >
                <ShowCond when={props.content.thumbnail}>{thumb_any => (
                    <button class={classes(
                        "w-70px h-70px mr-4",
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
                )}</ShowCond>
                <div class="flex-1">
                    <div class={classes(
                        hasTitleOrThumbnail() ? "text-base" : "text-xs",
                    )}>
                        <ShowCond when={props.content.title}>{title => (
                            <ShowCond when={props.opts.frame?.url} fallback={(
                                title.text
                            )}>{url => (
                                <A href={url} class="hover:underline">{title.text}</A>
                            )}</ShowCond>
                        )}</ShowCond>
                        <Flair flairs={props.content.flair ?? []} />
                    </div>
                    <div class={classes(
                        hasTitleOrThumbnail() ? "" : "text-xs",
                        selfVisible() || hasThumbnail() ? "" : "filter grayscale text-$collapsed-header-color italic",
                    )}>
                        <ShowCond when={props.content.author}>{author => <>
                            <ShowCond if={[
                                selfVisible() && settings.author_pfp.value() === "on",
                            ]} when={author.pfp} fallback={"By "}>{pfp => <>
                                <AuthorPfp src_url={pfp.url} />{" "}
                            </>}</ShowCond>
                            <UserLink href={author.link} color_hash={author.color_hash}>
                                {author.name}{" "}
                            </UserLink>
                            <ShowCond when={author.flair}>{flair => <>
                                <Flair flairs={flair} />{" "}
                            </>}</ShowCond>
                        </>}</ShowCond>
                        <ShowCond when={props.content.info?.in}>{in_sr => <>
                            {" in "}<LinkButton href={in_sr.link} style="normal">{in_sr.name}</LinkButton>{" "}
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
                    </div>
                    <ShowBool when={hasThumbnail()}><div class={hasTitleOrThumbnail() ? "" : "text-xs"}>
                        <PostActions
                            content={props.content}
                            opts={props.opts}
                            replyWindowOpen={[replyWindowOpen, setReplyWindowOpen]}
                        />
                    </div></ShowBool>
                </div>
            </div>
            <div style={{display: selfVisible() ? "block" : "none"}}><HideshowProvider visible={transitionTarget}>
                <div>
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
                </div>
                <ShowBool when={!hasThumbnail()}><div class={hasTitleOrThumbnail() ? "" : "text-xs"}>
                    <PostActions
                        content={props.content}
                        opts={props.opts}
                        replyWindowOpen={[replyWindowOpen, setReplyWindowOpen]}
                    />
                </div></ShowBool>
                <ShowCond when={replyWindowOpen()}>{reply_editor => (
                    <ReplyEditor
                        action={reply_editor} 
                        onCancel={() => setReplyWindowOpen(null)}
                        onAddReply={() => {
                            setReplyWindowOpen(null);
                            // TODO show the reply in the tree
                        }}
                    />
                )}</ShowCond>
                <ShowBool when={!!(!props.opts.at_or_above_pivot && props.opts.replies)}>
                    <ShowCond when={props.opts.replies}>{replies => <ShowBool
                        when={props.content.show_replies_when_below_pivot !== false}
                    >
                        <ul class="-ml-3px">
                            <For each={replies.items}>{reply => (
                                // - if replies.items is 1, maybe thread replies?
                                <ClientPostReply reply={reply} is_threaded={replies.items.length === 1} />
                            )}</For>
                        </ul>
                    </ShowBool>}</ShowCond>
                </ShowBool>
            </HideshowProvider></div>
        </div>
    </div>;
}

export type ClientContentProps = {listing: Generic.PostContent, opts: ClientPostOpts};
export function ClientContent(props: ClientContentProps): JSX.Element {
    const todosupport = (thing: unknown) => <>
        TODO support. also in the parent list these should probably{" "}
        be one of those navbars with bits like ClientName {">"} PageName {">"} …{" "}
        <button on:click={() => console.log(thing)}>code</button>
    </>;
    return <div>
        <DefaultErrorBoundary data={[props.listing, props.opts]}>
            <SwitchKind item={props.listing}>{{
                page: thing => todosupport(thing),
                client: thing => todosupport(thing),
                post: (post) => <>
                    <ClientPost content={post} opts={props.opts} />
                </>,
                legacy: legacy => <SolidToVanillaBoundary getValue={(hsc, client): HTMLElement => {
                    // clientContent(client, r, {clickable: false}).defer(hsc).adto(el("div").adto(content_buttons_line));
                    // return clientContent()
                    //                             clientContent(client, r, {clickable: false}).defer(hsc).adto(el("div").adto(content_buttons_line));
                    return clientContent(client(), legacy.thread, {clickable: props.opts.clickable}).defer(hsc);
                }}/>,
            }}</SwitchKind>
        </DefaultErrorBoundary>
    </div>;
}

export type ClientPageProps = {page: Generic.Page2};
export function ClientPage(props: ClientPageProps): JSX.Element {
    const [showReplyEditor, setShowReplyEditor] = createSignal(false);
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
                            class={link_styles_v["pill-empty"]} onClick={() => setShowReplyEditor(true)}
                        >Write Reply</button>
                    </div>
                }>
                    <ReplyEditor action={reply_action} onCancel={() => {
                        setShowReplyEditor(false);
                    }} onAddReply={() => {
                        setShowReplyEditor(false);
                        // TODO
                    }} />
                </ShowAnimate>
            )}</ShowCond>
            <div class="mb-6"></div>
            {/*TODO put the sorting options here*/null}
            <For each={replies.items} fallback={<div>*There are no replies*</div>}>{reply => (
                <SwitchKind item={reply}>{{
                    post: post => (
                        <TopLevelWrapper>
                            <ClientContent listing={post.post.ref!.content} opts={{
                                clickable: false, // TODO
                                frame: post.post.ref!,
                                replies: post.post.ref!.replies,
                                at_or_above_pivot: false,
                                top_level: true,
                                is_pivot: false,
                            }} />
                        </TopLevelWrapper>
                    ),
                    load_more: () => {
                        throw new Error("todo load more");
                    },
                }}</SwitchKind>
            )}</For>
        </>}</ShowCond>
    </WrapParent>;
}

export function TopLevelWrapper(props: {children: JSX.Element, restrict_w?: boolean}): JSX.Element {
    return <ToggleColor>{(color, i) => <div class={
        (i === 0 ? "object-wrapper" : "p-10px mt-10px rounded-xl")
        + " " + color
        + " " + (props.restrict_w ?? false ? "max-w-xl" : "")
    }>{props.children}</div>}</ToggleColor>;
}

// you know what'd be interesting?
// what if the Client post in a post's parent list actually contained the client to use to render it
// not going to do that but it could be interesting
function WrapParent(props: {node: Generic.ParentPost, children: JSX.Element, is_pivot: boolean}): JSX.Element {
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
                                replies: post_root.replies,
                                at_or_above_pivot: true,
                                top_level: true,
                                is_pivot: props.is_pivot,
                            }} />
                        </TopLevelWrapper>
                    ),
                    page: page => (
                        <TopLevelWrapper>
                            <SolidToVanillaBoundary getValue={(hsc, client) => {
                                const frame = el("div").clss("post text-sm").styl({
                                    margin: "-10px",
                                    padding: "10px",
                                });
                                bioRender(client(), page.wrap_page.header, frame).defer(hsc);
                                return frame;
                            }} />
                        </TopLevelWrapper>
                    ),
                    legacy: () => <>TODO legacy</>,
                    client: () => <>TODO client</>,
                }}</SwitchKind>
            ),
            vloader: () => <>TODO vloader</>,
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
