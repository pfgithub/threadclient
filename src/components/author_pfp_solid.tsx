import { createSignal, JSX, Show, Switch, Match, createMemo, createContext, useContext, ErrorBoundary, For } from "solid-js";
import { ThreadClient } from "../clients/base";
import type * as Generic from "../types/generic";
import {ClientPostOpts, hideshow, HideShowCleanup, navbar} from "../app";
import { render } from "solid-js/web";

const decorative_alt = "";

export const AuthorPfp = (props: {src_url: string}): JSX.Element => (
    <img src={props.src_url} alt={decorative_alt} class="w-8 h-8 object-center inline-block cfg-reddit-pfp rounded-full"/>
);

const UserLink = (props: {id: string, link: string, color_hash: string, children: JSX.Element}): JSX.Element => (
    // TODO userLink
    <span>{props.children}</span>
);

const Flair = (props: {flair: Generic.Flair[]}): JSX.Element => (
    // TODO renderFlair
    <span>TODO flair</span>
);

type Include<T, U> = T extends U ? T : never;

function kindIs<K extends string, T extends {kind: string}>(value: T, key: K): Include<T, {kind: K}> | null {
    return value.kind === key ? value as unknown as null : null;
}

const ErrableLink = <T,>(props: {link: Generic.Link<T>, children: (link: T) => JSX.Element}) => {
    return <Show when={props.link.err == null} fallback={<div>Error! {props.link.err}</div>}>
        {props.children(props.link.ref!)}
    </Show>;
};

type ClientPostReplyProps = {reply: Generic.ListingEntry, is_threaded: boolean};
const ClientPostReply = (props: ClientPostReplyProps): JSX.Element => {
    const isThreaded = createMemo(() => (props.is_threaded || undefined) && kindIs(props.reply, "post")?.post.ref?.replies?.items);

    return <>
        <li classList={{
            comment: props.reply.kind === "post",
            relative: props.is_threaded,
            threaded: props.is_threaded,
        }}>
            <Switch fallback={
                <div>ERROR! missing {props.reply.kind}</div>
            }>
                <Match when={kindIs(props.reply, "post")}>{post_link => (
                    <ErrableLink link={post_link.post}>{post => (
                        <ClientPost content={post.content as Generic.PostContentPost} opts={{
                            clickable: false,
                            at_or_above_pivot: false,
                            is_pivot: false,
                            replies: isThreaded()?.length === 1 ? null : post.replies, // TODO support threading
                            top_level: false,
                        }} />
                    )}</ErrableLink>
                )}</Match>
                <Match when={kindIs(props.reply, "load_more")}>
                    Post
                </Match>
            </Switch>
        </li>
        <Show when={isThreaded()?.length === 1}>{
            <ClientPostReply reply={isThreaded()![0]!} is_threaded={true} />
        }</Show>
    </>;
};

// TODO disable this rule in _solid.tsx files
// eslint-disable-next-line @typescript-eslint/naming-convention
const ClientContext = createContext<{client: ThreadClient}>();
const ClientProvider = (props: {client: ThreadClient, children: JSX.Element}): JSX.Element => {
    return <ClientContext.Provider value={{client: props.client}}>{props.children}</ClientContext.Provider>;
};
const getClient = (): (() => ThreadClient) => {
    const client = useContext(ClientContext);
    if(!client) throw new Error("A client is required to render this component");
    return createMemo(() => client.client);
};

// eslint-disable-next-line @typescript-eslint/naming-convention
const HideshowContext = createContext<{visible: () => boolean}>();

const HideshowProvider = (props: {visible: () => boolean, children: JSX.Element}): JSX.Element => {
    const parent_state = useContext(HideshowContext);
    const selfVisible = createMemo(() => {
        const parent_v = parent_state?.visible() ?? true;
        const props_v = props.visible();
        return parent_v ? props_v : false;
    });
    return <HideshowContext.Provider value={{visible: selfVisible}}>{props.children}</HideshowContext.Provider>;
};

const ShowVisibleState = (): JSX.Element => {
    const visible_state = useContext(HideshowContext);

    const demo = createMemo(() => {
        return visible_state?.visible() ?? true ? "Visible" : "Hidden";
    });
    
    // bug in solid, it's not detecting this expression as requiring wrapping when in jsx
    // use demo() for now.
    return <span>{visible_state?.visible() ?? true ? "Visible" : "Hidden"}{demo()}</span>;
};

export type ClientPostProps = {content: Generic.PostContentPost, opts: ClientPostOpts};
const ClientPost = (props: ClientPostProps): JSX.Element => {
    const [selfVisible, setSelfVisible] = createSignal(true);
    const client = getClient();
    return <div
        classList={{
            'post': true,
            'text-sm': true,
            'layout-reddit-comment': props.content.show_replies_when_below_pivot !== false,
            'layout-commentlike': props.content.show_replies_when_below_pivot !== false,
            'comment-collapsed': !selfVisible(),
        }}
        style={{'margin-left': "-10px", ...props.opts.top_level ? {'margin-top': "-10px"} : {}}}
    >
        <Show when={props.content.show_replies_when_below_pivot !== false}>
            <button style={{bottom: "0"}} class="collapse-btn" draggable={true} onClick={(e) => {
                const collapsed_button = e.currentTarget;
                const topv = collapsed_button.getBoundingClientRect().top;
                const heightv = 5 + navbar.getBoundingClientRect().height;
                if(topv < heightv) {collapsed_button.scrollIntoView(); document.documentElement.scrollTop -= heightv}

                setSelfVisible(!selfVisible());
            }}>
                <div class="collapse-btn-inner"></div>
            </button>
        </Show>
        <div class="post-content-subminfo">
            <Show when={props.content.title}>{title => (
                <div>{title.text}</div>   
            )}</Show>
            <Show when={props.content.author?.pfp}>{pfp => <>
                <AuthorPfp src_url={pfp.url} />{" "}
            </>}</Show>
            <Show when={props.content.author}>{author => (
                <UserLink id={client().id} link={author.link} color_hash={author.color_hash}>
                    {author.name}
                </UserLink>
            )}</Show>
            <Show when={props.content.author?.flair}>{flair => <>
                {" "}<Flair flair={flair} />
            </>}</Show>
        </div>
        <HideshowProvider visible={selfVisible}>
            <div class="post-preview">TODO <ShowVisibleState /></div>
            <div class="post-content-buttons text-xs"></div>
            <Show when={!props.opts.at_or_above_pivot && props.opts.replies}>
                <Show when={props.opts.replies}>{replies => <Show when={props.content.show_replies_when_below_pivot !== false}>
                    <ul class="post-replies">
                        <For each={replies.items}>{reply => (
                            // - if replies.items is 1, maybe thread replies?
                            <ClientPostReply reply={reply} is_threaded={replies.items.length === 1} />
                        )}</For>
                    </ul>
                </Show>}</Show>
            </Show>
        </HideshowProvider>
    </div>;
};

const DefaultErrorBoundary = (props: {data: unknown, children: JSX.Element}): JSX.Element => {
    return <ErrorBoundary fallback={(err: unknown, reset) => {
        return <div>
            <pre><code textContent={err instanceof Error ? err.toString() + "\n\n" + err.stack ?? "*no stack*" : "Something went wrong"} /></pre>
            <button onClick={() => console.log(err, props.data)}>Code</button>{" / "}
            <button onClick={() => reset()}>Retry</button>
        </div>;
    }}>
        {props.children}
    </ErrorBoundary>;
};

// TODO make a custom <Switch> that asserts that all the cases have been handled

// should client be provided by a provider?
export type ClientContentProps = {listing: Generic.PostContent, opts: ClientPostOpts};
const ClientContent = (props: ClientContentProps): JSX.Element => {
    return <div>
        <DefaultErrorBoundary data={[props.listing, props.opts]}>
            <Switch fallback={
                <>
                    Error! unsupported.
                    <button onClick={() => console.log(props.listing)}>code</button>
                </>
            }>
                <Match when={kindIs(props.listing, "page") || kindIs(props.listing, "client")}>{thing => (
                    <>
                        TODO support. also in the parent list these should probably{" "}
                        be one of those navbars with bits like ClientName {">"} PageName {">"} …{" "}
                        <button onClick={() => console.log(thing)}>code</button>
                    </>
                )}</Match>
                <Match when={kindIs(props.listing, "post")}>{post => (
                    <ClientPost content={post} opts={props.opts} />
                )}</Match>
                <Match when={kindIs(props.listing, "legacy")}>{legacy => (
                    <>
                        TODO legacy{" "}
                        <button onClick={() => console.log(legacy)}>code</button>
                    </>
                )}</Match>
            </Switch>
        </DefaultErrorBoundary>
    </div>;
};

export type ClientPageProps = {page: Generic.Page2};
export const ClientPage = (props: ClientPageProps): JSX.Element => {
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
        <Show when={props.page.pivot.ref!.replies}>{replies => <>
            <hr class="my-2 border-t-2 mb-8" style={{'border-top-color': "var(--collapse-line-color)"}} />
            {/*TODO put the sorting options here*/null}
            <For each={replies.items} fallback={<div>*There are no replies*</div>}>{reply => (
                <Switch fallback={<div>Missing {reply.kind}</div>}>
                    <Match when={kindIs(reply, "post")}>{post => (
                        <TopLevelWrapper>
                            <ClientContent listing={post.post.ref!.content} opts={{
                                clickable: false, // TODO
                                replies: post.post.ref!.replies,
                                at_or_above_pivot: false,
                                top_level: true,
                                is_pivot: false,
                            }} />
                        </TopLevelWrapper>
                    )}</Match>
                </Switch>
            )}</For>
        </>}</Show>
    </WrapParent>;
};

const TopLevelWrapper = (props: {children: JSX.Element}): JSX.Element => {
    return <div class="top-level-wrapper object-wrapper bg-postcolor-100">{props.children}</div>;
};

// you know what'd be interesting?
// what if the Client post in a post's parent list actually contained the client to use to render it
// not going to do that but it could be interesting
const WrapParent = (props: {node: Generic.ParentPost, children: JSX.Element, is_pivot: boolean}): JSX.Element => {
    // () => in order to capture any .Provider nodes in a parent
    const content = () => <>
        <Switch fallback={<div>error! {props.node.kind}</div>}>
            <Match when={kindIs(props.node, "post")} children={(post_root) => (
                <Switch fallback={<div>error kind! {post_root.content.kind}</div>}>
                    <Match when={kindIs(post_root.content, "post")} children={(post) => (
                        <TopLevelWrapper>
                            <ClientContent listing={post} opts={{
                                clickable: !props.is_pivot,
                                replies: post_root.replies,
                                at_or_above_pivot: true,
                                top_level: true,
                                is_pivot: props.is_pivot,
                            }} />
                        </TopLevelWrapper>
                    )} />
                </Switch>
            )} />
        </Switch>
        {props.children}
    </>;
    return <>
        <Show when={props.node.parent} fallback={
            content()
        } children={parent_link => {
            return <ErrableLink link={parent_link} children={parent => (
                <WrapParent node={parent} children={content()} is_pivot={false} />
            )} />;
        }} />
    </>;
};

export const vanillaToSolidBoundary = <U, T extends (props: U) => JSX.Element>(
    client: ThreadClient, frame: HTMLDivElement, SolidNode: T, props: U,
): HideShowCleanup<HTMLDivElement> => {
    const hsc = hideshow(frame);

    const cleanup = render(() => {
        const [cvisible, setCvisible] = createSignal(hsc.visible);
        hsc.on("hide", () => setCvisible(false));
        hsc.on("show", () => setCvisible(true));

        return <HideshowProvider visible={cvisible}>
            <ClientProvider client={client}>
                <SolidNode {...props} />
            </ClientProvider>
        </HideshowProvider>;
    }, frame);
    hsc.on("cleanup", () => cleanup());

    return hsc;
};
// solidToVanillaBoundary needs to uuh
// idk do something but it needs to link hideshow and cleanup and return the threadclient or something

// TODO export const render() should return a HSC and provide <HideshowProvider> and <ClientProvider> to the content nodes