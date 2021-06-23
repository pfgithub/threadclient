import { createSignal, JSX, Index, Show, Switch, Match, createMemo } from "solid-js";
import { ThreadClient } from "../clients/base";
import type * as Generic from "../types/generic";
import {ClientPostOpts, navbar} from "../app";

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

type ClientPostReplyProps = {client: ThreadClient, reply: () => Generic.ListingEntry, is_threaded: boolean};
const ClientPostReply = (props: ClientPostReplyProps): JSX.Element => {
    const isThreaded = createMemo(() => (props.is_threaded || undefined) && kindIs(props.reply(), "post")?.post.ref?.replies?.items);

    return <>
        <li classList={{
            comment: props.reply().kind === "post",
            relative: props.is_threaded,
            threaded: props.is_threaded,
        }}>
            <Switch fallback={
                <div>ERROR! missing {props.reply().kind}</div>
            }>
                <Match when={kindIs(props.reply(), "post")}>{post_link => (
                    <Show when={post_link.post.ref} fallback={<div>Error! {post_link.post.err}</div>}>{post => (
                        <ClientPost client={props.client} content={post.content as Generic.PostContentPost} opts={{
                            clickable: false,
                            at_or_above_pivot: false,
                            is_pivot: false,
                            replies: isThreaded()?.length === 1 ? null : post.replies, // TODO support threading
                            top_level: false,
                        }} />
                    )}</Show>
                )}</Match>
                <Match when={kindIs(props.reply(), "load_more")}>
                    Post
                </Match>
            </Switch>
        </li>
        <Show when={isThreaded()?.length === 1}>{
            <ClientPostReply client={props.client} reply={() => isThreaded()![0]! /*this might not update properly idk*/} is_threaded={true} />
        }</Show>
    </>;
};

export type ClientPostProps = {client: ThreadClient, content: Generic.PostContentPost, opts: ClientPostOpts};
export const ClientPost = (props: ClientPostProps): JSX.Element => {
    const [selfCollapsed, setSelfCollapsed] = createSignal(false);
    return <div
        classList={{
            'post': true,
            'text-sm': true,
            'layout-reddit-comment': props.content.show_replies_when_below_pivot !== false,
            'layout-commentlike': props.content.show_replies_when_below_pivot !== false,
            'comment-collapsed': selfCollapsed(),
        }}
        style={{'margin-left': "-10px", ...props.opts.top_level ? {'margin-top': "-10px"} : {}}}
    >
        <Show when={props.content.show_replies_when_below_pivot !== false}>
            <button style={{bottom: "0"}} class="collapse-btn" draggable={true} onClick={(e) => {
                const collapsed_button = e.currentTarget;
                const topv = collapsed_button.getBoundingClientRect().top;
                const heightv = 5 + navbar.getBoundingClientRect().height;
                if(topv < heightv) {collapsed_button.scrollIntoView(); document.documentElement.scrollTop -= heightv}

                setSelfCollapsed(!selfCollapsed());
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
                <UserLink id={props.client.id} link={author.link} color_hash={author.color_hash}>
                    {author.name}
                </UserLink>
            )}</Show>
            <Show when={props.content.author?.flair}>{flair => <>
                {" "}<Flair flair={flair} />
            </>}</Show>
        </div>
        <Show when={!selfCollapsed()}>
            <div class="post-preview">TODO</div>
            <div class="post-content-buttons text-xs"></div>
        </Show>
        <Show when={!props.opts.at_or_above_pivot && props.opts.replies}>
            <Show when={props.opts.replies}>{replies => <Show when={props.content.show_replies_when_below_pivot !== false}>
                <ul class="post-replies">
                    <Index each={replies.items}>{reply => (
                        // - if replies.items is 1, maybe thread replies?
                        <ClientPostReply reply={reply} client={props.client} is_threaded={replies.items.length === 1} />
                    )}</Index>
                </ul>
            </Show>}</Show>
        </Show>
    </div>;
};

export const makeRenderFunction = (props: ClientPostProps): (() => JSX.Element) => (
    () => <ClientPost client={props.client} content={props.content} opts={props.opts} />
);