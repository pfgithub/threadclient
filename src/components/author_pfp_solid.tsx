import { createEffect, createMemo, createSignal, ErrorBoundary, For, JSX, Match, onCleanup, Switch } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import {
    clientContent, elButton, link_styles_v, navbar, renderBody, timeAgoText,
    unsafeLinkToSafeLink, LinkStyle, navigate, isModifiedEvent, previewLink
} from "../app";
import type * as Generic from "../types/generic";
import { getClient, HideshowProvider, kindIs, ShowBool, ShowCond, SwitchKind } from "../util/utils_solid";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import { getRandomColor, rgbToString, seededRandom } from "../darken_color";
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

export function ImageGallery(props: {images: Generic.GalleryItem[]}): JSX.Element {
    const [state, setState] = createSignal<{kind: "overview"} | {kind: "image", index: number}>({kind: "overview"});

    return <SwitchKind item={state()}>{{
        overview: overview => <>
            <For each={props.images}>{(image, i) => (
                <button 
                    class="m-1 inline-block bg-body rounded-md"
                    on:click={() => setState({kind: "image", index: i()})}
                >
                    <img src={image.thumb} width={image.w+"px"} height={image.h+"px"}
                        class="w-24 h-24 object-contain"
                    />
                </button>
            )}</For>
        </>,
        image: sel => <>
            <button
                class={link_styles_v["outlined-button"]}
                on:click={() => setState({kind: "image", index: sel.index - 1})}
                disabled={sel.index <= 0}
            >Prev</button>
            {sel.index + 1}/{props.images.length}
            <button
                class={link_styles_v["outlined-button"]}
                on:click={() => setState({kind: "image", index: sel.index + 1})}
                disabled={sel.index >= props.images.length - 1}
            >Next</button>
            <button
                class={link_styles_v["outlined-button"]}
                on:click={() => setState({kind: "overview"})}
            >Gallery</button>
            <Body body={props.images[sel.index]!.body} />
        </>,
    }}</SwitchKind>;
}

const generic_linkstyle_mappings: {
    [key in Generic.Richtext.LinkStyle]: LinkStyle
} = {'link': "normal", 'pill-empty': "pill-empty"};
function RichtextLink(props: {rts: Generic.Richtext.LinkSpan}): JSX.Element {
    // TODO display links with no text
    // used to do this: el("span").atxt("«no text»").adto(reslink);
    // but that doesn't work in many conditions
    const styleIsLink = () => (props.rts.style ?? "link") === "link";
    return <span title={props.rts.title}><Switch>
        <Match when={props.rts.is_user_link != null && props.rts.is_user_link}>{color_hash => (
            <UserLink color_hash={color_hash} href={props.rts.url}>
                <RichtextSpans spans={props.rts.children} />
            </UserLink>
        )}</Match>
        <Match when={props.rts.is_user_link == null && styleIsLink()}>
            <PreviewableLink href={props.rts.url}><RichtextSpans spans={props.rts.children} /></PreviewableLink>
        </Match>
        <Match when={props.rts.is_user_link == null && !styleIsLink()}>
            <LinkButton
                href={props.rts.url}
                style={generic_linkstyle_mappings[props.rts.style ?? "link"]}
            ><RichtextSpans spans={props.rts.children} /></LinkButton>
        </Match>
    </Switch></span>;
}

function RichtextSpan(props: {span: Generic.Richtext.Span}): JSX.Element {
    return <SwitchKind item={props.span}>{{
        text: (text) => <span classList={{
            'font-bold': text.styles.strong,
            'italic': text.styles.emphasis,
            'line-through': text.styles.strikethrough,
            'align-top': text.styles.superscript,
            'text-xs': text.styles.superscript,
        }}>{text.text}</span>,
        link: (link) => <RichtextLink rts={link} />,
        br: () => <br />,
        spoiler: (spoiler) => {
            // TODO what if the spoiler contained a button
            // so like
            // <span><button title="click to reveal" /><Content pointer-events:none opacity:0 /></span>
            const [opened, setOpened] = createSignal(false);
            return <span
                class="relative bg-spoiler-color-hover rounded"
            >
                <ShowBool when={!opened()}>
                    <button
                        class={"absolute top-0 left-0 bottom-0 right-0 w-full h-full "
                            +"rounded bg-spoiler-color hover:bg-spoiler-color-hover cursor-pointer"
                        }
                        title="Click to reveal spoiler"
                        on:click={() => setOpened(true)}
                    ></button>
                </ShowBool>
                <span
                    class="rounded transition-opacity bg-spoiler-color-revealed"
                    classList={{
                        'opacity-0': !opened(),
                        'invisible': !opened(),
                    }}
                >
                    <RichtextSpans spans={spoiler.children} />
                </span>
            </span>;
        },
        emoji: (emoji) => <img class="w-4 h-4 object-contain inline-block" src={emoji.url} title={emoji.name} />,
        flair: (flair) => <Flair flairs={[flair.flair]} />,
        time_ago: (time) => <TimeAgo start={time.start} />,
        error: (err) => <SolidToVanillaBoundary getValue={(hsc, client) => {
            return elButton("error").atxt(err.text).onev("click", e => {
                console.log(err.value);
            });
        }} />,
        code: (code) => <code class="bg-gray-200 p-1 rounded text-gray-800">{code.text}</code>,
    }}</SwitchKind>;
}

export function RichtextSpans(props: {spans: Generic.Richtext.Span[]}): JSX.Element {
    return <For each={props.spans}>{span => <RichtextSpan span={span}/>}</For>;
}

function RichtextParagraph(props: {paragraph: Generic.Richtext.Paragraph}): JSX.Element {
    return <SwitchKind item={props.paragraph}>{{
        paragraph: (pgph) => <p><RichtextSpans spans={pgph.children} /></p>,
        body: (body) => <Body body={body.body} />,
        heading: (heading) => {
            // <Dynamic> can work for this. they need different classes though so idk.
            const content = () => <RichtextSpans spans={heading.children} />;
            if(heading.level === 1) return <h1 class="text-3xl text-gray-900 font-black">{content()}</h1>;
            if(heading.level === 2) return <h2 class="text-2xl text-gray-900 font-bold">{content()}</h2>;
            if(heading.level === 3) return <h3 class="text-xl text-gray-900 font-semibold">{content()}</h3>;
            if(heading.level === 4) return <h4 class="text-lg text-gray-900 font-medium">{content()}</h4>;
            if(heading.level === 5) return <h5 class="text-base text-gray-600 font-normal">{content()}</h5>;
            return <h6 class="text-sm text-gray-600 font-normal underline">{content()}</h6>;
        },
        horizontal_line: () => <hr class="border-gray-200" />,
        blockquote: (bquote) => <blockquote class="border-l-2 border-gray-600 text-gray-600 pl-3">
            <RichtextParagraphs content={bquote.children} />
        </blockquote>,
        list: (list) => {
            // "list_item"/"tight_list_item" is not real
            // non-tight list items containing eg text and a sublist might not be tight
            // instead, check over the list and see if it should be 
            const isTight = createMemo(() => {
                return list.children.every(item => {
                    if(item.kind === "tight_list_item") return true;
                    if(item.children.length === 1) return true;
                    return false;
                    // note this is not quite right -
                    // a list containing a paragraph of text and another list might be tight.
                });
            });

            const listContent = (): JSX.Element => {
                return <For each={list.children}>{child => (
                    <li classList={{tight: isTight()}}>
                        <SwitchKind item={child}>{{
                            list_item: (content) => <RichtextParagraphs content={content.children} tight={isTight()} />,
                            tight_list_item: (content) => <div classList={{'my-2': !isTight()}}>
                                <RichtextSpans spans={content.children} />
                            </div>,
                        }}</SwitchKind>
                    </li>
                )}</For>;
            };
            if(list.ordered) return <ol class="list-decimal pl-4">{listContent()}</ol>;
            return <ul class="list-disc pl-4">{listContent()}</ul>;
        },
        code_block: (code) => <pre class="bg-gray-200 p-2 rounded text-gray-800">
            <ShowCond when={code.lang}>{lang => <div class="font-sans">
                <span class="bg-gray-100 p-1 inline-block rounded-sm">lang={lang}</span>
            </div>}</ShowCond>
            <code>{code.text}</code>
        </pre>,
        table: (table) => <table>
            <thead><tr>
                <For each={table.headings}>{heading => (
                    <th align={heading.align}><RichtextSpans spans={heading.children} /></th>
                )}</For>
            </tr></thead>
            <tbody><For each={table.children}>{child => <tr>
                <For each={child}>{(col, i) => (
                    <td align={table.headings[i()]?.align}><RichtextSpans spans={col.children} /></td>
                )}</For>
            </tr>}</For></tbody>
        </table>,
    }}</SwitchKind>;
}

export function RichtextParagraphs(props: {
    content: readonly Generic.Richtext.Paragraph[],
    tight?: boolean,
}): JSX.Element {
    return <For each={props.content}>{paragraph => (
        <div classList={{'my-2': !(props.tight ?? false)}}>
            <RichtextParagraph paragraph={paragraph} />
        </div>
    )}</For>;
}

function UserLink(props: {href: string, color_hash: string, children: JSX.Element}): JSX.Element {
    const getStyle = () => {
        const [author_color, author_color_dark] = getRandomColor(seededRandom(props.color_hash.toLowerCase()));
        return  {
            '--light-color': rgbToString(author_color),
            '--dark-color': rgbToString(author_color_dark),
        };
    };
    return <span style={getStyle()}><LinkButton style="userlink" href={props.href}>{props.children}</LinkButton></span>;
}

export function Flair(props: {flairs: Generic.Flair[]}): JSX.Element {
    // TODO renderFlair
    return <span><For each={props.flairs}>{(flair) => <>
        {" "}
        <span
            class={flair.system != null ? flair.system : "rounded-full px-2"
                + (flair.color != null ? " bg-flair-light dark:bg-flair-dark" : " bg-gray-300 dark:bg-gray-600")
                + (flair.fg_color != null ? " flair-text-"+flair.fg_color : "")
            }
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

function ErrableLink<T,>(props: {link: Generic.Link<T>, children: (link: T) => JSX.Element}) {
    return <ShowBool when={props.link.err == null} fallback={<div>Error! {props.link.err}</div>}>
        {props.children(props.link.ref!)}
    </ShowBool>;
}

type ClientPostReplyProps = {reply: Generic.ListingEntry, is_threaded: boolean};
function ClientPostReply(props: ClientPostReplyProps): JSX.Element {
    const isThreaded = createMemo(() => (
        (props.is_threaded || undefined) && kindIs(props.reply, "post")?.post.ref?.replies?.items
    ));

    return <>
        <li classList={{
            comment: props.reply.kind === "post",
            relative: props.is_threaded,
            threaded: props.is_threaded,
        }}>
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

function Body(props: {body: Generic.Body, autoplay?: boolean}): JSX.Element {
    let autoplay = props.autoplay ?? false;
    return <SolidToVanillaBoundary getValue={(hsc, client) => {
        const this_autoplay = autoplay;
        autoplay = false;
        return renderBody(client(), props.body, {autoplay: this_autoplay}).defer(hsc);
    }} />;
}

export type ClientPostProps = {content: Generic.PostContentPost, opts: ClientPostOpts};
function ClientPost(props: ClientPostProps): JSX.Element {
    const [selfVisible, setSelfVisible] = createSignal(
        props.content.show_replies_when_below_pivot !== false
        ? !props.content.show_replies_when_below_pivot.default_collapsed
        : true
    );
    const [bodyVisible, setBodyVisible] = createSignal<boolean | undefined>(undefined);
    const defaultBodyVisible = createMemo(() => {
        return props.opts.is_pivot ? true : !(props.content.title?.body_collapsible?.default_collapsed ?? false);
    });
    const bodyToggleable = createMemo(() => {
        return !!props.content.title?.body_collapsible;
    });
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
        <ShowBool when={props.content.show_replies_when_below_pivot !== false}>
            <button style={{bottom: "0"}} class="collapse-btn" draggable={true} on:click={(e) => {
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
        </div>
        <HideshowProvider visible={selfVisible}>
            <div class="post-preview">
                {/*working around a solid bug where !! is used on the lhs of a ??. should be fixed soon*/null}
                <ShowBool when={(void 0, bodyVisible() ?? defaultBodyVisible())}>
                    <Body body={props.content.body} />
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
            <button onClick={() => setSendError(undefined)}>Hide error</button>
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

function PreviewableLink(props: {href: string, children: JSX.Element}): JSX.Element {
    const client = getClient();

    const linkPreview: () => {
        visible: () => boolean,
        setVisible: (a: boolean) => void,
        body: Generic.Body,
    } | undefined = createMemo(() => {
        const body = previewLink(client(), props.href, {});
        if(!body) return undefined;
        const [visible, setVisible] = createSignal(false);
        return {visible, setVisible, body};
    });


    return <>
        <LinkButton href={props.href} style={linkPreview() ? "previewable" : "normal"} onClick={linkPreview() ? () => {
            const lp = linkPreview()!;
            lp.setVisible(!lp.visible());
        } : undefined}>
            {props.children}
            <ShowCond when={linkPreview()}>{preview_opts => <>
                {" "}{preview_opts.visible() ? "▾" : "▸"}
            </>}</ShowCond>
        </LinkButton>
        <ShowCond when={linkPreview()}>{preview_opts => (
            <ShowBool when={preview_opts.visible()}>
                <Body autoplay={true} body={preview_opts.body} />
            </ShowBool>
        )}</ShowCond>
    </>;
}

function LinkButton(props: {href: string, style: LinkStyle, onClick?: () => void, children: JSX.Element}): JSX.Element {
    const client = getClient();
    const linkValue = createMemo(() => unsafeLinkToSafeLink(client().id, props.href));
    return <SwitchKind item={linkValue()}>{{
        error: (error) => <a class={link_styles_v[props.style] + " error"} title={error.title} on:click={(e) => {
            e.stopPropagation();
            alert(props.href);
        }}>{props.children}</a>,
        mailto: (mailto) => <span title={mailto.title}>{props.children}</span>,
        link: (link) => <a
            class={link_styles_v[props.style]} href={link.url} target="_blank" rel="noopener noreferrer"
            on:click={(link.url.startsWith("/") || props.onClick) ? event => {
                event.stopPropagation();
                if (
                    !event.defaultPrevented && // onClick prevented default
                    event.button === 0 && // ignore everything but left clicks
                    !isModifiedEvent(event) // ignore clicks with modifier keys
                ) {
                    event.preventDefault();
                    if(props.onClick) return props.onClick();
                    navigate({path: link.url});
                }
            } : undefined}
        >{props.children}</a>,
    }}</SwitchKind>;
}

function DefaultErrorBoundary(props: {data: unknown, children: JSX.Element}): JSX.Element {
    return <ErrorBoundary fallback={(err: unknown, reset) => {
        console.log(err);
        return <div>
            <pre><code textContent={err instanceof Error 
                ? err.toString() + "\n\n" + err.stack ?? "*no stack*"
                : "Something went wrong"
            } /></pre>
            <button onClick={() => console.log(err, props.data)}>Code</button>{" / "}
            <button onClick={() => reset()}>Retry</button>
        </div>;
    }}>
        {props.children}
    </ErrorBoundary>;
}

// TODO make a custom <Switch> that asserts that all the cases have been handled

// should client be provided by a provider?
export type ClientContentProps = {listing: Generic.PostContent, opts: ClientPostOpts};
function ClientContent(props: ClientContentProps): JSX.Element {
    const todosupport = (thing: unknown) => <>
        TODO support. also in the parent list these should probably{" "}
        be one of those navbars with bits like ClientName {">"} PageName {">"} …{" "}
        <button onClick={() => console.log(thing)}>code</button>
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
                    return clientContent(client(), legacy.thread, {clickable: false}).defer(hsc);
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

function TopLevelWrapper(props: {children: JSX.Element}): JSX.Element {
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
                    page: () => <>TODO page</>,
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
            return <ErrableLink link={parent_link} children={parent => (
                <WrapParent node={parent} children={content()} is_pivot={false} />
            )} />;
        }} />
    </>;
}

// solidToVanillaBoundary needs to uuh
// idk do something but it needs to link hideshow and cleanup and return the threadclient or something

// TODO export const render() should return a HSC and provide <HideshowProvider> and <ClientProvider> to the content nodes