import {
    createEffect, createMemo, createSignal, ErrorBoundary,
    For, JSX, onCleanup, untrack
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import {
    bioRender, clientContent, link_styles_v, navbar, renderAction, timeAgoText
} from "../app";
import type * as Generic from "../types/generic";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import { classes, getClient, HideshowProvider, kindIs, ShowBool, ShowCond, SwitchKind } from "../util/utils_solid";
import { Body } from "./body";
import { CounterCount } from "./counter";
import { UserLink } from "./links";
export * from "../util/interop_solid";

export type ClientPostOpts = {
    clickable: boolean,
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
        class="w-8 h-8 object-center inline-block cfg-reddit-pfp rounded-full"
    />;
}

export function TimeAgo(props: {start: number}): JSX.Element {
    const [now, setNow] = createSignal(Date.now());
    const label = createMemo(() => {
        const res_text = timeAgoText(props.start, now());
        if(res_text[1] > 0) {
            const timeout = setTimeout(() => setNow(Date.now()), res_text[1] + 10);
            onCleanup(() => clearTimeout(timeout));
        }
        return res_text[0];
    });
    return <span title={"" + new Date(props.start)}>{label}</span>;
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
                    width={emoji.w + "px"} height={emoji.h + "px"}
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
        props.content.show_replies_when_below_pivot !== false
        ? !props.content.show_replies_when_below_pivot.default_collapsed
        : true
    );
    const [bodyVisible, setBodyVisible] = createSignal<boolean | undefined>(undefined);
    const defaultBodyVisible = createMemo((): boolean => {
        if(props.opts.is_pivot) return true;
        const collapsible = props.content.title?.body_collapsible;
        if(collapsible == null || collapsible === false) return false;
        return collapsible.default_collapsed;
    });
    const bodyToggleable = createMemo(() => {
        const body_collapsible = props.content.title?.body_collapsible;
        if(body_collapsible == null || body_collapsible === false) return false;
        return true;
    });
    return <div
        class={classes(
            "post text-sm",
            props.content.show_replies_when_below_pivot !== false ? [
                "layout-reddit-comment",
                "layout-commentlike",
            ] : [],
            selfVisible() ? [] : "comment-collapsed",

            "-ml-10px",
            props.opts.top_level ? "-mt-10px" : [],
        )}
    >
        <ShowBool when={props.content.show_replies_when_below_pivot !== false}>
            <button style={{bottom: "0"}} class="collapse-btn z-1" draggable={true} on:click={(e) => {
                const collapsed_button = e.currentTarget;
                const topv = collapsed_button.getBoundingClientRect().top;
                const heightv = 5 + navbar.getBoundingClientRect().height;
                if(topv < heightv) {collapsed_button.scrollIntoView(); document.documentElement.scrollTop -= heightv}

                setSelfVisible(!selfVisible());
            }}>
                <div class="collapse-btn-inner"></div>
            </button>
        </ShowBool>
        <div class="post-content-subminfo">
            <ShowCond when={props.content.title}>{title => (
                <div>{title.text}</div>   
            )}</ShowCond>
            <ShowCond when={props.content.author?.pfp}>{pfp => <>
                <AuthorPfp src_url={pfp.url} />{" "}
            </>}</ShowCond>
            <ShowCond when={props.content.author}>{author => (
                <UserLink href={author.link} color_hash={author.color_hash}>
                    {author.name}
                </UserLink>
            )}</ShowCond>
            <ShowCond when={props.content.author?.flair}>{flair => <>
                {" "}<Flair flairs={flair} />
            </>}</ShowCond>
            <ShowCond when={props.content.actions?.vote}>{vote_action => <>
                {" "}<CounterCount counter={vote_action} />
            </>}</ShowCond>
        </div>
        <HideshowProvider visible={selfVisible}>
            <div class="post-preview">
                {/*working around a solid bug where !! is used on the lhs of a ??. should be fixed soon*/null}
                <ShowBool when={(void 0, bodyVisible() ?? defaultBodyVisible())}>
                    <Body body={props.content.body} autoplay={false} />
                </ShowBool>
            </div>
            <div class="post-content-buttons text-xs">
                <ShowBool when={bodyToggleable()}>
                    <button on:click={() => setBodyVisible(!(bodyVisible() ?? defaultBodyVisible()))}>
                        {bodyVisible() ?? defaultBodyVisible() ? "Hide" : "Show"}
                    </button>
                </ShowBool>
                <button on:click={() => {
                    console.log(props.content, props.opts);
                }}>Code</button>
                <ShowCond when={props.opts.replies?.reply}>{(reply_action) => {
                    const [replyWindowOpen, setReplyWindowOpen] = createSignal(false);

                    return <>
                        <button disabled={replyWindowOpen()} on:click={() => {
                            setReplyWindowOpen(true);
                        }}>{reply_action.text}</button>
                        <ShowBool when={replyWindowOpen()}>
                            <ReplyEditor
                                action={reply_action} 
                                onCancel={() => setReplyWindowOpen(false)}
                                onAddReply={() => {
                                    setReplyWindowOpen(false);
                                    //
                                }}
                            />
                        </ShowBool>
                    </>;
                }}</ShowCond>
                <ShowCond when={props.content.actions && props.content.actions.other}>{other_actions => <>
                    <For each={other_actions}>{(item, i) => <>
                        <Action action={item} />
                    </>}</For>
                </>}</ShowCond>
            </div>
            <ShowBool when={!!(!props.opts.at_or_above_pivot && props.opts.replies)}>
                <ShowCond when={props.opts.replies}>{replies => <ShowBool
                    when={props.content.show_replies_when_below_pivot !== false}
                >
                    <ul class="post-replies">
                        <For each={replies.items}>{reply => (
                            // - if replies.items is 1, maybe thread replies?
                            <ClientPostReply reply={reply} is_threaded={replies.items.length === 1} />
                        )}</For>
                    </ul>
                </ShowBool>}</ShowCond>
            </ShowBool>
        </HideshowProvider>
    </div>;
}

export function Action(props: {action: Generic.Action}): JSX.Element {
    return <SolidToVanillaBoundary getValue={(hsc, client) => {
        const span = el("span");
        renderAction(client(), props.action, span, {value_for_code_btn: 0}).defer(hsc);
        return span;
    }} />;
}

type StoreTypeValue = {value: null | Generic.PostContent};
export function ReplyEditor(props: {
    action: Generic.ReplyAction,
    onCancel: () => void,
    onAddReply: (response: Generic.Node) => void,
}): JSX.Element {
    const client = getClient();
    const [content, setContent] = createSignal("");

    const [isSending, setSending] = createSignal(false);
    const [sendError, setSendError] = createSignal<string | undefined>(undefined);

    const [diffable, setDiffable] = createStore<StoreTypeValue>({value: null});
    createEffect(() => {
        const resv: Generic.PostContent = client().previewReply(content(), props.action.reply_info);
        setDiffable(reconcile<StoreTypeValue>({value: resv}, {merge: true}));
        // this does well but unfortunately it doesn't know what to use as keys for lists and it can't really know
        // because it's text → (opaque parser) → richtext
        // there's no way to set a custom key function so idk how to do a heuristic for this. a heuristic would be
        // matching links or stateful components idk
    });

    return <div>
        <textarea disabled={isSending()} class="border my-3 w-full resize-y" value={content()} onInput={(e) => {
            setContent(e.currentTarget.value);
        }} />
        <div class="flex space-x-1">
            <button disabled={isSending()} class={link_styles_v["pill-filled"]} on:click={(e) => {
                setSending(true);

                client().sendReply(content(), props.action.reply_info).then((r) => {
                    console.log("Got response", r);
                    props.onAddReply(r);
                }).catch((error) => {
                    const err = error as Error;
                    console.log("Got error", err);
                    setSendError(err.stack ?? err.toString() ?? "Unknown error");
                });
            }}>{isSending() ? "…" : "Reply"}</button>
            <button disabled={isSending()} class={link_styles_v["pill-empty"]} on:click={(e) => {
                console.log("Cancel button clicked");

                if(content()) {
                    if(!confirm("delete draft?")) return;
                }
                props.onCancel();
            }}>Cancel<div /></button>
        </div>
        <ShowCond when={sendError()}>{errv => <>
            <pre class="error"><code>There was an error! {errv}</code></pre>
            <button on:click={() => setSendError(undefined)}>Hide error</button>
        </>}</ShowCond>
        <ShowCond when={diffable.value}>{value => {
            console.log("Value changed", value);
            return <div
                class="bg-body rounded-xl max-w-xl object-wrapper shadow-none"
            >
                <ClientContent listing={value} opts={{
                    clickable: false,
                    replies: null,
                    at_or_above_pivot: true,
                    is_pivot: true,
                    top_level: true,   
                }}/>
            </div>;
        }}</ShowCond>
    </div>;
}

export function DefaultErrorBoundary(props: {data: unknown, children: JSX.Element}): JSX.Element {
    const [showContent, setShowContent] = createSignal(true);
    return <ErrorBoundary fallback={(err: unknown, reset) => {
        console.log(err);
        return <div>
            <pre><code textContent={err instanceof Error ? (
                err.toString() + "\n\n" + err.stack ?? "*no stack*"
            ) : "Something went wrong"} /></pre>
            <button
                class={link_styles_v["outlined-button"]}
                on:click={() => console.log(err, props.data)}
            >Code</button>{" / "}
            <button
                class={link_styles_v["outlined-button"]}
                on:click={() => {
                    setShowContent(false);
                    setTimeout(() => setShowContent(true), 200);
                    reset();
                }}
            >Retry</button>
        </div>;
    }}>
        <ShowBool when={showContent()} fallback={
            <>Retrying...</>
        }>
            {props.children}
        </ShowBool>
    </ErrorBoundary>;
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
            <hr class="my-2 border-t-2 mb-8" style={{'border-top-color': "var(--collapse-line-color)"}} />
            {/*TODO put the sorting options here*/null}
            <For each={replies.items} fallback={<div>*There are no replies*</div>}>{reply => (
                <SwitchKind item={reply}>{{
                    post: post => (
                        <TopLevelWrapper>
                            <ClientContent listing={post.post.ref!.content} opts={{
                                clickable: false, // TODO
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

export function TopLevelWrapper(props: {children: JSX.Element}): JSX.Element {
    return <div class="top-level-wrapper object-wrapper bg-postcolor-100">{props.children}</div>;
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

// solidToVanillaBoundary needs to uuh
// idk do something but it needs to link hideshow and cleanup and return the threadclient or something

// TODO export const render() should return a HSC and provide <HideshowProvider> and <ClientProvider> to the content nodes